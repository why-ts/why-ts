# TypeScript v6 upgrade — Task Map

## Goal (locked)

Bump the repo's pinned TypeScript compiler from `~5.5.4` to the latest
TypeScript 6.x release, bump `@typescript-eslint/eslint-plugin` /
`@typescript-eslint/parser` to a compatible v8.x release (v7 does not
support TS 6.x), fix any resulting lint or type-check fallout across the 3
libs (`@why-ts/cli`, `@why-ts/core`, `@why-ts/irpc`) and `examples/cli`, and
get `./scripts/verify.sh` green under the new toolchain. Done looks like:
every package builds, lints, and tests clean on TypeScript 6.x, with any
Ask-human-tier config diffs (`.eslintrc.json`, and `tsconfig.base.json` if
touched) called out for explicit human review.

**Out of scope:**

- Jumping to TypeScript 7.x (npm `latest` dist-tag is actually `7.0.2`; the
  user explicitly wants the v6.x line).
- Reworking the `CamelCase` variance fix from commit `71c2989` unless
  TypeScript 6.0.3 shows a regression. The fix restores the explicit
  `Command` interface return types and uses `CamelCasedKey<in out N, V>`
  with `NoInfer<CamelCase<N>>` to prevent the TS 5.5 variance-checker stack
  overflow. T4 validates that fix under TypeScript 6.0.3.
- Wiring `examples/cli` into a permanent CI/build/typecheck target (already
  an accepted decision from `2609142054_CLI_BUILD_STACK_OVERFLOW_FIX_ROADMAP.md`).
- Any non-devDependency dependency bump (`ts-pattern`, `type-fest`, `zod`,
  etc.) unless a fallout fix strictly requires it.
- Bumping ESLint itself, unless typescript-eslint 8.70.0's peer range
  actually rejects the repo's current `eslint: ~8.57.0` (it doesn't —
  confirmed peer range `^8.57.0 || ^9.0.0 || ^10.0.0`).

## Decisions (locked)

- **Decision:** Target `typescript` version is exactly `6.0.3` (latest 6.x
  release as of authoring; confirmed via `npm view typescript versions`).
  Pin with `~6.0.3` (patch-only drift), matching the existing `~5.5.4`
  tilde convention. Do not use a caret or open range.
- **Decision:** Target `@typescript-eslint/eslint-plugin` /
  `@typescript-eslint/parser` version is `8.70.0` (latest v8.x as of
  authoring; confirmed peer dependency `"typescript": ">=4.8.4 <6.1.0"`
  covers `6.0.3`). Pin with `^8.70.0`, matching the existing `^7.18.0`
  caret convention.
- **Decision:** Commit `71c2989` fixed the variance-checker `RangeError`
  by declaring variance on `CamelCasedKey` and preventing inference into
  type-fest's `CamelCase`. T4 re-tests both the `cli` build and
  `examples/cli` type-check under TS 6.0.3. If the crash returns, diagnose
  whether the failure is in this fix or a TypeScript 6 regression; do not
  make an undirected redesign. Update the existing Human actions row in
  `docs/roadmaps/_index.md` in place: close it if verified fixed, or record
  the specific residual if it still reproduces.
- **Decision:** No changeset is expected for this upgrade (devDependency
  bump only) unless a lib's rebuilt `.d.ts` output actually changes shape
  under TS 6.0.3, in which case the implementor must call that out
  explicitly before the roadmap can be considered done.
- **Decision:** `tsconfig.base.json` is touched **only if** TS 6.0.3
  hard-errors or hard-deprecates something in its current settings
  (e.g. `moduleResolution: "node"`). Do not proactively modernize option
  names as part of this roadmap.
- **Decision:** Per `AGENTS.md`'s territory map, `.eslintrc.json` (and
  `tsconfig.base.json`, if touched) are Ask-human tier. This roadmap
  satisfies that via normal human review of the roadmap's diffs at
  Executable approval and at chunk review time — no extra mechanical gate
  beyond calling the diff out explicitly in the chunk's Agent log line.

## Acceptance

### Feature: TypeScript 6.x upgrade

Scenario A1 — Root pin moved to 6.0.3
Given the workspace root `package.json` currently pins `"typescript": "~5.5.4"`
When the upgrade is applied
Then the root `package.json` pins `"typescript": "~6.0.3"`
And no lib or app declares its own conflicting `typescript` version

