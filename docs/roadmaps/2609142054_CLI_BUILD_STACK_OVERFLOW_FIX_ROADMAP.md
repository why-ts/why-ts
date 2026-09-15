# Fix `cli` build stack overflow (TypeScript variance-checker crash) — Task Map

## Goal (locked)

`libs/cli`'s build (currently `pnpm exec nx build cli`; the invocation mechanism
may change later under the in-flight pnpm migration, see Decisions) succeeds
reliably in this environment, with no `RangeError: Maximum call stack size
exceeded` from TypeScript's checker, and without breaking `core`/`irpc`/
`example-cli` builds or tests. **Revised 2026-09-15** (see Decisions): a
dedicated debug investigation (`docs/notes/2609151_cli_stack_overflow_debug_log.md`)
directly falsified this roadmap's original "TypeScript version bump" fix and
confirmed the real root cause with instrumented evidence (`--generateTrace`,
minimal reduction in a scratch worktree, direct re-verification across
TypeScript 5.5.4/5.6.3/5.9.3). The fix is now a **minimal, targeted removal of
specific explicit type annotations** in `libs/cli/src/lib/command.ts` that
force an expensive structural/variance comparison between `CommandImpl` and
the recursive `Command<Options, HandlerResult>` interface — not a dependency
version bump (confirmed non-viable), and not a change to the public
`Command`/`CamelCase`-derived API shape consumers see. Root cause is confirmed
by direct reproduction, source inspection, and minimal reduction (see
Decisions/Evidence), not hypothesis.

**Out of scope:**

- `docs/roadmaps/2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` and its chunks —
  do not touch that roadmap, its files list, or its Agent logs. This roadmap
  is orthogonal and must not modify it.
- The `core:lint`/`cli:lint`/`irpc:lint` ESLint-symlink-resolution regression
  (pre-existing, caused by the migration's F1 chunk creating real
  `node_modules`; tracked under that roadmap's own `L1` chunk).
- A broader type-level redesign of `libs/cli`'s recursive command/option
  builder generics beyond the narrow, confirmed-necessary removal of
  specific explicit annotations on `CommandImpl` (see Decisions/`TS1`). If
  that narrow fix does not hold once implemented, escalate to human before
  attempting a larger redesign — do not freelance a bigger rewrite under
  this roadmap.
- Removing or altering `type-fest`'s `CamelCase<N>` mapped-type usage in
  `command.types.ts`. Confirmed necessary-but-not-sufficient trigger
  ingredient for the crash (see Decisions/Evidence), but it is also
  load-bearing for the public API: `CamelCase` describes the camelCase key
  shape that `config/parser.default.ts`'s runtime `camelCase(rawKey)` call
  actually produces. Removing it would silently change (weaken) the public
  TypeScript API's parsed-args key casing type — an API-shape change, not a
  bugfix. Out of scope here.
- Package `version`/`publishConfig` fields, `.npmrc`, `.verdaccio/config.yml`.
- `nx release`, `npm publish`, force-push, tag deletion/force-move (Never
  tier per `AGENTS.md`).

## Decisions (locked)

- **[SUPERSEDED 2026-09-15 — kept for history, do not act on this bullet]**
  ~~Root cause: TypeScript 5.5.4's type-relation variance checker overflows
  the stack when checking `libs/cli`'s recursive generics combined with
  `type-fest@4.41.0` + `ts-pattern@5.9.0`'s added depth; bumping
  `typescript` to `~5.6.3` was "Verified" to fix it.~~ **This was not
  reproducible.** A second, independent re-test (roadmap Agent log, TS1,
  2026-09-15) found TypeScript 5.6.3/5.7.3/5.9.3 all still crash identically
  with either dependency-version combination. A follow-up dedicated debug
  investigation (`docs/notes/2609151_cli_stack_overflow_debug_log.md`)
  re-verified this directly from clean installs and confirms: **the
  TypeScript-version-bump fix is falsified, not viable.**
- **Root cause (confirmed by source inspection + `--generateTrace` +
  minimal reduction in a scratch worktree — full evidence in
  `docs/notes/2609151_cli_stack_overflow_debug_log.md`):** the crash is
  TypeScript's structural/variance relation checker (`structuredTypeRelatedTo`;
  the repeating `outofbandVarianceMarkerHandler` frames are a V8
  closure-naming artifact of that function's per-call variance-wrapper, not
  a distinct recursing function — confirmed by reading the TS compiler
  source) recursing while comparing `command.ts`'s `CommandImpl` class
  against the self-referential `Command<Options, HandlerResult>` interface
  (whose own methods return `Command<...>` again). `--generateTrace` showed
  **zero** `recursiveTypeRelatedTo_DepthLimit` events — the native V8 stack
  overflows _before_ TypeScript's own 100-level logical-recursion cap ever
  fires, i.e. each logical level of this specific comparison is extremely
  stack-expensive, not "one level too many."
