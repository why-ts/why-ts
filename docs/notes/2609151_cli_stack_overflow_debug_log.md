# `cli` build stack-overflow — investigation log (pre-roadmap)

Scope: pure investigation. No fix applied to the main tree. All speculative
edits happened in a scratch git worktree (`.worktrees/ts-debug`, removed at
the end via `git worktree remove --force`). Does not touch
`docs/roadmaps/2609142054_CLI_BUILD_STACK_OVERFLOW_FIX_ROADMAP.md`,
`docs/roadmaps/_index.md`, or the two pre-existing unrelated uncommitted
changes (`package.json` packageManager field,
`docs/roadmaps/2609141945_NX_TEARDOWN_ROADMAP.md`).

Environment: macOS, Node v22.15.1, pnpm 10.18.2. Main tree's installed
`typescript` is `5.5.4` (root `package.json` devDependency `~5.5.4`),
`type-fest` resolves to `4.41.0`, `ts-pattern` resolves to `5.9.0`
(confirmed by reading `node_modules/*/package.json` directly, not assumed).

## 0. Baseline reproduction (unmodified main tree)

Command:

```
rm -rf /tmp/nx-debug1 && COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-debug1 pnpm exec nx build cli --skip-nx-cache
```

Result: crashes exactly as reported —

```
RangeError: Maximum call stack size exceeded
    at outofbandVarianceMarkerHandler (.../typescript@5.5.4/.../typescript.js:69999:44)
    at outofbandVarianceMarkerHandler (.../typescript.js:68510:18)
    at outofbandVarianceMarkerHandler (.../typescript.js:68510:18)
    ... (repeats)
```

Interpretation: crash is real and reproducible on the current, unmodified
tree. Confirms the premise before doing anything else.

## 1. What `outofbandVarianceMarkerHandler` actually is (source inspection)

Read `node_modules/.pnpm/typescript@5.5.4/node_modules/typescript/lib/typescript.js`
around the frames named in the trace (~line 68505-68515, and the equivalent
in `tsc.js` at ~63726-63734):

```js
let originalHandler;
let propagatingVarianceFlags = 0;
if (outofbandVarianceMarkerHandler) {
  originalHandler = outofbandVarianceMarkerHandler;
  outofbandVarianceMarkerHandler = (onlyUnreliable) => {
    propagatingVarianceFlags |= onlyUnreliable ? 16 : 8;
    return originalHandler(onlyUnreliable);
  };
}
```

This code lives inside `structuredTypeRelatedTo` (TypeScript's structural
relation/assignability checker), a few lines below an explicit depth guard:

```js
if (sourceDepth === 100 || targetDepth === 100) {
  overflow = true;
  return 0 /* False */;
}
```

`outofbandVarianceMarkerHandler` is a single module-level closure variable
that `structuredTypeRelatedTo` reassigns to a *new* wrapper closure on every
recursive call, chaining to the previous one (`originalHandler`). V8 names
anonymous functions after the variable/property they're assigned to, so
**every one of these per-call wrapper closures is named
`outofbandVarianceMarkerHandler` in a stack trace** — the name is an
artifact of V8's function-naming heuristic, not evidence that one specific
named function is recursing. The real recursing function is
`structuredTypeRelatedTo` itself (structural/variance relation checking),
confirmed by reading the surrounding source, not by trusting the trace's
printed names.

This is hard evidence for: **the crash is a structural/variance relation
check recursing, not plain "type instantiation depth."**

## 2. `--generateTrace` run (pinpointing which file/site crashes)

