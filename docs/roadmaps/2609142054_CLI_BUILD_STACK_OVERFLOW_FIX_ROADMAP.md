# Fix `cli` build stack overflow (TypeScript variance-checker crash) — Task Map

## Goal (locked)

`libs/cli`'s build (currently `pnpm exec nx build cli`; the invocation mechanism
may change later under the in-flight pnpm migration, see Decisions) succeeds
reliably in this environment, with no `RangeError: Maximum call stack size
exceeded` from TypeScript's checker, and without breaking `core`/`irpc`/
`example-cli` builds or tests. The fix is a minimal, root-caused dependency
version change, not a workaround or a rewrite of `cli`'s types. Root cause is
confirmed by direct reproduction (see Decisions/Evidence), not hypothesis.

**Out of scope:**

- `docs/roadmaps/2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` and its chunks —
  do not touch that roadmap, its files list, or its Agent logs. This roadmap
  is orthogonal and must not modify it.
- The `core:lint`/`cli:lint`/`irpc:lint` ESLint-symlink-resolution regression
  (pre-existing, caused by the migration's F1 chunk creating real
  `node_modules`; tracked under that roadmap's own `L1` chunk).
- Refactoring `libs/cli`'s recursive generic types (command/option parsing
  generics). Not needed — the confirmed fix is a compiler-version bump, and
  a type-level rewrite would be higher-risk/higher-diff for no benefit.
- Package `version`/`publishConfig` fields, `.npmrc`, `.verdaccio/config.yml`.
- `nx release`, `npm publish`, force-push, tag deletion/force-move (Never
  tier per `AGENTS.md`).

## Decisions (locked)

- **Root cause (confirmed by direct reproduction, not hypothesis):**
  TypeScript 5.5.4's type-relation variance checker
  (`outofbandVarianceMarkerHandler`) overflows Node's call stack when
  type-checking `libs/cli`'s recursive command/option generics _combined
  with_ the extra recursion depth of `type-fest@4.41.0` + `ts-pattern@5.9.0`
  — the versions a modern (`lockfileVersion: '9.0'`) pnpm lockfile resolves
  to. The old (`lockfileVersion: '6.0'`) lockfile had pinned the older
  `type-fest@4.25.0` + `ts-pattern@5.3.1`, which stayed under the recursion
  budget. **Neither library alone crosses the threshold** — pinning either
  one back down alone was independently sufficient to fix the crash in
  testing, meaning the two newer versions' added type-check depth is
  additive/cumulative against a shared TypeScript 5.5.4 stack budget, not a
  single-library defect.
- **Chosen fix: bump the `typescript` devDependency, not pin
  `type-fest`/`ts-pattern` backward.** Verified: TypeScript 5.6.3, 5.7.3,
  5.8.3, and 5.9.2 all build `cli` successfully with `type-fest@4.41.0` +
  `ts-pattern@5.9.0` (current latest-resolvable versions) left untouched.
  Pinning the two libraries backward instead would only defer the same
  crash to the next routine dependency bump; bumping the compiler is the
  durable fix. `~5.5.4` is the final `5.5.x` patch release (no `5.5.5`+
  exists on npm), so no smaller in-range bump is possible — a minor bump is
  required either way.
- **Minimal verified bump: `typescript` `~5.5.4` → `~5.6.3`.** Chosen over
  jumping straight to latest (5.9.x) to keep the diff as small as possible
  while still fixing the crash; full `build`+`test` across all 4 projects
  (`core`, `irpc`, `cli`, `example-cli`) was re-verified clean at 5.6.3.
- **The lockfile-regeneration part of the originally reported problem is
  already done.** `pnpm-lock.yaml` in this tree is already
  `lockfileVersion: '9.0'`, committed by the migration roadmap's `F1` chunk
  (commit `18d18a5`). This roadmap does not need a distinct
  "regenerate the lockfile" chunk — `pnpm install` after the `typescript`
  version bump updates the lockfile as a side effect of `TS1`.
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

Scenario C1 — lockfile stays in modern format with no further drift
Given `pnpm install` has been run with the fixed toolchain
Then `pnpm-lock.yaml` remains `lockfileVersion: '9.x'` and committed, with
no format churn on repeat installs

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

**Pack:** adversaries (coder → reviewer per chunk). Small, focused,
root cause already empirically confirmed with a working fix in hand; no
architecture/module-boundary work, no multi-stage hardening lane needed —
the build+test re-run itself is the verification gate.