Scenario A2 — typescript-eslint bumped to 8.70.0
Given `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` are pinned at `^7.18.0`
When the upgrade is applied
Then both packages are pinned to `^8.70.0`
And `pnpm install` resolves without peer dependency errors against the repo's `eslint: ~8.57.0`

Scenario A3 — Full verify is green
Given the version bumps in A1 and A2 are applied and any fallout is fixed
When `./scripts/verify.sh` is run
Then `pnpm --if-present run lint` exits 0 across `libs` and `examples`
And `pnpm -r --if-present run test` exits 0 for every package
And `pnpm -r --if-present run build` (tsc emit) exits 0 for every published lib

Scenario A4 — No unexplained lint rule regressions
Given `@typescript-eslint` moves from v7 to v8 (a major version with rule/config changes)
When lint runs against `.eslintrc.json`
Then any newly-failing, renamed, or removed rules are either fixed in source or the rule config is adjusted with a one-line rationale recorded in the chunk's Agent log
And no lint rule is silently disabled repo-wide without that rationale

Scenario A5 — Restored `Command` interface types remain stack-safe
Given commit `71c2989` fixes the TS 5.5 variance-checker `RangeError`
When TypeScript is bumped to 6.0.3
Then `pnpm --filter @why-ts/cli build` and `npx tsc -p examples/cli/tsconfig.app.json --noEmit` complete without `RangeError`
And the roadmap records both command outputs
And `docs/roadmaps/_index.md`'s existing Human actions row is closed if both checks pass, or updated in place with a specific remaining failure

Scenario A6 — No unintended change to published `.d.ts` shape
Given the 3 libs are published packages with immutable versions once released
When the libs are rebuilt under TypeScript 6.0.3
Then any observed change in emitted `.d.ts` output is called out explicitly in the relevant chunk's Agent log
And the no-changeset default (see Decisions) is confirmed or overridden with a stated reason

Scenario A7 — Ask-human-tier files are flagged for review
Given `.eslintrc.json` (and `tsconfig.base.json`, if touched) are Ask-human tier per `AGENTS.md`
When the chunk touching either file is completed
Then the diff to that file is called out explicitly in the chunk's Agent log line

## Protocol

**Pack:** two-pack

- No forced separate `cleaner` hop — this is fallout-fixing work driven by
  a tooling bump, not tidy/rename cleanup. Inline coder cleanup only, per
  two-pack default (`coder → reviewer`).
- Order: T1 first. T2a, T2b, and T3 depend on T1; their observed fix
  surfaces are disjoint, so run them in parallel worktrees. T3b depends on
  T3 and fixes the example config. T4 depends on T1, T3, and T3b; the crash
  re-test runs after library and example config fallout is clear. T5 depends
  on T1, T2a, T2b, T3, T3b, and T4.
- If new fallout evidence shows a chunk's fix surface is large (e.g.
  double-digit files) or spans clearly distinct concerns (e.g. unrelated
  error categories or separate libs), split that chunk before proceeding.
  Record the split (or why not) in the roadmap Agent log.
- Verify with `./scripts/verify.sh` (root) after each chunk; this is the
  same command CI (`.github/workflows/ci.yml`) runs, so a green local run
  is trustworthy evidence.
- Commit per approved chunk, per `AGENTS.md` § Done = evidence.

---

## Human gate / Executable

- [x] User sets this roadmap **Executable** (explicit approval) before any
      implementor executes chunks.

_The user approved this roadmap as **Executable**. Chunks may now be executed._

## Task list

### T1 — Bump `typescript` and `@typescript-eslint/*`, produce a fallout report

**Status:** approved

**Depends on:** none

**Files:** `package.json`, `pnpm-lock.yaml`

#### Implementor checklist

- [x] In root `package.json`, set `"typescript": "~6.0.3"` and
      `"@typescript-eslint/eslint-plugin": "^8.70.0"`,
      `"@typescript-eslint/parser": "^8.70.0"`.