Command (direct `tsc` invocation, bypassing the Nx executor, against the
real build's tsconfig):

```
mkdir -p /tmp/ts-trace-baseline
node --stack-trace-limit=200 \
  node_modules/.pnpm/typescript@5.5.4/node_modules/typescript/bin/tsc \
  -p libs/cli/tsconfig.lib.json --generateTrace /tmp/ts-trace-baseline \
  --extendedDiagnostics --noEmit
```

Result: same `RangeError`, same frame pattern. `/tmp/ts-trace-baseline/trace.json`
(365KB) was written incrementally before the crash (tracing streams events,
so a partial file survives the crash). Parsed it as a truncated JSON array
(closed the dangling `[` manually) and inspected the tail:

- Last `checkSourceFile` **begin** event with no matching **end** event:
  `libs/cli/src/lib/command.ts` — i.e. the crash happened while
  type-checking `command.ts` (the class *implementing* the recursive
  `Command` interface), not `command.types.ts` itself, not `program.ts`,
  and not any `ts-pattern`/`type-fest` internal file.
- `grep -c "recursiveTypeRelatedTo_DepthLimit" trace.json` → **0 matches**.
  TypeScript's own instrumentation emits this event when
  `sourceDepth === 100 || targetDepth === 100` (the depth cap quoted above)
  is hit. Zero occurrences means **the native call stack overflowed before
  TypeScript's own 100-level logical-recursion safety valve ever fired.**

Interpretation: this is the single most important piece of evidence for the
"unbounded vs. large-but-finite" question. It shows each *logical* level of
recursive structural comparison here costs enough real V8 stack frames
(many mutually-recursive checker functions per level — `isRelatedTo`,
`propertiesRelatedTo`, `signatureRelatedTo`, `typeArgumentsRelatedTo`, …)
that the process runs out of native stack well before 100 logical levels,
i.e. this is not "just a few levels too deep for the default stack."

## 3. `--stack-size` / larger-stack experiments

### 3a. Plain process, OS ulimit raised to hard max

```
node --stack-size=7900 .../tsc -p libs/cli/tsconfig.lib.json --noEmit
# → crashes (baseline, ulimit -s default 8176 KB)

bash -c 'ulimit -s 65520; node --stack-size=65000 .../tsc -p libs/cli/tsconfig.lib.json --noEmit'
# → still crashes, identical RangeError/frame pattern, at ~8x the stack
```

`ulimit -Hs` on this machine is 65520 KB (~64 MB); that's the ceiling
reachable without root, and it still crashes.

### 3b. `worker_threads` with arbitrary `stackSizeMb` (bypasses OS ulimit)

Wrote `tmp/stack-size-worker.mjs` (gitignored scratch script, `tmp/` is in
`.gitignore`) that runs `ts.createProgram` + `ts.getPreEmitDiagnostics`
inside a worker thread with a configurable `resourceLimits.stackSizeMb`.
Verified the requested value is applied faithfully (not silently clamped)
via a second scratch script, `tmp/check-stacksize.mjs`, printing
`worker_threads.resourceLimits` from inside the worker.

Binary search result:

| stackSizeMb | outcome (within timeout shown) |
| --- | --- |
| 64 | crashes almost immediately (< 1s), same `RangeError` |
| 65 | does **not** crash within 25s |
| 68, 70, 80, 88, 96, 128, 160, 192 | do **not** crash within 25s |
| 128 (extended run) | still running at 4m28s, 98-99% CPU, RSS climbing (440MB → 510MB) — killed, never crashed or finished |
| 256 (extended run) | still running at 3m00s, 99% CPU, RSS climbing (443MB → 592MB) — killed, never crashed or finished |

Interpretation: there is a sharp transition around 64→65 MB (8x the OS
default), but it is **not** "crashes below, cleanly succeeds above." Above
the threshold the process doesn't fail fast — it burns CPU and grows memory
without completing in several minutes (compare: the whole `cli` project's
real build takes low single-digit seconds when it isn't crashing). This is
the behavior of a genuinely runaway/near-exponential recursive comparison,
not a fixed-depth recursion that merely needed slightly more headroom.
**Increasing the stack delays the failure (or converts it into a hang); it
does not resolve it within any reasonable bound tested (up to 256 MB, ~4x
the OS hard limit).**

## 4. Minimal reduction (scratch worktree `.worktrees/ts-debug`)

Setup: `git worktree add .worktrees/ts-debug HEAD`, symlinked
`node_modules` from the main tree for same-version tests (no install
needed), removed the symlink and did real `pnpm install` runs for the
version tests in section 5. Worktree removed via
`git worktree remove --force .worktrees/ts-debug` at the end of every
sub-experiment that needed a fresh state; final removal confirmed with
`git worktree list` (only `why-ts [main]` remains).

All edits below were made only inside the worktree and reverted with
`git checkout -- <file>` before the next experiment; nothing was committed.

### 4a. Remove `implements Command<Options, HandlerResult>` from `CommandImpl`

Edit: dropped the `implements` clause from the class header in
`libs/cli/src/lib/command.ts` only.

Result: **still crashes**, identical trace. Reason (confirmed by reading
the file): `export function command(): Command { return new CommandImpl(...) }`
still has an explicit `Command` return-type annotation, which forces the
same structural assignability check as `implements` would. The `implements`
clause and the return-type annotations are two call sites into the *same*
underlying relation check.

### 4b. Also remove the `Command<...>` return-type annotations on `meta`, `option`, `handle`, and the `command()` factory function

Edit: removed `implements Command<...>` **and** the explicit `Command<...>`
return-type annotations from `meta()`, `option()`, `handle()` in
`CommandImpl`, and from the `command()` factory (let TS infer everything).

Result: **crash disappears.** `tsc -p libs/cli/tsconfig.lib.json --noEmit`
completes cleanly (exit 0, no errors, no crash) within 60s (normally
instant once past the file-check phase).

Interpretation: the crash requires TypeScript to structurally compare a
concrete implementation shape (`CommandImpl<...>`) against the recursive
`Command<Options, HandlerResult>` interface (whose own methods return
`Command<...>` again). Remove every site that forces that comparison and
the crash goes away. This directly confirms the "structural comparison of
two recursive generic instantiations (variance checking)" hypothesis for
*this* codebase — it is not a plain instantiation-depth issue over a single
type, it's an assignability/variance check between two structurally
self-referential shapes.

### 4c. Revert 4b (restore original `command.ts`). Instead, strip `CamelCase` out of the recursion, keeping every recursive `Command` self-reference and the `implements` clause intact

Edit, in `libs/cli/src/lib/command.types.ts` only:

```diff
-> = Options & { [_ in CamelCase<N>]: Aliased<O> };
+> = Options & { [_ in N]: Aliased<O> };
```
(applied to both `ExtendedOptions` and inline in `Command.option()`'s
return type; two occurrences, `git --no-pager diff` confirmed no other
semantic change — only Prettier trailing-comma noise from the edit tool).

Result: **crash disappears.** Clean `tsc --noEmit`, exit 0, no errors.

### 4d. Revert 4c (`git checkout -- libs/cli/src/lib/command.types.ts`), re-run with zero changes

Result: **crash returns immediately**, identical trace to the baseline.

Interpretation: this is a clean on/off switch. With the recursive
`Command`-implements-`CommandImpl` structural check **and** `CamelCase<N>`
both present, it crashes, every time. Remove either ingredient alone (4b:
remove the structural check; 4c: remove `CamelCase` but keep the recursive
structural check) and it doesn't crash. Both ingredients are load-bearing;
neither alone (in this codebase) is sufficient without the other — this
codebase's `Command` self-reference on its own (without `CamelCase`) is
comparison-cheap enough not to blow the default 8MB stack, and mapping
`CamelCase` over a non-recursive key set elsewhere presumably wouldn't
either. Note this doesn't test `ts-pattern` in isolation — the crash
manifests already while checking `command.ts`, before the checker reaches
`program.ts` (the only file using `ts-pattern`'s `match`), confirmed by the
`--generateTrace` file's last `checkSourceFile` events (see §2) predating
any `program.ts` entry. `ts-pattern` was not reached at all when the crash
happens, in this reproduction.

## 5. Direct TypeScript-version re-verification (not trusting the roadmap notes)

Ran fresh `pnpm install`s inside the scratch worktree (package.json edited,
`pnpm-lock.yaml` regenerated inside the worktree only, never touching the
main tree's lockfile), each followed by a direct
`node node_modules/typescript/bin/tsc -p libs/cli/tsconfig.lib.json --noEmit`.

| typescript | type-fest | ts-pattern | Result |
| --- | --- | --- | --- |
| 5.5.4 (baseline) | 4.41.0 | 5.9.0 | crashes |
| 5.6.3 | 4.41.0 | 5.9.0 | **crashes** (confirmed directly: `.../typescript@5.6.3/.../tsc.js:64196` same `outofbandVarianceMarkerHandler` chain) |
| 5.9.3 | 4.41.0 | 5.9.0 | **crashes** (`.../typescript@5.9.3/.../_tsc.js:65702`, same pattern) |
| 5.5.4 | 4.25.0 (pinned old) | 5.3.1 (pinned old) | **crashes** — same as baseline, not fixed by reverting the libraries either |

Interpretation: **the prior roadmap's "Decision" is falsified by direct,
fresh reproduction**, on two independent axes:

1. Bumping `typescript` alone (5.6.3, 5.9.3), with today's resolved
   `type-fest@4.41.0`/`ts-pattern@5.9.0` left in place, does **not** fix
   the crash — matching the second agent's contradicting re-test, and now
   independently reproduced here from a clean install rather than taken on
   faith.
2. The roadmap's other claim — that the *old* `type-fest@4.25.0` +
   `ts-pattern@5.3.1` pair (matching the pre-migration `lockfileVersion:
   '6.0'` lockfile) stays "under the recursion budget" at TS 5.5.4 — is
   **also false** in this environment: that exact combination still
   crashes.

Given §4c/§4d showed the crash is fully explained by `CamelCase<N>` mapped
over the recursive `Command` interface regardless of which `type-fest`
version supplies `CamelCase` (4.25.0 also ships `CamelCase`, and still
crashes here), the version-pinning theory was never well-founded — the
crash is a property of *this codebase's type shape*, reproducible on every
`typescript`/`type-fest`/`ts-pattern` combination tested, old and new. The
prior roadmap's "verified" claims most likely reflect a methodology issue
in that session (stale `nx` cache/`.tsbuildinfo`, a build invocation that
didn't actually recompile `command.ts`'s checked signatures, or similar) —
we cannot identify the exact flaw without that session's raw logs, so this
is stated as the most likely explanation, not a confirmed one.

## 6. Cleanup

- `git worktree remove --force .worktrees/ts-debug` — confirmed via
  `git worktree list` (only `why-ts [main]` remains) and `ls .worktrees`
  (empty).
- No background processes left running (`pgrep -fl stack-size-worker` /
  `pgrep -fl tsc.js` both empty after the last kill).
- Main tree `git status --porcelain` unchanged from session start: only
  the two pre-existing unrelated files (`package.json`,
  `docs/roadmaps/2609141945_NX_TEARDOWN_ROADMAP.md`) plus
  `docs/roadmaps/_index.md`, none touched by this investigation.
- Scratch scripts left at `why-ts/tmp/stack-size-worker.mjs` and
  `why-ts/tmp/check-stacksize.mjs` (both gitignored via `tmp/` in
  `.gitignore`) in case a future session wants to re-run the stack-size
  experiments without recreating them.

## 7. Hypothesis verdicts (summary; see body above for evidence)

1. **Structural/variance comparison of two recursive generic
   instantiations drives the crash, not plain instantiation depth** —
   **Confirmed.** §1 (source-level identification of
   `outofbandVarianceMarkerHandler` as `structuredTypeRelatedTo`'s
   per-call variance-wrapper), §4b (removing the structural
   `CommandImpl`-vs-`Command` comparison sites removes the crash).

2. **`CamelCase<N>` (type-fest) mapped over the recursive `Command`
   self-reference is a necessary trigger ingredient in this codebase**
   — **Confirmed** for necessity-in-combination. §4c/§4d (toggling
   `CamelCase<N>` vs plain `N` in `ExtendedOptions`/`Command.option()`,
   with the recursive structural check otherwise intact, cleanly
   toggles the crash on/off). Not tested in isolation without the
   recursive `Command` self-reference (untested whether `CamelCase`
   alone, without the recursive interface, would also crash) — likely
   not, since `CamelCase` alone is used in plenty of ordinary TS code
   without incident, but that specific isolation step was not run.
   `ts-pattern`'s exhaustive-match inference — **Rejected** as a
   contributor to *this* crash: the crash reproduces and disappears
   based purely on `command.ts`/`command.types.ts` edits, and
   `--generateTrace` shows the crash happens while checking
   `command.ts`, before the checker ever reaches `program.ts` (the only
   file that imports `ts-pattern`).

3. **TypeScript-version bump (5.6.3/5.7.3/5.8.3/5.9.x) fixes the crash**
   — **Rejected**, directly re-verified from a clean install (§5): 5.6.3
   and 5.9.3 both crash identically to 5.5.4, with either today's
   resolved `type-fest`/`ts-pattern` versions or the old pre-migration
   ones. The prior roadmap's "Decision" claiming this was verified is
   not reproducible in this environment.

4. **`--stack-size`/larger-stack merely delays vs. fully resolves the
   crash** — **Confirmed** as "delays, does not resolve" up to the
   bounds tested. §3: OS-ulimit-backed `--stack-size` up to ~8x default
   still crashes identically; `worker_threads`-backed stack sizes up to
   32x (256 MB) and 16x (128 MB) default don't crash quickly but also
   don't complete within several minutes of 99% CPU and growing RSS —
   consistent with near-exponential/runaway recursive work, not a
   fixed-but-large depth that a modest stack bump would cleanly clear.

## 8. What a viable fix would need to address (not implemented here)

- The crash is caused by `command.types.ts`'s `Command<Options,
  HandlerResult>` interface being self-referential (its own methods
  return `Command<...>` again) **and** using `CamelCase<N>` as a mapped
  key in the options-extension type, checked structurally against
  `CommandImpl`'s implementation in `command.ts`. Any durable fix has to
  reduce the cost of that specific structural comparison — options
  include (not evaluated for correctness/side effects here, next
  session's job):
  - Simplify/restructure `Command`'s recursive shape so the checker
    doesn't need a full structural (variance) comparison at the
    `implements`/return-type-annotation sites (e.g. widen an
    intermediate type, break the self-reference with an explicit cast
    at a single boundary, or avoid mapping `CamelCase` at the type level
    for the recursive interface specifically).
  - Pinning `type-fest`/`ts-pattern` backward is **not** viable per §5 —
    it does not fix the crash in this environment regardless.
  - Bumping `typescript` alone is **not** viable per §5, for the same
    reason.
  - A CI/build-only `NODE_OPTIONS=--stack-size=...` (or `ulimit -s`)
    bump is not a clean fix per §3 — it either doesn't help within a
    reasonable range or converts a fast, loud crash into a slow,
    resource-hungry hang, which is arguably worse for CI.
  - A genuine type-level simplification of the recursive
    `command`/`option` builder generics (explicitly out of scope for
    the prior roadmap, but apparently necessary given the above) is the
    most likely durable direction.

## Commands run (for reproduction), in order

```
rm -rf /tmp/nx-debug1 && COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-debug1 pnpm exec nx build cli --skip-nx-cache
mkdir -p /tmp/ts-trace-baseline && node --stack-trace-limit=200 node_modules/.pnpm/typescript@5.5.4/node_modules/typescript/bin/tsc -p libs/cli/tsconfig.lib.json --generateTrace /tmp/ts-trace-baseline --extendedDiagnostics --noEmit
node --stack-size=7900 node_modules/.pnpm/typescript@5.5.4/node_modules/typescript/bin/tsc -p libs/cli/tsconfig.lib.json --noEmit
bash -c 'ulimit -s 65520; node --stack-size=65000 node_modules/.pnpm/typescript@5.5.4/node_modules/typescript/bin/tsc -p libs/cli/tsconfig.lib.json --noEmit'
node tmp/stack-size-worker.mjs <N>          # N in {64,65,66,67,68,70,80,88,96,128,160,192,256}
git worktree add .worktrees/ts-debug HEAD
# (in worktree) ln -s ../../node_modules node_modules   # for same-TS-version edits
# (in worktree) edit command.ts / command.types.ts per §4, run:
node node_modules/.pnpm/typescript@5.5.4/node_modules/typescript/bin/tsc -p libs/cli/tsconfig.lib.json --noEmit
# (in worktree) rm node_modules (the symlink); edit package.json's typescript field; then:
COREPACK_ENABLE_AUTO_PIN=0 pnpm install --no-frozen-lockfile
node node_modules/typescript/bin/tsc -p libs/cli/tsconfig.lib.json --noEmit
git worktree remove --force .worktrees/ts-debug
```