- **Two ingredients are both load-bearing, confirmed by minimal reduction
  (on/off toggling, both directions):** (1) the explicit `implements
Command<Options, HandlerResult>` clause plus the explicit `Command<...>`
  return-type annotations on `CommandImpl`'s `meta`/`option`/`handle` and
  the `command()` factory, which force the expensive structural comparison;
  and (2) `type-fest`'s `CamelCase<N>` mapped over the recursive
  `Command.option()` return type / `ExtendedOptions`. Removing either
  ingredient alone (with the other left intact) makes the crash disappear.
  `ts-pattern`'s exhaustive-match inference was **not** a contributor — the
  crash occurs while checking `command.ts`, confirmed by `--generateTrace`,
  before the checker ever reaches `program.ts` (the only file importing
  `ts-pattern`).
- **Chosen fix: remove ingredient (1), not ingredient (2).** `CamelCase<N>`
  is load-bearing for the _public_ API (see new Out-of-scope bullet); the
  explicit `implements`/return-type annotations on the internal
  `CommandImpl` class are not part of the public API surface — the
  exported `Command` interface (`command.types.ts`) stays exactly as-is for
  consumers, only `CommandImpl`'s internal annotations change, relying on
  TypeScript's normal inference instead of an explicit,
  eagerly-cross-checked interface implementation. Confirmed by minimal
  reduction in a scratch worktree (`docs/notes/2609151_cli_stack_overflow_debug_log.md`
  §4b): removing these annotations alone made `tsc -p libs/cli/tsconfig.lib.json
--noEmit` complete cleanly. **Not yet confirmed against the real build
  entrypoint (which emits `.d.ts` declaration files, unlike `--noEmit`) or
  against consumer-visible inferred types** — `TS1` below must verify both,
  since declaration emission can trigger different/additional structural
  work than `--noEmit` alone.
- **The lockfile-regeneration part of the originally reported problem is
  already done.** `pnpm-lock.yaml` in this tree is already
  `lockfileVersion: '9.0'`, committed by the migration roadmap's `F1` chunk
  (commit `18d18a5`). No dependency-version change is needed for this fix at
  all — this roadmap's fix is now a source-code change, not a
  `package.json`/`pnpm-lock.yaml` change.
- Do not touch package `version`/`publishConfig` fields (Ask-human tier per
  `AGENTS.md`).
- Do not run `nx release`, `npm publish`, force-push, or tag
  deletion/force-move (Never tier).
- This roadmap is independent of, and must not modify,
  `docs/roadmaps/2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` or its chunks —
  treat that migration as in-flight, orthogonal work.
- Root `package.json`'s `devDependencies` and `packageManager` field are not
  named in `AGENTS.md`'s Ask-human/Never rows (only `nx.json`,
  `tsconfig.base.json`, `.eslintrc.json`, CI workflow, `.npmrc`,
  `.verdaccio/config.yml`, and per-package `version`/`publishConfig` fields
  are) — treated as Open tier for this roadmap. Flagged for reviewer
  double-check since it's an inference, not an explicit line item.