- [x] Run `pnpm install`; it exited 0 and regenerated `pnpm-lock.yaml`, resolving TypeScript `6.0.3` and typescript-eslint `8.71.2`. pnpm still reports unmet peer warnings: `tsconfck@3.1.6` declares TypeScript `^5.0.0` (CLI config/tests pass under TS 6; T5 must rerun `./scripts/verify.sh`), and `@swc-node/core@1.15.0` declares `@swc/core >=1.13.3` while `1.7.42` is locked (pre-existing in `HEAD`).
- [x] Run `pnpm --if-present run lint`, `pnpm -r --if-present run build`,
      `pnpm -r --if-present run test` and capture full output. Do **not**
      fix fallout in this chunk — just produce a report (in the Agent log)
      of which files/packages fail and why (lint rule vs. type error vs.
      test failure), so T2a/T2b/T3 know their exact scope.
- [x] Confirm whether the failing files from lint vs. build overlap (needed
      for the Protocol's parallel-vs-sequential call on T2a/T2b/T3).
- [x] Record file/concern counts for the lint-fallout and type-fallout
      surfaces (per-lib breakdown). If either surface is large (e.g. double-
      digit file count) or spans clearly distinct concerns, note in the
      Agent log that T2a, T2b, and/or T3 must be split further before
      proceeding (per Protocol).

#### Reviewer checklist

- [x] `package.json` pins exactly `~6.0.3` / `^8.70.0` per Decisions — no
      open ranges, no stray versions elsewhere.
- [x] `pnpm-lock.yaml` diff is consistent with only these two dependency
      bumps (no unrelated dependency drift smuggled in).
- [x] The fallout report in the Agent log is concrete (file paths + error
      kind), not "some things broke."
- [x] No fallout was fixed in this chunk (scope discipline — that's T2a/T2b/T3).

#### Agent log

<!-- implementor / reviewer append below -->

2026-10-19 agent (T1): Pack: two-pack. Blocked before implementation because uncommitted lockfile and source changes overlapped roadmap Files. Verify commands were not run. No unrelated work was changed. Status: blocked.

2026-10-19 agent (T1): Resumed after user-directed cleanup; form files, lockfile additions, and supporting Core export removed. Evidence: `pnpm --if-present run lint` fails at `libs/irpc/src/lib/irpc.types.ts:196` (`type Empty = ;`). Preserved the user edit; T1 will report it as pre-existing fallout. Status: in_progress.

2026-10-19 agent (T1): Bumped the root toolchain and captured fallout without source fixes. Evidence: `package.json`, `pnpm-lock.yaml`, and commands below. Status: in_progress.

**Dependency resolution**

- `pnpm install`: exit 0; resolved TypeScript `6.0.3`, typescript-eslint plugin/parser `8.71.2` within `^8.70.0`.
- The typescript-eslint peer ranges accept ESLint `8.57.1` and TypeScript `6.0.3`; no peer error names ESLint.
- `pnpm install` reported unmet peer warnings. `tsconfck@3.1.6` declares TypeScript `^5.0.0`, but the CLI's Vite config loads `tsconfigPaths()` from `vite-tsconfig-paths` (`libs/cli/vite.config.ts:3,9`), whose lockfile graph includes `tsconfck@3.1.6`; the CLI suite passed 54 tests under TypeScript `6.0.3`, exercising that config path. This verifies runtime use, not the declared peer range; T5 must rerun `./scripts/verify.sh`. `@swc-node/core@1.15.0` declares `@swc/core >=1.13.3`, while `1.7.42` is locked. This warning is pre-existing: `git show HEAD:pnpm-lock.yaml` contains both the peer range and locked `@swc/core 1.7.42`. Neither warning prompted a dependency change.
- Lockfile direct importer changes are limited to the three requested pins and their TypeScript peer references. Remaining lockfile edits replace/remove typescript-eslint v7 transitive graph entries; no unrelated direct dependency versions drifted.

**Declared command results**

- `pnpm --if-present run lint`: exit 1; 2 errors and 36 warnings. Current errors: `libs/core/src/lib/promise-trigger.ts:38`, `@typescript-eslint/no-unused-expressions`; `libs/irpc/src/lib/irpc.types.ts:196`, parse error `Type expected` from the pre-existing user edit `type Empty = ;`. The IRPC error is not TS6 fallout.
- Lint warnings: 36 across 14 warning-bearing files (29 `no-explicit-any`, 7 `no-unused-vars`). By area: `examples/cli` 1 warning / 1 file; `libs/cli` 22 / 6; `libs/core` 4 / 3; `libs/irpc` 9 / 4. Warning files: `examples/cli/src/prompt-test/handler.ts`; `libs/cli/src/lib/command.types.ts`, `libs/cli/src/lib/config/program-help-formatter.default.ts`, `libs/cli/src/lib/config/program-help-formatter.ts`, `libs/cli/src/lib/option.types.ts`, `libs/cli/src/lib/program.ts`, `libs/cli/src/lib/program.types.ts`; `libs/core/src/lib/drill.ts`, `libs/core/src/lib/peek.ts`, `libs/core/src/lib/promise-trigger.ts`; `libs/irpc/src/lib/irpc.proxy.ts`, `libs/irpc/src/lib/transport/post-message-base.transport.ts`, `libs/irpc/src/lib/transport/transferer.ts`, `libs/irpc/src/lib/transport/worker-self.transport.ts`. The pre-bump evidence reports 34 warnings; its per-file breakdown is unavailable, so the 2-warning count difference is not attributed to TS6.
- `pnpm -r --if-present run build`: exit 2. `pnpm --filter @why-ts/cli build` and `pnpm --filter @why-ts/core build` each exit 2 with TS5101 (`baseUrl` deprecated) and TS5107 (`moduleResolution=node10` deprecated), reported from `tsconfig.lib.json:3`. Both originate from the shared options in `tsconfig.base.json`. `pnpm --filter @why-ts/irpc build` exits 2 with TS1110 at `libs/irpc/src/lib/irpc.types.ts:196`; this is the pre-existing syntax edit. Build fallout for T3 is 2 options in 1 shared config file, affecting CLI and Core.
- `pnpm -r --if-present run test`: exit 1. CLI passes 54 tests in 2 files; Core has no test files and exits 0; IRPC fails to transform `src/lib/irpc.spec.ts` because `libs/irpc/src/lib/irpc.types.ts:196` contains the preserved `type Empty = ;` syntax error. No test assertion failed. A fresh `COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/cli test` also exited 0 with all 54 tests passing under TS 6.

**Overlap and chunk sizing**

- The initial main-tree lint run had a user syntax error at `libs/irpc/src/lib/irpc.types.ts:196`; that parser error masked two additional v8 errors later in the same file.
- A clean T2 worktree exposed the removed `@typescript-eslint/ban-types` directive at line 109 and `no-empty-object-type` at line 110. The Core `no-unused-expressions` error is in a separate file and concern.
- Protocol split the lint work into T2a (Core) and T2b (IRPC). Both are disjoint from T3's shared `tsconfig.base.json` fallout and may run in parallel. No further split is indicated within each chunk. Existing warnings are not confirmed new fallout; the pre-bump baseline reported 34 warnings.

2026-10-19 coder (T1 reviewer revision): Removed the duplicated trailing checklist fragment. Classified the `@swc-node/core` peer warning as pre-existing from `git show HEAD:pnpm-lock.yaml`. Verified the `tsconfck`-backed CLI config path with `COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/cli test` (exit 0; 54/54 tests); the recursive test command remains exit 1 only because the preserved IRPC edit fails to parse. Assign T5 to rerun `./scripts/verify.sh` and report the result. If that gate exposes a TS 6 compatibility failure, request human scope guidance before changing unrelated dependency pins. No selected versions or dependency pins changed. Status: in_progress.

2026-10-19 agent (T1 reviewer): Verdict: approve. Independently checked exact pins, lockfile scope, fallout evidence, and no fallout fixes. Residuals: `tsconfck` declares a TS5 peer range despite passing CLI tests under TS6; T5 will rerun full verify. The SWC peer warning predates T1. The preserved IRPC user edit still prevents recursive builds/tests. Status: approved.

2026-10-19 agent (T1): Commit `d6e7f0c` records the approved dependency bump and fallout report. Status: approved.

2026-10-19 agent (T1 supplemental): Clean T2 worktree exposed two IRPC v8 lint errors at lines 109–110, masked by the preserved user syntax error at line 196 in the main tree. Revised the plan: split lint work into T2a (Core) and T2b (IRPC). T1 remains approved.

---

### T2a — Fix Core lint fallout (typescript-eslint v7→v8)

**Status:** approved

**Depends on:** T1

**Files:** `libs/core/src/lib/promise-trigger.ts`.

#### Implementor checklist

- [x] Resolve the T1-reported `@typescript-eslint/no-unused-expressions` error at line 38 with the smallest behavior-preserving source change.
- [x] Run `pnpm --if-present run lint` and confirm this Core error is gone; record any independent T2b errors still present.
- [x] Run `./scripts/verify.sh` per project Protocol. If it stops on pending T2b fallout, record that evidence without editing T2b files.

#### Reviewer checklist

- [x] The Core no-op expression is removed without changing behavior.
- [x] Changes are limited to the declared Core source file and T2a fallout.
- [x] Lint and verify results distinguish remaining T2b errors from this chunk.

#### Agent log

<!-- implementor / reviewer append below -->

2026-10-19 agent (former T2): Core fix removed the no-op expression, but lint still exited 1 with IRPC errors at lines 109–110. `./scripts/verify.sh` stopped at lint; no approval or commit.
2026-10-19 reviewer (former T2): Revise. The parser error in the main tree masked distinct IRPC lint fallout. Protocol split the Core and IRPC concerns into T2a and T2b.

2026-10-19 agent (T2a fresh coder): Removed the standalone `Promise.allSettled;` no-op expression; no trigger logic changed. Evidence: `pnpm --if-present run lint` exits 1 with 2 errors, both in pending T2b `libs/irpc/src/lib/irpc.types.ts` lines 109–110; Core's prior `no-unused-expressions` error is absent. `./scripts/verify.sh` exits 1 at its lint step on those same T2b errors, so tests/build did not run. Did not edit IRPC or config. Status: in_progress.

2026-10-19 reviewer (T2a): Verdict: approve. Confirmed only the Core no-op expression was removed; target lint passes. Residual: global lint/verify awaits T2b; two pre-existing `no-explicit-any` warnings remain. Status: approved.

2026-10-19 agent (T2a): Commit `f619093` records the approved Core lint fix. Status: approved.

---

### T2b — Fix IRPC lint fallout (typescript-eslint v7→v8)

**Status:** approved

**Depends on:** T1

**Files:** `libs/irpc/src/lib/irpc.types.ts`.

#### Implementor checklist

- [x] Resolve the removed `@typescript-eslint/ban-types` inline directive and the `no-empty-object-type` error at lines 109–110 while preserving the intended type semantics.
- [x] Run `pnpm --if-present run lint`; record this file's result and any independent T2a error still present.
- [x] Run `./scripts/verify.sh` per project Protocol. If it stops on pending T2a fallout, record that evidence without editing T2a files.

#### Reviewer checklist

- [x] Both v8 lint errors are resolved without weakening the type contract.
- [x] No lint rule is silently disabled repo-wide; any config change has a one-line rationale.
- [x] Changes are limited to the declared IRPC source file and T2b fallout.

#### Agent log

<!-- implementor / reviewer append below -->

2026-10-19 agent (T2b scope): Clean T2 worktree exposed the obsolete directive and `no-empty-object-type` errors at lines 109–110. This chunk isolates that IRPC concern.
2026-10-19 agent (T2b): Replaced `{}` with `NonNullable<unknown>` to preserve the non-nullish event payload domain and removed the obsolete directive. Evidence: targeted ESLint exit 0 (0 errors, 4 existing warnings); full lint exit 1 with only the separate T2a error at `libs/core/src/lib/promise-trigger.ts:38`; `./scripts/verify.sh` exit 1 at lint with the same T2a error. Status: in_progress.

2026-10-19 reviewer (T2b): Verdict: approve. Type check confirms `NonNullable<unknown>` preserves non-nullish semantics; targeted lint passes. Residual: after T3 fixes, compare emitted IRPC declarations and record Acceptance A6/changeset disposition; current build stops at TS5101/TS5107. Status: approved.

2026-10-19 agent (T2b): Commit `903be86` records the approved IRPC lint fix. Status: approved.

---

### T3 — Fix type-check/build fallout (TypeScript 5.5 → 6.0.3)

**Status:** approved

**Depends on:** T1

**Files:** `libs/*/src/**`, `libs/*/tsconfig*.json` as strictly needed,
`tsconfig.base.json` (Ask-human tier — only if TS 6.0.3 forces a change;
call out diff explicitly if touched).

#### Implementor checklist

- [x] Fix every new type-check/build failure identified in T1's report
      across `libs/cli`, `libs/core`, `libs/irpc`.
- [x] Touch `tsconfig.base.json` only if TS 6.0.3 hard-errors or
      hard-deprecates a current setting (e.g. `moduleResolution: "node"`).
      If touched, keep the change minimal and record the exact error that
      forced it.
- [x] Preserve unrelated TypeScript diagnostics. Do not apply broad
      `ignoreDeprecations: "6.0"` without an independent guard for TS2880;
      the reviewer reproduced that it suppresses the import-assertion error.
- [x] Re-run `pnpm -r --if-present run build` until it exits 0 for all 3
      libs.
- [x] Check each lib's emitted `.d.ts` (`dist/libs/*/src/index.d.ts` or
      equivalent) for any shape change vs. before the bump. Record findings
      per Acceptance A6 (changeset decision).
- [x] If `tsconfig.base.json` was touched, explicitly flag that diff in the
      Agent log per Acceptance A7.

#### Reviewer checklist

- [x] `tsconfig.base.json` untouched unless the Agent log states the exact
      TS 6.0.3 error that forced the change.
- [x] The config does not suppress unrelated diagnostics such as TS2880; if
      a broad ignore is unavoidable, an independent guard is verified.
- [x] `.d.ts` shape-change finding (or "no change") is recorded per
      Acceptance A6, with a stated changeset decision.
- [x] Fixes are scoped to type-check/build fallout only (no drive-by lint
      changes that belong to T2a/T2b).

#### Agent log

<!-- implementor / reviewer append below -->

2026-10-19 agent (T3 first attempt): `ignoreDeprecations: "6.0"` cleared TS5101/TS5107; recursive build passed and declarations matched TS5.5.4 (CLI 27, Core 7, IRPC 12). `./scripts/verify.sh` stopped at T2 lint. Not approved.
2026-10-19 reviewer (T3): Revise. A TypeScript API check showed the broad setting also suppresses TS2880 for import assertions; preserve TS2880 with narrower config or an independently verified guard. No commit.
2026-10-19 coder (T3 fresh attempt): Set paired `module: "Node16"` / `moduleResolution: "Node16"` in each library build config; all three package manifests declare `type: commonjs`, and emitted entry files are CommonJS. T1 reported TS5101 for the explicit `baseUrl` and TS5107 for `moduleResolution: "node"`; removed `baseUrl` from `tsconfig.base.json` and replaced the library-build resolution with paired Node16 settings. Prefixed `paths` targets with `./` after TS6 reported TS5090 for non-relative path values without `baseUrl`. `pnpm -r --if-present run build` exits 0 for CLI, Core, and IRPC. No `ignoreDeprecations` was added, so TS2880 is not suppressed. TS5.5.4 baseline comparison found no missing or changed declarations: CLI 27, Core 7, IRPC 12; no changeset is needed. `./scripts/verify.sh` exits 1 at lint with 3 concurrent T2 errors (Core `promise-trigger.ts:38`; IRPC `irpc.types.ts:109-110`) and 40 warnings; it stopped before tests/build, and no lint changes were made. Ask-human: `tsconfig.base.json` changed to remove `baseUrl` and adjust `paths`. Residual: shared `moduleResolution: "node"` remains for configs outside the three library build configs; T4's example check may need a separately scoped follow-up. Status: in_progress.

2026-10-19 reviewer (T3): Verdict: approve. Independently verified all three library builds, path aliases, CommonJS emit, and unchanged declarations. Residual: `examples/cli` inherits deprecated `moduleResolution: node10`; `pnpm exec tsc -p examples/cli/tsconfig.app.json --noEmit` exits 2 with TS5107, blocking T4's variance check until addressed. Full verify awaits T2a/T2b. Status: approved.

2026-10-19 agent (T3): Commit `7a68987` records the approved library config changes. Status: approved.

---

### T3b — Update the CLI example config for TypeScript 6

**Status:** approved

**Depends on:** T3

**Files:** `examples/cli/tsconfig.app.json`.

#### Implementor checklist

- [x] Resolve TS5107 in the example config with nondeprecated paired module/resolution settings; preserve CommonJS behavior.
- [x] Run `npx tsc -p examples/cli/tsconfig.app.json --noEmit` under TypeScript 6.0.3. Confirm the checker reaches the source and record type/RangeError results.
- [x] Run `./scripts/verify.sh` per project Protocol and record the full result.

#### Reviewer checklist

- [x] The example type-check no longer fails with TS5107 and reaches the intended TypeScript checks.
- [x] The module/resolution pair preserves the existing CommonJS runtime intent.
- [x] Changes stay within the declared example config and T3b fallout.

#### Agent log

<!-- implementor / reviewer append below -->

2026-10-19 agent (T3b scope): T3 review found the example app still inherits deprecated `moduleResolution: node10`; T4 cannot test the variance fix until TS5107 is removed.

2026-10-19 agent (T3b): Set paired `module: Node16` and `moduleResolution: Node16`; `examples/cli/package.json` has no `type: module`, preserving CommonJS intent. Evidence: `pnpm exec tsc -p examples/cli/tsconfig.app.json --noEmit` on TypeScript 6.0.3 exits 0 with no type errors or RangeError; `./scripts/verify.sh` exits 0 (lint: 0 errors, 40 warnings; tests: 61 passed, 0 failed; Core has no test files; CLI, Core, and IRPC builds passed). Status: in_progress.

2026-10-19 reviewer (T3b): Verdict: approve. Independently confirmed paired Node16 settings, CommonJS intent, example type-check, and full verify. Residuals: 40 lint warnings and existing Vite/Vitest notices. Status: approved.
2026-10-19 agent (T3b): Commit `3e567ef` records the approved CLI example config change. Status: approved.

---

### T4 — Verify the `Command` variance fix under TS 6.0.3

**Status:** pending

**Depends on:** T1, T3, T3b

**Files:** none expected (evidence-gathering only); `docs/roadmaps/_index.md`
if the existing Human actions row needs closing or updating.

#### Implementor checklist

- [ ] After T3 and T3b have landed, run `pnpm --filter @why-ts/cli build`
      and `npx tsc -p examples/cli/tsconfig.app.json --noEmit` under TS 6.0.3.
      Confirm neither crashes with `RangeError`; the `Command` annotations
      must remain explicit.
- [ ] Record each exact command and its result in the Agent log, including
      any type errors separate from stack-overflow failures.
- [ ] Update the existing `docs/roadmaps/_index.md` Human actions row in
      place: close it if both checks pass, or state the concrete residual
      if either fails. Do not duplicate the row.
- [ ] Do not redesign the type fix without evidence that TS 6.0.3 regresses
      it (Decisions).

#### Reviewer checklist

- [ ] Both checks have concrete, reproducible command/result evidence.
- [ ] `_index.md` was updated in place (row closed if resolved, otherwise
      updated with the specific residual; no duplicate row).
- [ ] `Command` interface return annotations remain restored; any change to
      `CamelCasedKey` is tied to a reproduced TS 6.0.3 failure.

#### Agent log

<!-- implementor / reviewer append below -->

---

### T5 — Full verify sweep and roadmap close-out

**Status:** pending

**Depends on:** T1, T2a, T2b, T3, T3b, T4

**Files:** none expected beyond this roadmap file and, if not already done
in T4, `docs/roadmaps/_index.md`.

#### Implementor checklist

- [ ] Run `./scripts/verify.sh` end-to-end from a clean state and confirm
      it exits 0 (Acceptance A3).
- [ ] Confirm every prior chunk's Ask-human-tier diff (`.eslintrc.json`,
      `tsconfig.base.json` if touched) is clearly flagged for the human,
      either in this chunk's Agent log or by reference to T2a/T2b/T3 logs.
- [ ] Confirm the changeset decision from T3 (Acceptance A6) is final and
      consistent (no changeset added unless `.d.ts` shape changed).
- [ ] After T2b, compare IRPC declarations against the TS5.5.4 baseline and
      record whether `NonNullable<unknown>` changes the public shape/changeset decision.
- [ ] Re-run `./scripts/verify.sh` and record whether the `tsconfck` TypeScript
      peer warning affects the tested `vite-tsconfig-paths` path; seek human
      scope guidance before changing unrelated dependency pins if it fails.
- [ ] Move this roadmap to `docs/roadmaps/_archive.md` per the project's
      roadmap lifecycle, once all chunks are approved.

#### Reviewer checklist

- [ ] `./scripts/verify.sh` was actually run (not claimed) — evidence in
      Agent log.
- [ ] All Acceptance scenarios (A1–A7) are traceable to a specific chunk's
      Agent log entry.
- [ ] Archive move is correct and `_index.md` no longer lists this roadmap
      under Ready/Not Ready/Blocked.

#### Agent log

<!-- implementor / reviewer append below -->

---