- Chunk order: `TS1` (the actual fix) first; `TS2` (packageManager pin)
  depends on `TS1` only to avoid two chunks both diffing `package.json`
  concurrently — `TS2` is optional/lower-priority and may be deferred or
  dropped by human decision at Executable-approval time without blocking
  `TS1`.
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

---

## Human gate / Executable

- [ ] User sets this roadmap **Executable** (explicit approval) before any
      implementor executes chunks.

_Until this checkbox is explicitly approved by the user, this roadmap is
draft-only — not execute-ready._

**Draft review record:** reviewer role (fallback: `~/.cursor/agents/reviewer.md`)
ran a critical-review pass on this draft on 2026-09-14. Initial verdict:
`revise` — 3 important findings (checklist gaps around baseline-capture
ordering, pristine-checkout coverage for A2, and peer-dependency-warning
capture). All 3 fixed in place in `TS1`'s checklists above; no critical
findings; 2 nits noted and left as-is (Scenario C2 conditional phrasing;
`TS2` hash-capture mechanics already adequately constrained). Review green
does **not** imply Executable — human gate above still applies.

## Task list

### TS1 — Bump TypeScript to fix the cli build stack overflow

**Status:** pending

**Depends on:** none

**Files:** root `package.json` (`typescript` devDependency only),
`pnpm-lock.yaml` (regenerated by `pnpm install`, not hand-edited)

#### Implementor checklist

- [ ] Before changing anything, run
      `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-ts1-base pnpm exec nx run-many -t build test --skip-nx-cache`
      against the unmodified tree; record baseline pass/fail and test
      counts for `core`/`irpc`/`cli` (expect `cli:build` to fail with the
      `RangeError`) in this chunk's Agent log — this is the pre-change
      baseline, not reconstructed later from memory
- [ ] Change root `package.json`'s `typescript` devDependency from
      `~5.5.4` to `~5.6.3`
- [ ] Run `COREPACK_ENABLE_AUTO_PIN=0 pnpm install` from repo root; do not
      hand-edit `pnpm-lock.yaml`; capture and log in the Agent log any
      peer-dependency warning mentioning `typescript` (e.g. from `@nx/*`
      packages) printed by this install — do not silently ignore one if it
      appears
- [ ] Run `git status --porcelain`; confirm only `package.json` and
      `pnpm-lock.yaml` changed (no Corepack `packageManager` drift — if it
      appears, `git checkout -- package.json` and rerun install with
      `COREPACK_ENABLE_AUTO_PIN=0`)
- [ ] Run `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-ts1 pnpm exec nx build cli --skip-nx-cache`;
      confirm success with no `RangeError`
- [ ] Run `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-ts1 pnpm exec nx run-many -t build test --skip-nx-cache`;
      confirm all 4 projects (`core`, `irpc`, `cli`, `example-cli`) succeed;
      compare test counts for `core`/`irpc`/`cli` against the baseline
      captured above and log the comparison
- [ ] Satisfy Acceptance A2 (pristine checkout): in a scratch git worktree
      (`git worktree add <path-under-why-ts> <commit>`, removed when done;
      set `NX_SOCKET_DIR` to a short `/tmp` path), with `node_modules`
      freshly installed from this chunk's committed `package.json`/
      `pnpm-lock.yaml`, re-run the `cli` build once and confirm it succeeds
      identically
- [ ] Do not attempt to fix the pre-existing `core:lint`/`cli:lint`/
      `irpc:lint` ESLint-symlink failures — out of scope, tracked under the
      migration roadmap's `L1` chunk

#### Reviewer checklist

- [ ] Confirm the diff touches only `package.json`'s `typescript` field and
      `pnpm-lock.yaml` (no unrelated dependency drift)
- [ ] Confirm the Agent log records an actual re-run reproducing the
      `RangeError` pre-fix and its absence post-fix, not asserted from
      memory
- [ ] Confirm `core`/`irpc`/`example-cli` build+test evidence is present and
      matches the pre-fix baseline test counts
- [ ] Confirm the pristine-checkout (scratch worktree) verification for
      Acceptance A2 actually happened and the worktree was removed
      afterward, not just asserted
- [ ] Confirm any `typescript`-related peer-dependency warnings were
      captured and reported, not silently dropped
- [ ] Confirm no `version`/`publishConfig`/`.npmrc`/`.verdaccio` files
      touched, and the migration roadmap file/its chunks are untouched

#### Agent log

---

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