## Acceptance

_Drafted via the specifier role (fallback: `~/.cursor/agents/specifier.md`
read and applied in full) given this is multi-chunk, root-cause-driven work._

### Feature: `cli` build no longer crashes

Scenario A1 — cli build succeeds under the current toolchain
Given the repo's committed `pnpm-lock.yaml` and a fresh `pnpm install`
When the `cli` package's active build entrypoint is run (currently
`pnpm exec nx build cli`)
Then it completes successfully with no `RangeError` / stack-overflow crash

Scenario A2 — fix holds on a pristine checkout, not just a warm cache
Given a pristine checkout (fresh git worktree or `node_modules` removed)
at the fixed commit
When `pnpm install` then the `cli` build is run
Then the build succeeds identically, with no flakiness tied to cache state

Scenario A3 (new 2026-09-15) — build entrypoint actually emits declarations,
not just type-checks
Given the fix removes explicit type annotations rather than bumping a
dependency version
When the `cli` package's real build entrypoint runs (which emits `.d.ts`
declaration files)
Then it succeeds — `tsc --noEmit` succeeding alone is not sufficient
evidence, since declaration emission can trigger different/additional
structural work than `--noEmit`

### Feature: public API shape is unchanged

Scenario A4 (new 2026-09-15) — consumers see the same inferred types as
before the fix
Given the exported `Command` interface (`command.types.ts`) is untouched by
this fix, and only `CommandImpl`'s internal annotations change
When existing consumer-facing tests (`command.test.ts`, `program.test.ts`)
and the emitted `.d.ts` for `cli` are inspected
Then the publicly visible `Command<Options, HandlerResult>` shape,
including `CamelCase`-derived option key casing, is identical to before the
fix — no silent widening/narrowing of consumer-visible types

### Feature: no regression to sibling packages

Scenario B1 — core and irpc still build and test
Given the same fixed toolchain versions
When `build` and `test` targets are run for `core` and `irpc`
Then both succeed, with the same test counts as immediately before this
roadmap's changes

Scenario B2 — example app still builds
Given the fixed toolchain
When the example app's build target is run
Then it succeeds unchanged

### Feature: lockfile and toolchain pinning

Scenario C1 — lockfile is untouched by this fix (revised 2026-09-15)
Given the fix is a source-code change in `libs/cli/src/lib/command.ts`
only, not a dependency-version change
Then `pnpm-lock.yaml` has no diff caused by `TS1`, and remains
`lockfileVersion: '9.x'`

Scenario C2 (only if the `TS2` packageManager-pin chunk is done) —
packageManager pin prevents Corepack auto-inject drift
Given root `package.json` has a pinned `packageManager` field
When `pnpm install` is run cold
Then Corepack does not print the "doesn't define a 'packageManager' field"
message and does not modify `package.json`

### Feature: territory boundaries respected

Scenario D1 — no Ask-human/Never-tier surface touched
Given this roadmap's full diff
Then no package `version`/`publishConfig` fields, `.npmrc`, or
`.verdaccio/config.yml` are modified, and no `nx release`/publish/
force-push/tag-delete command is run

## Protocol

**Pack:** adversaries (coder → reviewer per chunk), unchanged from the
original draft. **Revised 2026-09-15:** even though the fix mechanism
changed from a dependency bump to a source-code annotation removal, this
remains a small, narrow, single-file change with a hard empirical
verification gate (build succeeds + public type shape provably unchanged);
it does not warrant escalating to a heavier pack. If `TS1`'s implementor
finds the narrow fix insufficient or the public API shape check (A4) fails,
stop and return to human — do not expand scope under this pack.

- Chunk order: `TS1` (the actual fix) first; `TS2` (packageManager pin)
  depends on `TS1` only to avoid two chunks both diffing `package.json`
  concurrently — `TS2` is optional/lower-priority and may be deferred or
  dropped by human decision at Executable-approval time without blocking
  `TS1`. Note: as of 2026-09-15 the working tree already has an
  **uncommitted** Corepack-auto-injected `packageManager` field in root
  `package.json` (unrelated to this roadmap, belongs to other in-flight
  work) — `TS2`'s implementor must check current state before assuming the
  field needs adding from scratch.
- This fix targets the TypeScript checker itself, not the invocation
  wrapper — it holds regardless of whether `cli` is built via Nx's
  `@nx/js:tsc` executor (today) or a plain `tsc -p tsconfig.lib.json`
  (planned by the migration roadmap's `B2` chunk, not this one). Read
  Acceptance's "build entrypoint" as whichever is active when a chunk here
  executes.
- Verify commands (exact, from this investigation):
  - `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-<chunk-id> pnpm exec nx build cli --skip-nx-cache`
  - `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-<chunk-id> pnpm exec nx run-many -t build test --skip-nx-cache`
  - `git status --porcelain` before and after every command in this roadmap,
    to catch Corepack's `packageManager` auto-inject drift immediately
    (revert with `git checkout -- package.json` if it reappears outside
    `TS2`'s intentional scope).
- If investigating in a worktree instead of the main tree: create it via
  `git worktree add <path-under-why-ts> <commit>`, always
  `git worktree remove` when done, and set `NX_SOCKET_DIR` to a short
  `/tmp` path to avoid the socket-path-length Nx daemon bug.
- Do not touch `docs/roadmaps/2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md`.
- Read `docs/notes/2609151_cli_stack_overflow_debug_log.md` in full before
  starting `TS1` — it contains the exact commands, evidence, and minimal
  reduction that this chunk's fix is based on.

---

## Human gate / Executable

- [x] User sets this roadmap **Executable** (explicit approval) before any
      implementor executes chunks. **Reset 2026-09-15:** this roadmap's
      Goal, Decisions, Acceptance, and `TS1` were materially revised after
      the original "TypeScript version bump" fix was directly falsified by
      re-testing and a dedicated debug investigation
      (`docs/notes/2609151_cli_stack_overflow_debug_log.md`). The original
      human approval was granted for a dependency-version-bump fix that
      explicitly excluded touching `cli`'s type code; the new fix is a
      targeted source-code change instead. Re-approval is required before
      any implementor executes `TS1` under the revised plan.

_Approved 2026-09-15: this roadmap is execute-ready._

**Draft review record:** reviewer role (fallback: `~/.cursor/agents/reviewer.md`)
ran a critical-review pass on this draft on 2026-09-14 (original
dependency-bump plan). Initial verdict: `revise` — 3 important findings
(checklist gaps around baseline-capture ordering, pristine-checkout
coverage for A2, and peer-dependency-warning capture). All 3 fixed in place
in `TS1`'s checklists at the time; no critical findings; 2 nits noted and
left as-is (Scenario C2 conditional phrasing; `TS2` hash-capture mechanics
already adequately constrained). **This review record predates the
2026-09-15 revision and covered the now-superseded dependency-bump plan** —
it does not cover the revised `TS1` below. A fresh reviewer pass on the
revised `TS1` chunk is required as part of that chunk's own
coder→reviewer cycle (per Protocol) before it can be marked approved; this
is in addition to, not instead of, the human Executable re-approval above.

## Task list

### TS1 — Remove the explicit annotations that trigger the structural-comparison stack overflow

**Status:** pending (reset 2026-09-15; supersedes the prior dependency-bump
attempt, whose Agent log is preserved below for history)

**Depends on:** none

**Files:** `libs/cli/src/lib/command.ts` only (no `package.json`/
`pnpm-lock.yaml` change — this is a source-code fix, not a dependency bump)

#### Implementor checklist

- [ ] Read `docs/notes/2609151_cli_stack_overflow_debug_log.md` in full
      first — in particular §1 (what `outofbandVarianceMarkerHandler`
      actually is), §2 (`--generateTrace` findings), and §4a–§4d (minimal
      reduction) — before making any change
- [ ] Before changing anything, run
      `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-ts1-base pnpm exec nx run-many -t build test --skip-nx-cache`
      against the unmodified tree; record baseline pass/fail and test
      counts for `core`/`irpc`/`cli` (expect `cli:build` to fail with the
      `RangeError`) in this chunk's Agent log — this is the pre-change
      baseline, not reconstructed later from memory
- [ ] In `libs/cli/src/lib/command.ts`, remove the `implements
Command<Options, HandlerResult>` clause from the `CommandImpl` class
      header, and remove the explicit `Command<...>`-typed return-type
      annotations from `CommandImpl`'s `meta()`, `option()`, `handle()`
      methods and from the `command()` factory function, letting
      TypeScript infer each return type instead. Do **not** touch
      `command.types.ts` (the exported `Command` interface, `CamelCase`
      usage, and `ExtendedOptions` must remain byte-for-byte unchanged —
      those are the public API surface and are out of scope per this
      roadmap's Decisions)
- [ ] Run `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-ts1 pnpm exec nx build cli --skip-nx-cache`;
      confirm success with no `RangeError`. This is the real build
      entrypoint (emits `.d.ts`), not `tsc --noEmit` — Acceptance A3
      requires this exact command, not the lighter check the debug
      investigation used
- [ ] Inspect the emitted `.d.ts` for `libs/cli` (build output directory
      per `libs/cli/tsconfig.lib.json`) for the `command()` factory and
      `CommandImpl`'s public methods; confirm the emitted public type
      shape (in particular the `CamelCase`-derived option key casing) is
      unchanged from a `.d.ts` emitted by the pre-change tree — diff the
      two if needed. This satisfies Acceptance A4 (no silent widening/
      narrowing of the public API)
- [ ] Run `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-ts1 pnpm exec nx run-many -t build test --skip-nx-cache`;
      confirm all 4 projects (`core`, `irpc`, `cli`, `example-cli`) succeed;
      compare test counts for `core`/`irpc`/`cli` against the baseline
      captured above and log the comparison. In particular confirm
      `command.test.ts` and `program.test.ts` (the tests that most directly
      exercise `Command`'s inferred/consumer-visible types) pass unchanged
- [ ] Run `git status --porcelain`; confirm only `libs/cli/src/lib/command.ts`
      changed (no Corepack `packageManager` drift, no `pnpm-lock.yaml`
      diff — if either appears, `git checkout -- package.json` /
      investigate before proceeding)
- [ ] Satisfy Acceptance A2 (pristine checkout): in a scratch git worktree
      (`git worktree add <path-under-why-ts> <commit>`, removed when done;
      set `NX_SOCKET_DIR` to a short `/tmp` path), with `node_modules`
      freshly installed, re-run the `cli` build once and confirm it
      succeeds identically
- [ ] If the narrow fix above does not fully resolve the crash, or breaks
      Acceptance A4 (public API shape), **stop and report back — do not
      expand into a broader type redesign** (out of scope per this
      roadmap's Decisions); that would need a fresh human-approved roadmap
- [ ] Do not attempt to fix the pre-existing `core:lint`/`cli:lint`/
      `irpc:lint` ESLint-symlink failures — out of scope, tracked under the
      migration roadmap's `L1` chunk

#### Reviewer checklist

- [ ] Confirm the diff touches only `libs/cli/src/lib/command.ts`, and only
      removes the specific `implements`/return-type annotations described
      above — no other logic change, no change to `command.types.ts` or
      any other file
- [ ] Confirm the Agent log records an actual re-run reproducing the
      `RangeError` pre-fix and its absence post-fix using the real build
      entrypoint (not just `--noEmit`), not asserted from memory
- [ ] Confirm the emitted `.d.ts` comparison (Acceptance A4) actually
      happened with a concrete before/after diff shown or described, not
      just asserted
- [ ] Confirm `core`/`irpc`/`example-cli` build+test evidence is present and
      matches the pre-fix baseline test counts
- [ ] Confirm the pristine-checkout (scratch worktree) verification for
      Acceptance A2 actually happened and the worktree was removed
      afterward, not just asserted
- [ ] Confirm no `version`/`publishConfig`/`.npmrc`/`.verdaccio` files
      touched, no `package.json`/`pnpm-lock.yaml` diff, and the migration
      roadmap file/its chunks are untouched
- [ ] Confirm the implementor did not silently expand scope into a broader
      type redesign if the narrow fix fell short

#### Agent log

2026-09-15 agent (coder): Testing Protocol fix (TypeScript bump). Evidence: baseline recorded (cli:build fails with RangeError as expected). Tested TypeScript 5.6.3, 5.7.3, 5.9.3 with multiple dependency combinations - all failed with RangeError in outofbandVarianceMarkerHandler. Conflict: Protocol decision claims "Verified" to work; direct testing shows bump alone does not fix overflow in this environment (Node v22.15.1). Root cause re-analysis or scope pivot needed. Status: `blocked` pending human clarification.

2026-09-15 orchestrator: Delegated a dedicated pre-roadmap debug investigation (separate from this roadmap's chunk protocol) to confirm root cause with instrumentation before revising this chunk. Evidence: `docs/notes/2609151_cli_stack_overflow_debug_log.md` — confirmed via `--generateTrace`, source inspection, and minimal reduction in a scratch worktree that (1) the TypeScript-bump fix is not viable (re-verified directly), and (2) removing `CommandImpl`'s explicit `implements`/return-type annotations (while leaving `command.types.ts`, `CamelCase`, and the public `Command` interface untouched) removes the crash under `tsc --noEmit`. Revised this roadmap's Goal/Decisions/Acceptance/Protocol/`TS1` accordingly; reset `TS1` to `pending` and the Human gate to unapproved, since the fix mechanism materially changed from the originally-approved plan. Status: roadmap revised, awaiting fresh human Executable approval before execution.

### TS2 — Pin `packageManager` to stop Corepack auto-inject drift

**Status:** pending

**Depends on:** TS1

**Files:** root `package.json` (`packageManager` field only)

#### Implementor checklist

- [ ] Add `"packageManager": "pnpm@10.18.2+sha512.<hash>"` to root
      `package.json`, using the exact value Corepack computes for the pnpm
      version already resolving this workspace's lockfile (do not invent an
      arbitrary version/hash)
- [ ] Run `pnpm install` from a clean state (no env override needed now);
      confirm Corepack no longer prints "doesn't define a 'packageManager'
      field" and does not further modify `package.json`
- [ ] Re-run `NX_SOCKET_DIR=/tmp/nx-ts2 pnpm exec nx build cli --skip-nx-cache`
      and `NX_SOCKET_DIR=/tmp/nx-ts2 pnpm exec nx run-many -t build test --skip-nx-cache`;
      confirm still green
- [ ] Confirm `pnpm-lock.yaml` has no dependency-resolution diff from this
      chunk alone (a `packageManager` pin should not change resolution)

#### Reviewer checklist

- [ ] Confirm the pinned version matches the pnpm version this sandbox/CI
      actually uses (10.18.2), not an arbitrary choice
- [ ] Confirm `pnpm-lock.yaml` diff (if any) is unrelated/empty
- [ ] Confirm this doesn't conflict with an assumption in the migration
      roadmap's later chunks (e.g. `C1`/CI) — flag rather than guess if
      unsure

#### Agent log

---
