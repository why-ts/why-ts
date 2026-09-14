# Replace Nx with pnpm + Changesets (migration) — Task Map

## Goal (locked)

`why-ts` is an Nx monorepo of 3 published TypeScript libraries (`@why-ts/cli`, `@why-ts/core`, `@why-ts/irpc`; `irpc` depends on `core`) plus one non-published example app (`examples/cli`). Stakes: production, packages public, published versions immutable. Replace all Nx tooling (build/test/lint/release/task-orchestration) with plain pnpm-workspace-based tooling: `pnpm-workspace.yaml` for real workspace linking, per-package `tsc` builds (no new bundler for the 3 libs), direct Vitest (Jest is already fully dead — confirmed no project has a `jest.config.*`; drop it), direct ESLint (drop the Nx module-boundary rule, confirmed a no-op today: `allow: [], onlyDependOnLibsWithTags: ["*"]`), and Changesets (`@changesets/cli`) replacing `nx release` for independent per-package versioning/changelogs. Preserve: independent per-package npm publishing under `@why-ts` scope, public access, existing package behavior/APIs, an equivalent CI + `scripts/verify.sh` signal.

This roadmap covers migration only — it proves the new pipeline works end-to-end while Nx remains installed (unused) as a safety net. A separate roadmap (`NX_TEARDOWN`) physically deletes Nx once this is merged and baked in on `main`.

**Out of scope:** package public APIs/behavior/inter-lib dependency graph (aside from wiring `@why-ts/core` via `workspace:*` instead of the current hardcoded `"0.0.1"` pin); renaming/moving source dirs; `publishConfig.access` (stays public); introducing a bundler (tsup/esbuild) for the 3 published libs; introducing Turborepo or any task-graph/cache tool (CI and local both run full `pnpm -r` every time, always, no affected-only fast path — explicitly accepted tradeoff, see Decisions); the real `npm publish` (stays human-only per `AGENTS.md`, unaffected); physically deleting Nx files/packages (that's the separate `NX_TEARDOWN` roadmap).

## Decisions (locked)

- Module format: unchanged. All three libs already set `"module": "commonjs"` explicitly in their `tsconfig.json` (verified in `libs/{cli,core,irpc}/tsconfig.json`), matching their `"type": "commonjs"` `package.json`. The plain-`tsc` build must keep emitting CJS — this is a preserve, not a migration.
- Output layout: today's `@nx/js:tsc`-built `dist/libs/<pkg>/` preserves the `src/` segment (confirmed by the committed `package.json`'s `"main": "./src/index.js"`, `"typings": "./src/index.d.ts"`, which only resolve correctly under that layout). Chunk `B1` must first run `pnpm exec nx build core` once and inspect the real `dist/libs/core/` output as ground truth, then make the plain-`tsc` build match it bit-for-bit, rather than assuming the layout.
- No `pnpm-workspace.yaml` exists today (confirmed) — the repo is currently a single flat pnpm package with 4 separate `package.json` files that Nx reads directly as metadata; `pnpm --filter`/`pnpm -r` do not work until `F1` creates it. This makes `F1` a hard predecessor of every other chunk in this roadmap except nothing — see Protocol dependency order.
- Dependency resolution model: today neither build nor test reads a sibling's compiled output — both resolve `@why-ts/core` straight to TS source via `tsconfig.base.json` path aliases (confirmed: no `dependsOn` is set on the vite-inferred `test` target in `nx.json`). This roadmap keeps that model for tests (via a standalone `vite-tsconfig-paths` plugin, replacing Nx's `nxViteTsPaths()`), but introduces a **real** `pnpm` topological build order for `pnpm -r run build` once `libs/irpc/package.json` depends on `@why-ts/core` via `workspace:*` (pnpm's recursive `run` respects workspace dependency order by default) — this is a genuine (small, low-risk) behavior change from "builds are independent" to "irpc's build step runs after core's," and is called out explicitly rather than left implicit. Chunk `B2` must prove this causally (see Acceptance), not just cite pnpm's documented default.
- Changesets dependent-bump cascade: accepted. Bumping `core` will trigger Changesets' default patch-bump + changelog entry for `irpc` (since it depends on `core` via `workspace:*`) to keep its declared dependency range correct; `cli` is unaffected (no internal dependency). This is standard Changesets behavior for workspace dependents, not a bug to suppress.
- `workspace:*` must never reach a published tarball: Changesets/`pnpm publish` rewrite `workspace:*` to the real resolved semver before publish — this is pnpm's built-in behavior, not something this roadmap implements, but chunk `R2`'s dry-run must explicitly assert the _published_ `package.json` (fetched back from the local registry) contains a real version string, not the literal `workspace:*`.
- `@nx/dependency-checks` ESLint rule (checks `package.json` deps match actual source imports; active today in all three `.eslintrc.json` — distinct from the no-op module-boundary rule): dropped, no replacement. Accepted minor coverage loss; revisit only if it causes a real incident (e.g. a missing dependency shipped in a release).
- Verdaccio local registry: not a new safety net. Root `project.json` already has a `local-registry` target using the `@nx/js:verdaccio` executor as a manual dev tool (start a local registry, then manually exercise a real publish against it before trusting a real release). Chunk `R2` re-hosts that exact existing manual workflow on the plain `verdaccio` CLI; it is not inventing new CI-enforced verification.
- `examples/cli` drops out of CI/build coverage: it is a non-published manual demo (no tests exist for it — confirmed, only `main.ts` + a `prompt-test/` dir). Chunk `E1` only needs to preserve its manual runnability (`node -r @swc-node/register` pattern, already used by its Nx `eval` target, so `@swc-node/register`/`@swc/core`/`@swc/helpers` are genuinely used and must be kept, not removed as "dead Nx weight"); it does not need a `build` script, so `pnpm -r --if-present run build` will silently skip it. This is an accepted reduction in CI surface (today Nx's `nx affected -t build` does bundle it via `@nx/esbuild`).
- Rollback: no extra git tag is added. Adding a tag risks confusion with the git-tag-based release version history, which `docs/MENTAL_MODEL.md` marks human-only to change. Instead, every chunk lands as its own commit (already required by `execute-roadmap`'s protocol), so any chunk can be reverted independently if it causes problems after merge.
- Decision record: this migration is recorded at `docs/decisions/0002-nx-to-pnpm-changesets.md` (`0001-cold-run.md` is the only existing record).
- CI runtime tradeoff: CI moves from `nx affected` (changed-projects-only) to always running `pnpm -r` for lint/test/build on every push/PR. Accepted — at 3 packages the affected-only savings are judged negligible, and this removes an entire tool category (task-graph/caching) in service of the Goal.
- Ask-human-tier chunks: `L1` (edits `.eslintrc.json`) and `C1` (edits `.github/workflows/ci.yml`) are explicitly Ask-human tier per `AGENTS.md`'s territory map. They are not "lower risk" just because their diffs are mechanical — flag them for explicit human sign-off before merge, distinct from the six-pack review that also applies to every chunk.
- **AC-W1a narrowing (approved by user 2026-09-14, after F1 was blocked on real evidence):** F1's coder stage found, and the orchestrator independently reproduced, two failures in the original AC-W1a's "Nx's own build/test/lint still passes unchanged" clause: (1) a **real regression** — pnpm's per-package `node_modules` (needed for the `@why-ts/core` symlink itself) breaks ESLint's cwd-relative `.eslintignore` lookup and `irpc`'s `.eslintrc.json` `extends` resolution through the new symlink, so `core:lint`/`cli:lint`/`irpc:lint` all break; the fix is `.eslintrc.json`/`.eslintignore`, Ask-human tier, and exactly `L1`'s job. (2) a **pre-existing, migration-unrelated** failure — `nx build cli` fails with a TypeScript 5.5.4 `RangeError: Maximum call stack size exceeded`, reproduced identically on a pristine pre-F1 checkout with a fresh `pnpm install` (this sandbox's Node/pnpm regenerate the committed `lockfileVersion: '6.0'` lockfile into a newer format that triggers it). Decision: AC-W1a's lint-parity requirement is deferred to `L1` (see AC-L1); Nx build parity is dropped from this roadmap's Acceptance entirely (out of scope — tracked as a separate, human-directed fix roadmap, not gating this migration). AC-W1a itself now only requires the symlink and Nx **test** parity, both of which F1 satisfies (verified: `pnpm exec nx run-many -t test --skip-nx-cache` passes cleanly under F1's diff).

## Acceptance

### Feature: Workspace linking (checked at chunk F1; lint parity deferred to L1 — see AC-W1a narrowing above)

Scenario AC-W1a — real symlink, not a copy
Given `pnpm-workspace.yaml` lists `libs/*` and `examples/*`, and `libs/irpc/package.json` declares `"@why-ts/core": "workspace:*"`
When `pnpm install` runs from repo root
Then `readlink -f libs/irpc/node_modules/@why-ts/core` resolves to `libs/core` (a real symlink, not a hoisted copy), and Nx's own **test** target (`pnpm exec nx run-many -t test`) still passes unchanged, proving the workspace-linking half of this chunk is purely additive. (Nx **lint** parity is not required here — see `L1`/AC-L1; Nx **build** parity is not required anywhere in this roadmap — see Decisions.)

### Feature: Per-package build (checked at chunks B1/B2)

Scenario AC-B1 — build output layout and module format match today's Nx build
Given the ground-truth layout captured by running `pnpm exec nx build core` once before any change
When `pnpm --filter @why-ts/core build` runs after migration
Then `dist/libs/core/` contains exactly `src/index.js`, `src/index.d.ts`, `package.json` (unmodified `main`/`typings` fields, both resolving to real files), and `README.md`; `src/index.js` is CommonJS (`require`/`module.exports`, not `import`/`export`); `node -e "require('./dist/libs/core')"` succeeds from that directory

Scenario AC-B2 — irpc build order is causally proven, not assumed
Given `libs/irpc/package.json` depends on `@why-ts/core` via `workspace:*`
When `pnpm -r run build` runs from repo root
Then log output shows `core`'s build completing before `irpc`'s build starts; AND, as causal proof (not just citing pnpm's documented default behavior), a temporarily-induced build error in `core` causes `irpc`'s build to fail or never start when `pnpm -r run build` reruns — the induced error is then reverted; `irpc`'s own compiled output still resolves `@why-ts/core` types via the `tsconfig.base.json` path alias at compile time (unchanged from today), not via `core`'s `dist` output

### Feature: Test parity (checked at chunk T2, before C1)

Scenario AC-T1 — no silent test-count regression
Given a recorded baseline: `pnpm exec nx run-many -t test` test-file and test-case counts per package, captured before chunk T1 starts and written into that chunk's Agent log
When `pnpm --filter <pkg> test` runs after T1/T2, for each of `core`, `cli`, `irpc`
Then the same test files are discovered and the same or greater test-case count passes (no test file silently excluded by the new Vitest config)

### Feature: Lint consolidation (checked at chunk L1)

Scenario AC-L1 — lint still catches real violations
Given the root `.eslintrc.json` after dropping the Nx plugin/boundary rule/`@nx/dependency-checks`
When a deliberately introduced lint violation (e.g. an unused import) is added to one library and `pnpm run lint` runs, then the violation is reverted
Then the violation was caught (non-zero exit, rule violation referencing the introduced problem) before being reverted

### Feature: Independent release via Changesets (checked at chunks R1–R3)

Scenario AC-REL-VERSION — independent versioning with accepted dependent cascade
Given a changeset that bumps only `core` (patch)
When `pnpm changeset version` runs
Then `core`'s `package.json` version and `CHANGELOG.md` update, `irpc`'s `package.json` version and `CHANGELOG.md` also update (dependency-range bump + changelog entry, per the accepted cascade decision above), and `cli`'s version/changelog are untouched

Scenario AC-REL-PUBLISH — local-only publish proof, no workspace protocol leaks
Given a local Verdaccio instance started via the plain `verdaccio` CLI (replacing the `@nx/js:verdaccio` executor)
When `pnpm changeset publish` runs against that local registry only (never `registry.npmjs.org` — asserted via the registry URL actually used)
Then `npm view @why-ts/core --registry <local>` returns the new version, the published `irpc` package's `package.json` (fetched back from the local registry) shows a real resolved semver for its `@why-ts/core` dependency — never the literal string `workspace:*` — and the throwaway version bumps are reverted afterward so no real package.json version changes as a side effect of this proof

### Feature: CI parity (checked at chunk C1)

Scenario AC-C1a — CI and verify.sh both run the full pnpm pipeline
Given `.github/workflows/ci.yml` and `scripts/verify.sh` both call `pnpm -r --if-present run lint`, `test`, `build` (no `nx` invocation in either file)
When a PR triggers the workflow, and separately `./scripts/verify.sh` runs locally
Then both succeed for all three libraries

Scenario AC-C1b — CI fails on a real regression
Given a deliberately broken test (or lint violation, or build error) introduced on a throwaway branch
When the CI workflow runs
Then the workflow reports failure (non-zero exit) for the corresponding job; the throwaway breakage is then reverted

### Feature: Example app stays runnable (checked at chunk E1)

Scenario AC-E1 — examples/cli runs without Nx
Given `examples/cli` has a plain `package.json` with a `start` script reusing its existing `node -r @swc-node/register src/main.ts` pattern
When `pnpm --filter examples-cli start` runs
Then the example CLI runs interactively as it does today, with no `nx`/`@nx/esbuild` reference anywhere in its config, and no `build` script exists (accepted per Decisions)

### Feature: Docs reflect the new model (checked at chunks A1/R3)

Scenario AC-M1 — no stale Nx-release language
Given `docs/MENTAL_MODEL.md`'s two "must never change without a human" bullets about `nx release`/git-tag resolver, and `AGENTS.md`'s territory-map rows and "Debug loops"/"Done = evidence" sections referencing `nx`
When both files are read after chunks `A1` and `R3` land
Then `rg -i 'nx release|nx run-many|nx affected|git-tag' docs/MENTAL_MODEL.md AGENTS.md` returns zero hits outside `docs/decisions/0002-nx-to-pnpm-changesets.md`'s own historical framing

## Protocol

**Pack:** six-pack

Justification: production stakes (public, immutable published npm versions); this migration changes the release mechanism itself, which `docs/MENTAL_MODEL.md` explicitly flags as requiring human sign-off to change; the R-series chunks change how real publish inputs (version bumps, tarball contents) are produced, which is exactly what hardener + end-of-roadmap qa stages exist to catch. Applied uniformly across all 12 chunks in this roadmap — no per-chunk pack downgrade, even for mechanically simple chunks (`F1`, `T1`, `T2`, `E1`), since `AGENTS.md`'s own DANGER-list framing treats this domain as high-rigor-by-default. The irreversible Nx-deletion step is deliberately excluded from this roadmap (see `NX_TEARDOWN`), keeping this roadmap's own worst-case blast radius at "revert a commit," not "point of no return."

- Dependency order: `F1` has no dependencies and is a hard predecessor of every other chunk (no `pnpm-workspace.yaml` exists today, so `pnpm --filter`/`pnpm -r` do not work until `F1` lands). After `F1`: `T1`, `L1`, `B1`, `E1` have no dependencies on each other and may run in parallel. `T2` depends on `T1`. `B2` depends on `B1` AND `F1` (needs both the proven build recipe and the `workspace:*` wiring `F1` introduces). `R1` depends on `F1`. `R2` depends on `R1`, `B1`, `B2`. `R3` depends on `R2`. `C1` depends on `B1`, `B2`, `T1`, `T2`, `L1`. `A1` depends on `R3`, `C1`.
- Code lives in the existing `why-ts` repo structure; no new top-level directories except `.changeset/`.
- Verify commands: per-chunk, run the specific `pnpm --filter <pkg> <script>` named in that chunk's checklist; `./scripts/verify.sh` becomes the full-repo signal only once `C1` lands.
- A standing reviewer-checklist item applies to every chunk: Acceptance scenarios in this roadmap are not edited by any chunk's implementation work; if a scenario proves unmeetable, escalate to the human rather than rewrite the scenario to fit.

---

## Human gate / Executable

- [x] User sets this roadmap **Executable** (explicit approval) before implementors treat it as execute-ready.

Approved 2026-09-14 by the user, explicitly ("mark the migration roadmap executable"), including the Decisions section as drafted (Changesets dependent-bump cascade accepted, `@nx/dependency-checks` dropped with no replacement, CI loses the affected-only fast path, `examples/cli` drops from CI build coverage). Status: **Executable**.

## Task list

### F1 — pnpm workspace foundation

**Status:** approved

**Depends on:** none

**Files:** `pnpm-workspace.yaml` (new), `libs/irpc/package.json`, `pnpm-lock.yaml` (regenerated by `pnpm install`, not hand-edited)

#### Implementor checklist

- [x] Create `pnpm-workspace.yaml` at repo root: `packages: ["libs/*", "examples/*"]`
- [x] Change `libs/irpc/package.json`'s `"@why-ts/core"` dependency from `"0.0.1"` to `"workspace:*"` (note: this touches `dependencies`, not the `version`/`publishConfig` fields AGENTS.md's territory map names as Ask-human)
- [x] Run `pnpm install` from repo root; do not hand-edit `pnpm-lock.yaml`
- [x] Verify `readlink -f libs/irpc/node_modules/@why-ts/core` resolves to `libs/core`
- [x] Confirm `pnpm exec nx run-many -t test` still passes unchanged after this chunk (narrowed scope — lint parity deferred to `L1`, build parity dropped from roadmap Acceptance entirely; see Decisions "AC-W1a narrowing")

#### Reviewer checklist

- [x] Confirm `pnpm-workspace.yaml` covers exactly `libs/*` and `examples/*`
- [x] Confirm `libs/irpc/package.json` has no other unrelated diff
- [x] Confirm narrowed AC-W1a passes (symlink + Nx test parity only) and Nx test/build (per package, outside the known pre-existing `cli:build` gap) is still fully functional after this chunk

#### Agent log

- 2026-09-14 orchestrator: Pack resolved: six-pack (explicit Protocol). Stage order per chunk: coder → cleaner → [architect if A*] → hardener → reviewer. End-of-roadmap qa always runs (six-pack). Starting F1.
- 2026-09-14 coder: Created `pnpm-workspace.yaml` (`libs/*`, `examples/*`); set `libs/irpc/package.json`'s `@why-ts/core` dep to `workspace:*`; ran `pnpm install` (COREPACK_ENABLE_AUTO_PIN=0, to avoid an out-of-scope `packageManager` diff in root `package.json`). Evidence: `readlink -f libs/irpc/node_modules/@why-ts/core` → `/Users/kevin/Codes/why-ts/libs/core`. AC-W1a symlink assertion: PASS. Status: blocked on AC-W1a's second assertion (see below).
- 2026-09-14 coder: `pnpm exec nx run-many -t lint test build --skip-nx-cache` FAILS after this chunk, in 2 root-caused, well-isolated ways: (1) `core:lint`, `cli:lint`, `irpc:lint` all break because pnpm's real per-package `node_modules` (created only once packages join the workspace) now contains real files (`tslib`, `minimist`, the `@why-ts/core` symlink for irpc) that ESLint's inferred `eslint .` (nx sets `cwd: libs/<pkg>`) linus into, since root `.eslintignore` is looked up relative to cwd only (no upward search) and was previously a no-op purely because `libs/*/node_modules` didn't exist pre-workspace. `irpc:lint` additionally hard-crashes because `libs/core/.eslintrc.json`'s `extends: ["../../.eslintrc.json"]` resolves to a nonexistent path when read through the `libs/irpc/node_modules/@why-ts/core` symlink. Fixing this needs `.eslintrc.json`/`.eslintignore` edits, which are outside F1's Files list and `.eslintrc.json` is explicitly Ask-human tier per `AGENTS.md`; roadmap's own `L1` chunk (Ask-human tier) is where that lands, so F1 cannot self-fix this within its Files scope. (2) `cli:build` fails with a `RangeError: Maximum call stack size exceeded` in TypeScript 5.5.4 — confirmed via isolated repro (full `git checkout`, delete `node_modules`, fresh `pnpm install`, no workspace file, no irpc edit) that this reproduces from a **completely unmodified checkout**, merely by running `pnpm install` with this sandbox's pnpm 10.18.2 (committed lockfile is `lockfileVersion: '6.0'`, i.e. authored by a much older pnpm; regenerating it changes dependency resolution enough to trigger this). This is a pre-existing environment/tooling gap (no `packageManager` pin), not introduced by F1's diff, but it does block literally validating "passes unchanged" in this sandbox. Escalating both to human/reviewer rather than expanding Files scope unilaterally. Status: in_progress, AC-W1a partially met (symlink: yes; lint/build parity: no, for the reasons above).
- 2026-09-14 orchestrator: Independently reproduced both coder findings before escalating. (a) Built a git worktree at the pre-F1 commit, fresh `pnpm install`, `nx build cli` → identical `RangeError: Maximum call stack size exceeded`, confirming this is pre-existing and unrelated to F1's diff (sandbox Node 22.15.1 + pnpm 10.18.2 regenerating the old v6.0-format lockfile). (b) `git stash -u` F1's diff, confirmed `nx run-many -t lint` passes (warnings only) pre-F1; `git stash pop` to reapply F1's diff, reran lint → `core:lint`/`cli:lint` hit real errors and `irpc:lint` hard-crashes with `ESLint couldn't find the config "../../.eslintrc.json"` — a real regression caused by F1's real `node_modules` symlink. AC-W1a's "Nx passes unchanged" clause conflicts with what F1 can deliver inside its own Files list (fix is `.eslintrc.json`/`.eslintignore`, Ask-human tier, `L1`'s job). Status set to **blocked**. Stopping per Protocol's Acceptance-vs-evidence rule to ask the human rather than reinterpret AC-W1a myself.
- 2026-09-14 orchestrator: User decision received: (a) narrow AC-W1a — lint parity deferred to `L1`, Nx build parity dropped from this roadmap's Acceptance entirely (tracked separately, see (b)); (b) spin up a separate agent using the create-roadmap skill to draft a fix roadmap for the pre-existing `cli:build` TypeScript RangeError / stale-lockfile issue. Applied (a) to this roadmap's Decisions + AC-W1a text (see above). Independently confirmed `pnpm exec nx run-many -t test --skip-nx-cache` passes cleanly (54+7 tests, 3 projects) under F1's diff, satisfying narrowed AC-W1a in full. Status reset to **in_progress**; resuming F1 pipeline at the cleaner stage (coder's implementation work stands, only the Acceptance bar it is judged against changed).
- 2026-09-14 cleaner: Reviewed `pnpm-workspace.yaml`, `libs/irpc/package.json`, `pnpm-lock.yaml`; made no changes, implementation was already minimal. Re-verified `readlink -f libs/irpc/node_modules/@why-ts/core` → resolves to `libs/core`; `nx run-many -t test` passed 3/3 projects. Status: in_progress.
- 2026-09-14 hardener: Ran 3 declared gates: (1) symlink resolution PASS; (2) `nx run-many -t test --skip-nx-cache` PASS (3/3 projects); (3) diff-scope check initially FAILED because running the declared test-gate command itself (via Corepack) injected a `packageManager` field into root `package.json` — out-of-scope drift, not part of F1's Files list or the coder/cleaner's actual work; reverted with `git checkout -- package.json`. Note for future chunks: any `pnpm exec nx`/`pnpm install` invocation in this sandbox risks Corepack auto-injecting `packageManager` into root `package.json` unless `COREPACK_ENABLE_AUTO_PIN=0` is set first; future chunks/hardeners should set that env var or revert the drift if it reappears, since root `package.json` is out of scope for most chunks in this roadmap. Status: in_progress.
- 2026-09-14 reviewer: Independently re-verified from a fresh pass: `readlink -f libs/irpc/node_modules/@why-ts/core` → `libs/core` PASS; `COREPACK_ENABLE_AUTO_PIN=0 pnpm exec nx run-many -t test --skip-nx-cache` → 3/3 projects PASS; `pnpm exec nx run-many -t build --projects=core,irpc --skip-nx-cache` → both PASS (confirms the pre-existing `cli:build` gap is isolated, not spread by this chunk); `git status --porcelain` shows exactly `pnpm-workspace.yaml` (new), `libs/irpc/package.json` (single-line dep change), `pnpm-lock.yaml` (regenerated), and this roadmap file (F1-scoped text) — no `package.json` Corepack drift reappeared. Agent log confirmed coherent across all 7 stages (orchestrator, coder ×2, orchestrator ×2, cleaner, hardener) with no gaps. Implementor/Reviewer checklists and Acceptance (AC-W1a) confirmed consistent on the narrowed scope. Verdict: approve. Status: done.
- 2026-09-14 orchestrator: Approved. Residual risks carried forward: pre-existing `cli:build` RangeError (separate fix roadmap being drafted); lint parity deferred to `L1`; Corepack `packageManager` auto-injection risk in this sandbox (use `COREPACK_ENABLE_AUTO_PIN=0`). Committing chunk now. Status: **approved**.

---

### T1 — Vitest pilot (core)

**Status:** approved

**Depends on:** F1

**Files:** root `package.json` (add `vite-tsconfig-paths` devDependency), `libs/core/vite.config.ts`, `libs/core/package.json`

#### Implementor checklist

- [x] Add `vite-tsconfig-paths` as a root devDependency
- [x] In `libs/core/vite.config.ts`, replace `nxViteTsPaths()` (`@nx/vite/plugins/nx-tsconfig-paths.plugin`) with `tsconfigPaths()` (`vite-tsconfig-paths`)
- [x] Add `"test": "vitest run"` to `libs/core/package.json` scripts
- [x] Before changing anything, record baseline: `pnpm exec nx test core` test-file/test-case counts, written into this chunk's Agent log
- [x] Run `pnpm --filter @why-ts/core test`; confirm same test file(s)/case count as the baseline

#### Reviewer checklist

- [x] Confirm no other package's config was touched
- [x] Confirm the baseline count was actually recorded in the Agent log, not asserted from memory
- [x] Confirm `core`'s Nx-driven test target still works too (Nx not yet removed)

#### Agent log

2026-09-14 agent (T1, coder): Starting. Depends-on F1 confirmed merged (`pnpm-workspace.yaml` present, lists `libs/*`/`examples/*`). All pnpm/nx commands below run with `COREPACK_ENABLE_AUTO_PIN=0` prefix.

2026-09-14 agent (T1, coder): One bare `pnpm -v` (no prefix) triggered Corepack auto-pin, adding a `packageManager` field to root `package.json`. Detected via `git --no-pager diff package.json` immediately after, reverted with `git checkout -- package.json` before any other change. Confirmed clean via `git --no-pager status --porcelain` (empty) before proceeding. No further un-prefixed commands run.

2026-09-14 agent (T1, coder): Baseline BEFORE any change. Ran `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-tmp pnpm exec nx test core --skip-nx-cache` (had to set `NX_SOCKET_DIR` — default nx socket path exceeded macOS's max socket path length in this sandbox, unrelated to the migration). Output: `include: src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` matched, `No test files found, exiting with code 0`, `NX Successfully ran target test for project core (257ms)`. Confirmed `libs/core/src` genuinely has no `*.test.*`/`*.spec.*` files today (`find_path` on `libs/core/src/**/*.{test,spec}.*` returned no matches; only `src/index.ts` and `src/lib/`). Baseline: 0 test files, 0 test cases, exit code 0 (passes via `passWithNoTests: true` in `libs/core/vite.config.ts`). This is a legitimate baseline, not a tooling failure — `core` has no tests today.

2026-09-14 agent (T1, coder): Added `vite-tsconfig-paths` as root devDependency: `COREPACK_ENABLE_AUTO_PIN=0 pnpm add -D -w vite-tsconfig-paths` initially resolved `^6.1.1`, but `pnpm --filter @why-ts/core test` then failed at config-load time: `[plugin: externalize-deps] "vite-tsconfig-paths" resolved to an ESM file. ESM file cannot be loaded by require` (v6 dropped the CJS build; `vite.config.ts` loads as CJS here since root `package.json` has no `"type": "module"`, and adding one is out of scope for T1's declared Files list). Fix: downgraded to the last version with a dual CJS/ESM build, `vite-tsconfig-paths@4.3.2` (confirmed via `npm view vite-tsconfig-paths@4.3.2 exports` showing both `import`/`require` conditions; `npm view vite-tsconfig-paths@5.1.4 type` showed `module`, i.e. 5.x+ is ESM-only too). Root `package.json` now has `"vite-tsconfig-paths": "^4.3.2"`. This version pin is a residual risk for the reviewer/hardener to sign off on explicitly (see below).

2026-09-14 agent (T1, coder): Edited `libs/core/vite.config.ts` — replaced `import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'` / `nxViteTsPaths()` with `import tsconfigPaths from 'vite-tsconfig-paths'` / `tsconfigPaths()` (both the active `plugins` array and the commented-out `worker.plugins` example). Edited `libs/core/package.json` — added `"test": "vitest run"` to `scripts` (kept existing `build` script line untouched).

2026-09-14 agent (T1, coder): Ran `COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/core test`. Output: `include: src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` (same include pattern as baseline), `No test files found, exiting with code 0`. Same 0 test files / 0 test cases / exit code 0 as baseline — parity confirmed by real command output.

2026-09-14 agent (T1, coder): Re-ran Nx's own test target after the change to prove it still works (Nx not yet removed): `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-tmp pnpm exec nx test core --skip-nx-cache`, twice, once capturing exit code explicitly (`echo "EXIT_CODE=$?"` → `EXIT_CODE=0`). Output: same `No test files found, exiting with code 0`, `NX Successfully ran target test for project core`. Nx-driven test target unaffected by the plugin swap.

2026-09-14 agent (T1, coder): Files actually changed (`git --no-pager status --porcelain`): `package.json` (M), `libs/core/package.json` (M), `libs/core/vite.config.ts` (M), `pnpm-lock.yaml` (M — automatic byproduct of the `pnpm add` devDependency change, not a manual edit, not in T1's declared Files list but unavoidable). No other package's config touched — verified via the same `git status` output (only these 4 paths dirty).

2026-09-14 agent (T1, coder): Residual risks / leftovers for cleaner/hardener/reviewer: (1) `vite-tsconfig-paths` is pinned to `^4.3.2`, one major behind latest (`7.0.0-alpha.3`/`6.1.1` stable), specifically because v5+/v6+ dropped CJS support and this repo's `vite.config.ts` files load as CJS (no root `"type": "module"`); this same constraint will bite T2 (`cli`, `irpc`) and should be applied identically there, not re-discovered. (2) Because `core` has zero test files today, T1's AC-T1 parity check is only proven at the `0 == 0` level for this package — real test-count parity (non-zero) will first be meaningfully exercised in `cli`/`irpc` at T2, so reviewer should not treat T1 as full proof of the Vitest recipe against a populated suite. (3) Left `Status: in_progress`, not `approved`; tree left dirty (not committed) per Protocol Pack — cleaner stage should pick up from here.

2026-09-14 cleaner (T1): Reviewed all three declared Files (root `package.json`, `libs/core/vite.config.ts`, `libs/core/package.json`) plus the unavoidable `pnpm-lock.yaml` byproduct. `git --no-pager diff` on the three Files shows exactly the coder's claimed changes and nothing else: `vite-tsconfig-paths` swap in `vite.config.ts` (active plugin + commented worker example, both updated consistently), one added `test` script line in `libs/core/package.json`, one added `vite-tsconfig-paths: ^4.3.2` devDependency line in root `package.json`. Verified the CJS-compatibility downgrade is reflected correctly and consistently: root `package.json` pins `^4.3.2` (not `^6.1.1`), and `pnpm-lock.yaml` resolves `vite-tsconfig-paths` to exactly `4.3.2` in all three places it appears (`importers`, `packages`, `snapshots`) — no leftover `6.x` resolution anywhere in the lockfile (`grep vite-tsconfig-paths pnpm-lock.yaml`). Checked for stray debug artifacts (`.bak`/`.orig`/temp files) across the worktree — none found. No formatting inconsistencies. No changes needed — implementation was already minimal and matched its own Agent log exactly. Re-verify: `COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/core test` → same baseline parity (`No test files found, exiting with code 0`). `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-tmp-cleaner pnpm exec nx test core --skip-nx-cache` → `No test files found, exiting with code 0`, `NX Successfully ran target test for project core (520ms)`. Confirmed no `packageManager` drift reappeared in root `package.json` after running these commands (`git diff package.json` unchanged from before). Flag for hardener/reviewer: none beyond what the coder already flagged (T2 must apply the same `^4.3.2` CJS-compatibility pin, and T1's parity check is only meaningful at `0 == 0` since `core` has no tests yet).

2026-09-14 hardener (T1): Ran all three declared verify checks fresh. (1) `COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/core test` → `No test files found, exiting with code 0` (confirmed `EXIT_CODE=0` explicitly via a second run with `echo "EXIT_CODE=$?"`); matches the recorded baseline of 0 test files / 0 test cases. PASS. (2) `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-tmp-hardener pnpm exec nx test core --skip-nx-cache` → same `No test files found, exiting with code 0`, `NX Successfully ran target test for project core (525ms)`; Nx-driven target still works, Nx not yet removed. PASS. (3) `vite-tsconfig-paths` pin check: `grep vite-tsconfig-paths package.json` shows `"vite-tsconfig-paths": "^4.3.2"` in root devDependencies; `grep vite-tsconfig-paths pnpm-lock.yaml` shows `4.3.2` consistently in all three lockfile sections (`importers`/`packages`/`snapshots`), no `6.x` residue. PASS, matches coder's note. Additionally confirmed `git --no-pager status --porcelain` shows only the expected dirty files (`libs/core/package.json`, `libs/core/vite.config.ts`, `package.json`, `pnpm-lock.yaml`, plus this roadmap doc) and `git --no-pager diff package.json` shows only the one added `vite-tsconfig-paths` line — no `packageManager` drift reappeared. Residual risks for reviewer: none beyond what coder/cleaner already flagged — (a) `vite-tsconfig-paths` pinned one major behind latest due to CJS-only constraint, must be applied identically in T2 for `cli`/`irpc`; (b) T1's `0 == 0` parity is not yet a full proof of the Vitest recipe against a populated test suite, that lands in T2. Did not change Status (left `in_progress`), did not commit, per role scope.

2026-09-14 agent (T1, reviewer): Verdict: approve. Independently re-verified all claims, not from coder/cleaner/hardener's word: (1) Scope — `git --no-pager status --short` shows exactly `docs/roadmaps/2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md`, `libs/core/package.json`, `libs/core/vite.config.ts`, `package.json`, `pnpm-lock.yaml`; no other package's config touched. (2) Baseline — confirmed genuinely 0 test files today: `find libs/core -name "*.test.ts" -o -name "*.spec.ts"` returned empty, matching the Agent log's real pre-change `nx test core` run (not asserted from memory — the log shows the actual command and output, `No test files found, exiting with code 0`, before any edit). (3) Re-ran `COREPACK_ENABLE_AUTO_PIN=0 NX_SOCKET_DIR=/tmp/nx-tmp-reviewer pnpm exec nx test core --skip-nx-cache` myself → `No test files found, exiting with code 0`, `NX Successfully ran target test for project core (517ms)`, `EXIT_CODE=0`. Nx test target still works, Nx not yet removed. (4) Re-ran `COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/core test` myself → identical output, `EXIT_CODE=0`, matches Nx run and baseline. (5) `git --no-pager diff` on `libs/core/vite.config.ts` shows `nxViteTsPaths()`/`@nx/vite/plugins/nx-tsconfig-paths.plugin` replaced with `tsconfigPaths()`/`vite-tsconfig-paths` cleanly in both the active `plugins` array and the commented-out `worker.plugins` example — no leftover Nx references, import statement correct (default import matching the package's export shape). `libs/core/package.json` diff shows exactly one added `"test": "vitest run"` line, existing `build` script untouched. Root `package.json` diff shows exactly one added `"vite-tsconfig-paths": "^4.3.2"` devDependency line; `pnpm-lock.yaml` resolves it to `4.3.2` consistently in all three sections (`importers`, `packages`, `snapshots` — confirmed via `grep -n vite-tsconfig-paths pnpm-lock.yaml`), no stray `6.x` entries. (6) Cleanup — searched for stray `.bak`/`.orig` artifacts outside `node_modules`: none found; cleaner's "no changes needed" is plausible, diff is already minimal and matches the Agent log exactly. Residual risks (none blocking): (a) `vite-tsconfig-paths` is pinned one major behind latest (`^4.3.2` vs 6.x/7.x) due to a real CJS-only constraint — T2 must apply the identical pin to `cli`/`irpc`, not re-derive it; (b) T1's AC-T1 parity is only proven at `0 == 0` since `core` has no tests today — real non-zero parity first gets exercised at T2, so this chunk alone is not full proof of the Vitest recipe against a populated suite. Checked off all three Reviewer checklist boxes above (all independently re-verified). Did not change Status, did not commit — orchestrator's job.

---

### T2 — Vitest for cli and irpc

**Status:** pending

**Depends on:** T1

**Files:** `libs/cli/vite.config.ts`, `libs/cli/package.json`, `libs/irpc/vite.config.ts`, `libs/irpc/package.json`

#### Implementor checklist

- [ ] Repeat T1's exact recipe for `cli` and `irpc`
- [ ] Record and compare baseline test counts for both (same method as T1), written into this chunk's Agent log
- [ ] Run `pnpm --filter @why-ts/cli test` and `pnpm --filter @why-ts/irpc test`, confirm parity
- [ ] AC-T1 is now fully verifiable across all three packages

#### Reviewer checklist

- [ ] Confirm the recipe was applied identically to T1, no drift
- [ ] Confirm test counts were recorded and compared for both packages, not just asserted

#### Agent log

---

### L1 — Lint consolidation (Ask-human tier)

**Status:** approved

**Depends on:** F1

**Files:** root `.eslintrc.json`, delete `libs/cli/.eslintrc.json`, `libs/core/.eslintrc.json`, `libs/irpc/.eslintrc.json`, `examples/cli/.eslintrc.json`, root `package.json`

#### Implementor checklist

- [x] This chunk edits `.eslintrc.json`, an Ask-human-tier file per `AGENTS.md`'s territory map — flag explicitly for human sign-off before merge, do not rely on six-pack review alone
- [x] Rewrite root `.eslintrc.json`: drop `@nx` plugin, `@nx/enforce-module-boundaries` (confirmed no-op today), `@nx/dependency-checks` (accepted coverage loss per Decisions), `plugin:@nx/typescript`/`plugin:@nx/javascript` extends; replace with direct `@typescript-eslint/recommended` plus the project's existing custom rules
- [x] Delete the four per-package `.eslintrc.json` files
- [x] Add `"lint": "eslint libs examples --ext .ts"` (or equivalent) to root `package.json`
- [x] Introduce a deliberate lint violation (e.g. unused import) in a throwaway local diff, confirm `pnpm run lint` fails on it, then revert the throwaway violation

#### Reviewer checklist

- [x] Confirm this chunk is flagged for explicit human sign-off (Ask-human tier), not silently merged
- [x] Confirm the introduced-violation test was actually performed and reverted cleanly
- [x] Confirm no rule beyond the two named Nx-specific ones was silently dropped

#### Agent log

2026-09-14 coder (L1): ASK-HUMAN TIER — this chunk edits `.eslintrc.json` per AGENTS.md's territory map; flag for explicit human sign-off before merge, do not treat six-pack review alone as sufficient.

2026-09-14 coder (L1): Rewrote root `.eslintrc.json`: dropped `"plugins": ["@nx"]`, the `@nx/enforce-module-boundaries` override, and the `plugin:@nx/typescript`/`plugin:@nx/javascript` extends indirections. Replaced by inlining the exact rule sets those two Nx configs resolved to (read directly from `node_modules/@nx/eslint-plugin/src/configs/typescript.js` and `javascript.js` after a `COREPACK_ENABLE_AUTO_PIN=0 pnpm install --frozen-lockfile` in this worktree, since no `node_modules` existed yet): `eslint:recommended` + `plugin:@typescript-eslint/recommended` + `prettier` (via `eslint-config-prettier`, already a devDependency) + the same `@typescript-eslint/*` rule overrides (no-explicit-any: warn, no-unused-vars: warn, no-empty-interface: error, no-empty-function: error, adjacent-overload-signatures: error, prefer-namespace-keyword: error, no-non-null-assertion: warn, etc.), split into a `*.ts`/`*.tsx` override and a `*.js`/`*.jsx` override (matching the original two-override split; js override additionally sets `env: {browser, node}` and `no-var-requires: off`, exactly as `javascript.js` did). Kept the `*.spec.*` jest-env override unchanged. Dropped `@nx/dependency-checks` per Decisions (accepted coverage loss, no replacement) and the root `ignorePatterns: ["**/*"]` Nx per-project-isolation trick, since it is no longer needed once the four per-package `.eslintrc.json` files (which used to negate it via `ignorePatterns: ["!**/*"]`) are deleted. `.eslintignore` (not in this chunk's Files list) was left untouched; its existing `node_modules` glob-pattern already covers the new per-package `node_modules` symlink dirs pnpm creates under `libs/*/node_modules`.

2026-09-14 coder (L1): Deleted the four per-package configs: `libs/cli/.eslintrc.json`, `libs/core/.eslintrc.json`, `libs/irpc/.eslintrc.json`, `examples/cli/.eslintrc.json`. All four were identical Nx boilerplate (`extends` the root config, re-enable `ignorePatterns: ["!**/*"]`, plus the `@nx/dependency-checks` JSON-parser override) with no project-specific custom rules beyond that, so nothing else needed preserving.

2026-09-14 coder (L1): Added `"lint": "eslint libs examples --ext .ts"` to root `package.json`'s (previously empty) `scripts`. Diff is exactly the one line plus the `scripts` key expanding from `{}`; no other root `package.json` field changed (checked `git diff package.json`) — in particular no `packageManager` field was injected by the `COREPACK_ENABLE_AUTO_PIN=0 pnpm install --frozen-lockfile` run, and `pnpm-lock.yaml` has zero diff.

2026-09-14 coder (L1): Evidence — baseline `COREPACK_ENABLE_AUTO_PIN=0 pnpm run lint` (after the rewrite, before any violation): exit 0, `38 problems (0 errors, 38 warnings)`, all `@typescript-eslint/no-explicit-any` / `no-unused-vars` warnings across `libs/{cli,core,irpc}` (log saved locally at /tmp/l1_lint_baseline.log during the session, not committed).

2026-09-14 coder (L1): Deliberate-violation test (AC-L1), actually executed, not asserted from memory: backed up `libs/core/src/lib/peek.ts`, appended a throwaway `interface L1LintViolationTest {}` to it, reran `COREPACK_ENABLE_AUTO_PIN=0 pnpm run lint` -> exit code 1, output included `26:11  error  An empty interface is equivalent to `{}`  @typescript-eslint/no-empty-interface` referencing the exact introduced line. Restored `peek.ts` from the backup; `git diff libs/core/src/lib/peek.ts` is empty (clean revert). Reran lint once more post-revert: exit 0, identical 38-problem output byte-for-byte to the pre-violation baseline (`diff` of the two captured logs was empty). Note: chose an error-severity rule (`no-empty-interface`) rather than the checklist's literal "unused import" example, because `no-unused-vars` is `warn` (inherited unchanged from Nx's own `typescript.js` config, not something this chunk changed) and ESLint's default CLI does not fail the process on warnings alone (no `--max-warnings` is set, matching the pre-existing Nx target's options in `nx.json`) — an unused-import violation alone would not have produced AC-L1's required non-zero exit, so a real error-level rule was needed to actually prove "lint still catches real violations" causally instead of just citing the rule list.

2026-09-14 coder (L1): Files changed (matches this chunk's declared Files list exactly, verified via `git status --short`): modified `.eslintrc.json`, modified `package.json`; deleted `libs/cli/.eslintrc.json`, `libs/core/.eslintrc.json`, `libs/irpc/.eslintrc.json`, `examples/cli/.eslintrc.json`. No other file in the worktree is dirty. Left uncommitted per protocol (coder stage does not commit).

2026-09-14 coder (L1): Residual risks / notes for cleaner, hardener, reviewer: (1) Ask-human sign-off is still outstanding — do not merge without it, per AGENTS.md's territory map and this roadmap's own Decisions section. (2) `node_modules` did not exist in this worktree before this session; it now does after a frozen-lockfile install — confirm this is expected/wanted state for the next stage rather than a surprise. (3) Did not run `pnpm exec nx run-many -t lint` for a literal before/after diff against the new eslint output (Nx lint was not run first in this worktree) — the reviewer checklist item "no rule beyond the two named Nx-specific ones was silently dropped" was instead verified by direct source inspection of `@nx/eslint-plugin`'s `typescript.js`/`javascript.js` configs (see above), which is the actual ground truth for what those `extends` resolved to; consider this sufficient but flagging the alternative-evidence path explicitly. (4) Did not touch `.eslintignore` (outside this chunk's Files list) even though it's adjacent in spirit; flag if a future chunk needs to revisit it for the new `libs/*/node_modules` symlink layout beyond the existing bare `node_modules` glob. (5) Status left at `in_progress` per protocol — orchestrator/reviewer sets `approved`.

2026-09-14 cleaner (L1): Reviewed root `.eslintrc.json` diff, root `package.json` diff, and the four deleted per-package `.eslintrc.json` files against the coder's Agent log claims. Verified: `package.json` diff is exactly the one-line `lint` script add as claimed (`git diff package.json`). Verified all four deleted files (`libs/cli`, `libs/core`, `libs/irpc`, `examples/cli`) were identical Nx boilerplate with no custom rules, via `git show HEAD:<path>` on each — matches coder's claim. Confirmed `libs/core/src/lib/peek.ts` has an empty diff and no `.bak`/`.orig`/stray temp files exist anywhere in the worktree (checked via `find` and `git status --ignored`). No leftover debug artifacts, no half-done work, no formatting inconsistencies found. No changes needed — implementation was already minimal and matched its own log exactly. Re-verify: `COREPACK_ENABLE_AUTO_PIN=0 pnpm run lint` -> exit 0, `38 problems (0 errors, 38 warnings)`, same problem count as coder's baseline. Flag for hardener/reviewer: Ask-human sign-off (Ask-human tier, per AGENTS.md) is still outstanding — do not approve/merge without it.
2026-09-14 hardener (L1): Ran only the declared verify for this chunk. Gate: `COREPACK_ENABLE_AUTO_PIN=0 pnpm run lint` -> exit 0, `38 problems (0 errors, 38 warnings)`, matches coder/cleaner baseline exactly. AC-L1 re-verification (independent, own throwaway violation, not reused from coder/cleaner): checked `.eslintrc.json` rule severities first (`no-empty-interface`: error, `no-unused-vars`: warn, confirmed via `git diff .eslintrc.json`), then appended `interface L1HardenerViolationTest {}` to `libs/core/src/lib/peek.ts` (backed up first) -> lint exit 1, `40 problems (1 error, 39 warnings)`, with `@typescript-eslint/no-empty-interface` referencing the exact introduced line (25:11). Restored `peek.ts` from backup -> `git diff libs/core/src/lib/peek.ts` empty (clean revert). Reran lint post-revert -> exit 0, `38 problems (0 errors, 38 warnings)`, identical count to pre-test baseline. Confirmed `git status --short` shows only this chunk's declared Files (`.eslintrc.json`, `package.json` modified; four per-package `.eslintrc.json` deleted; roadmap doc modified) with no stray artifacts left by my test. Residual risks for reviewer: (1) Ask-human-tier sign-off for `.eslintrc.json` edits is still outstanding per AGENTS.md's territory map — required before merge/push, not satisfiable by six-pack review alone. (2) coder's note that Nx's own lint was never run in this worktree for a literal before/after diff (evidence path was source inspection of `@nx/eslint-plugin`'s configs instead) — carried forward unchanged, not independently re-litigated here since it is a design/process question, not a verify-command gate. (3) `.eslintignore` left untouched (out of this chunk's Files list) — carried forward as coder noted, no new finding. Did not revise or redesign; only ran declared verify commands and reported evidence. Status left unchanged (in_progress); approval is the reviewer's call, not mine.

2026-09-14 reviewer (L1): Independent review, fresh (did not author coder/cleaner/hardener work). Verdict: approve.

Findings:

1. Checklist reality vs diff: `git -C <worktree> diff main -- .eslintrc.json package.json` matches the log's claims exactly — root `.eslintrc.json` drops `"plugins": ["@nx"]`, the `@nx/enforce-module-boundaries` override, `plugin:@nx/typescript`/`plugin:@nx/javascript` extends, and `@nx/dependency-checks`; root `package.json` gains exactly one `scripts.lint` line. `git status --short` shows only the declared Files (`.eslintrc.json` M, `package.json` M, 4 per-package `.eslintrc.json` D, roadmap doc M) — no scope creep, `pnpm-lock.yaml` diff is 0 lines. Re-ran `COREPACK_ENABLE_AUTO_PIN=0 pnpm run lint` myself: exit 0, `38 problems (0 errors, 38 warnings)` — byte-for-byte matches coder/cleaner/hardener's logged baseline.

2. AC-L1 independently re-verified a fourth time (own throwaway violation, not reused): appended `interface ReviewerViolationTest {}` to `libs/core/src/lib/peek.ts` -> lint exit 1, `40 problems (1 error, 39 warnings)`, `@typescript-eslint/no-empty-interface` on the exact introduced line. Reverted -> `git diff libs/core/src/lib/peek.ts` empty, lint back to exit 0 / 38 problems. Matches the pattern the coder (line 26) and hardener (line 25) each independently reported; three-for-three consistent, plausible, not a copy-paste — line numbers differ per test as expected since each appended after backing up separately.

3. No silent rule loss beyond the declared drops: pulled the actual installed `node_modules/@nx/eslint-plugin/src/configs/typescript.js` and `javascript.js` from this worktree and diffed them against the rewritten `.eslintrc.json` overrides by eye — the `extends` chain (`eslint:recommended` + `plugin:@typescript-eslint/recommended` + `prettier`) and every listed rule/severity (`no-explicit-any: warn`, `no-unused-vars: warn`, `no-empty-interface: error`, `no-empty-function: error`, `adjacent-overload-signatures: error`, `prefer-namespace-keyword: error`, `no-non-null-assertion: warn`, `no-inferrable-types: error`, js-only `no-var-requires: off` + `env: {browser, node}`) match exactly, field for field. This is stronger evidence than the coder's own source-inspection claim (which I independently reproduced against the real installed package rather than trusting the log). Also confirmed all 4 deleted per-package `.eslintrc.json` files (`git show main:<path>`) were identical Nx boilerplate — `extends` root, `ignorePatterns` re-enable, and only `@nx/dependency-checks` as a project-specific addition (the one named, accepted drop) — nothing else was lost.

4. Ask-human tier: flagged explicitly and repeatedly (coder, cleaner, hardener all state sign-off is outstanding; roadmap Decisions section also names L1 as Ask-human tier). Confirmed not silently merged — chunk Status remains `in_progress`, left for orchestrator/human, not auto-approved here.

5. Scope: `git status --short` in the worktree shows exactly 7 changed paths (`.eslintrc.json`, `package.json`, 4 deleted per-package configs, roadmap doc) plus expected untracked `libs/*/node_modules` (pnpm install side effect, not a chunk file). No `.eslintignore`, `nx.json`, `tsconfig.base.json` diff. No stray `.bak`/`.orig`/test-artifact files found.

6. Cleaner's "no changes needed": plausible, not a rubber stamp — cleaner's log shows concrete checks performed (diff verification, boilerplate comparison via `git show`, stray-file search, lint re-run with matching count), consistent with what I independently re-verified. The implementation genuinely was minimal; there was nothing left to clean.

Minor observation (not blocking): `"lint": "eslint libs examples --ext .ts"` only lints `.ts` files. Confirmed via `find` that no `.js`/`.jsx`/`.tsx` files currently exist under `libs/`/`examples/` outside `node_modules`/`dist`, so there is no current coverage gap — but if a future `.tsx`/`.js` file is added under those dirs it will silently go unlinted. Not called out in any prior log; worth a follow-up note, not a revise-blocker for this chunk's stated scope (root `.eslintrc.json` already keeps `*.js`/`*.jsx` override rules for exactly this reason).

Residual risks (approve, not blockers): (1) Ask-human sign-off for `.eslintrc.json` still required before merge — this review does not substitute for it. (2) `--ext .ts` lint-script coverage gap noted above if `.js`/`.tsx` files are added later. (3) `@nx/eslint-plugin`/`@nx/eslint` remain in root `package.json` devDependencies (unremoved) — expected, since physically deleting Nx packages is explicitly out of scope for this roadmap (separate `NX_TEARDOWN` roadmap per the Goal section).

Checked off all three Reviewer checklist boxes above (human sign-off flagged, violation test verified, no undeclared rule loss). Did not set Status to `approved` and did not commit — orchestrator's call.

---

### B1 — tsc build pilot (core)

**Status:** approved

**Depends on:** F1

**Files:** `libs/core/package.json`, `libs/core/tsconfig.lib.json`

#### Implementor checklist

- [x] Run `pnpm exec nx build core` once (Nx still installed); record the exact contents/structure of `dist/libs/core/` as ground truth in this chunk's Agent log — do not assume the layout
- [x] Move that recorded `dist/libs/core/` aside before building the new way, to avoid false confidence from stale files
- [x] Set `libs/core/tsconfig.lib.json`'s `outDir` so a plain `tsc -p tsconfig.lib.json` reproduces the recorded layout (`dist/libs/core/src/index.js`, `.d.ts`, etc.)
- [x] Add `"build": "tsc -p tsconfig.lib.json && cp package.json README.md ../../dist/libs/core/"` (or equivalent) to `libs/core/package.json`
- [x] Run `pnpm --filter @why-ts/core build`; diff the result against the recorded ground truth (module format, file list, `main`/`typings` resolution)
- [x] Confirm `node -e "require('./dist/libs/core')"` succeeds from `dist/libs/core`

#### Reviewer checklist

- [x] Confirm the ground-truth capture actually happened (evidence in Agent log)
- [x] Confirm CJS emit is unchanged (spot check `dist/libs/core/src/index.js` uses `require`/`exports`, not `import`/`export`)
- [x] Confirm `package.json`/`README.md` are copied unmodified

#### Agent log

2026-09-14 coder (B1): Starting tsc build pilot for core. Status: in_progress.

2026-09-14 coder (B1): Ran `COREPACK_ENABLE_AUTO_PIN=0 pnpm install` first (worktree had no node_modules) -- no `packageManager` field appeared in root package.json afterward (verified via `grep packageManager package.json` -> no match). Ran `NX_SOCKET_DIR=/tmp/nx-tmp-b1 COREPACK_ENABLE_AUTO_PIN=0 pnpm exec nx build core` (plain `pnpm exec nx build core` first failed with an Nx daemon socket-path-too-long error under this worktree's long `/tmp/why-ts-worktrees/b1` path; setting `NX_SOCKET_DIR` fixed it, no repo files touched by this workaround). Ground-truth `dist/libs/core/` (captured via `find dist/libs/core -type f | sort`, 23 files): `package.json`, `README.md`, `src/index.d.ts`, `src/index.js`, `src/index.js.map`, `src/lib/delay.{d.ts,js,js.map}`, `src/lib/drill.{d.ts,js,js.map}`, `src/lib/peek.{d.ts,js,js.map}`, `src/lib/promise-trigger.{d.ts,js,js.map}`, `src/lib/types/index.{d.ts,js,js.map}`, `src/lib/types/unsubscribe.{d.ts,js,js.map}` -- i.e. the full `src/` tree is mirrored, not just a single `index.js`/`index.d.ts` pair (narrower than Acceptance's AC-B1 prose implies; recorded as real ground truth per the checklist's "do not assume the layout"). Nx's `dist/libs/core/package.json` additionally had an auto-injected `"types": "./src/index.d.ts"` field (on top of the source's existing `main`/`typings`) -- our plain-copy approach does not add this; not required by AC-B1 (which only requires `main`/`typings` unmodified and resolving). Moved the captured tree to `/tmp/b1-ground-truth/nx-dist-libs-core` (outside the repo) and deleted the worktree's `dist/` before building the new way.

Root cause of Nx's layout, established by reading `libs/core/project.json`'s `build` target (`@nx/js:tsc`, `outputPath: "dist/libs/core"`, `main: "libs/core/src/index.ts"`): the executor effectively uses `rootDir=libs/core` (crops the `libs/core/` prefix from source paths) and `outDir=dist/libs/core`, which is why the mirrored tree lands at `dist/libs/core/src/...` and not `dist/libs/core/libs/core/src/...`. Plain `tsc` inherits `rootDir: "."` from `tsconfig.base.json`, resolved relative to that file's own directory (repo root, per TS's extends-resolution rule: path options resolve relative to the config file that literally declares them) -- left as-is, that would have produced the wrong nested `dist/libs/core/libs/core/src/...` layout. Fix: declared `rootDir: "."` and `outDir: "../../dist/libs/core"` directly inside `libs/core/tsconfig.lib.json` itself (both now resolve relative to `libs/core/`, giving effective `rootDir=libs/core`, `outDir=<repo>/dist/libs/core`), which reproduces Nx's layout exactly.

Added `"scripts": {"build": "tsc -p tsconfig.lib.json && cp package.json README.md ../../dist/libs/core/"}` to `libs/core/package.json` (pnpm runs package scripts with cwd = the package dir, so the relative `cp` destination resolves correctly). Ran `COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/core build` -- succeeded, no errors. Diff evidence against the ground truth: (1) file list -- `find` + `sort` on both trees (stripped to relative paths) piped through `diff`, exit code 0, byte-identical list of all 23 files, no extras/missing; (2) `diff dist/libs/core/src/index.js /tmp/b1-ground-truth/nx-dist-libs-core/src/index.js` -> exit 0 (byte-identical, confirms CJS emit unchanged -- file uses `Object.defineProperty(exports, ...)`/`require("tslib")`/`tslib_1.__exportStar(require(...), exports)`, no `import`/`export` keywords); (3) `diff` on `src/index.d.ts` -> exit 0 (identical); (4) `diff` on `README.md` -> exit 0 (identical); (5) `diff` on `package.json` -> differs only by: ours keeps the new `scripts.build` field (intentional, this chunk's addition) where Nx's had an auto-injected `types` field instead -- `main: "./src/index.js"` and `typings: "./src/index.d.ts"` are present and unmodified in both. Ran `node -e "require('./dist/libs/core')"` from the worktree root -> succeeded silently (`OK: require succeeded` printed); also ran `node -e "..."` from inside `dist/libs/core` confirming `require.resolve('./')` -> `.../dist/libs/core/src/index.js` and the loaded module exports `PromiseStatus`, `createPromiseTrigger`, `drill`, `peek`, `delay` (matches source's public API).

Files changed (matches B1's declared Files list exactly): `libs/core/package.json` (added `scripts.build`), `libs/core/tsconfig.lib.json` (`outDir` changed from `../../dist/out-tsc` to `../../dist/libs/core`; added explicit `rootDir: "."`). Plus this roadmap doc (Status/checklist/log only). `git status --porcelain` in the worktree shows exactly these 3 files modified, nothing else. Confirmed no `packageManager` field was ever injected into root `package.json` (checked before and after every `pnpm` invocation in this session). Worktree required a fresh `pnpm install` (no prior `node_modules`) -- not itself a B1 file change, just an environment prerequisite; `pnpm-lock.yaml` was not modified (dependencies already matched the committed lockfile).

Residual risks / leftovers for cleaner/hardener/reviewer: (a) the `dist/` directory now sits untracked in the worktree from this session's builds -- confirm it's `.gitignore`d (it is not touched by `git status`) and consider whether it should be cleaned before merge; (b) `NX_SOCKET_DIR` was only needed because of this long `/tmp/why-ts-worktrees/b1` path -- a normal contributor checkout won't hit this, but worth a one-line note somewhere if CI/dev docs ever run Nx from a deep tmp path (out of scope for this chunk, Nx itself is being removed by NX_TEARDOWN eventually); (c) did not attempt B2 (cli/irpc) -- `tsconfig.lib.json`'s `rootDir`/`outDir` pattern established here (declare both explicitly in the leaf `tsconfig.lib.json`, don't rely on the inherited base `rootDir: "."`) should be reused there, but each package's own `project.json` `build.options` should still be checked for path-affecting differences before assuming it transfers unchanged; (d) intentionally left Status as `in_progress` and did not commit, per protocol -- worktree is dirty with the 3 files listed above plus this Agent log entry.
2026-09-14 cleaner (B1): Reviewed `libs/core/package.json` and `libs/core/tsconfig.lib.json` (B1's only Files) for debug artifacts, inconsistent formatting, half-done work. Found none: `git --no-pager diff` shows exactly the two minimal, intentional edits described in the coder's log (added `scripts.build` to `package.json`; changed `outDir` and added `rootDir` in `tsconfig.lib.json`), no stray whitespace/commented-out code/console.log leftovers. Ran `npx --no-install prettier --check libs/core/package.json libs/core/tsconfig.lib.json` -> "All matched files use Prettier code style!". Confirmed `dist/` is gitignored (`.gitignore:4:dist`) and does not appear in `git status --porcelain` (only the 3 files the coder already listed are modified) -- residual risk (a) from the coder's log is resolved, no cleanup needed there. No changes made to either Files-list file; this is a no-op cleanup pass.

Re-verification: `rm -rf dist/libs/core`, then `NX_SOCKET_DIR=/tmp/nx-tmp-b1-cleaner COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/core build` from the worktree root -> succeeded, no errors. `find dist/libs/core -type f | sort` -> same 23 files as the coder's recorded ground truth (`package.json`, `README.md`, `src/index.{d.ts,js,js.map}`, `src/lib/{delay,drill,peek,promise-trigger}.{d.ts,js,js.map}`, `src/lib/types/{index,unsubscribe}.{d.ts,js,js.map}`). `node -e "require('./dist/libs/core')"` from the worktree root -> succeeded, logged exports `[ 'PromiseStatus', 'createPromiseTrigger', 'drill', 'peek', 'delay' ]`, matching the coder's recorded public API.

Flag for reviewer: none beyond what the coder already flagged in residual risks (b) and (c) above (NX_SOCKET_DIR tmp-path workaround note; B2 should reuse the rootDir/outDir pattern but verify per-package project.json differences first). Did not touch Status or checklists; leaving Status as `in_progress` per protocol, no commit made.
2026-09-14 hardener (B1): Ran only the declared verify commands, no redesign. (1) `rm -rf dist` (whole worktree `dist/`, confirmed absent afterward via `ls`). (2) `NX_SOCKET_DIR=/tmp/nx-tmp-b1-hardener COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/core build` (run via `pnpm -C /tmp/why-ts-worktrees/b1 --filter @why-ts/core build` from outside the worktree, equivalent cwd) -> succeeded, no errors, ran `tsc -p tsconfig.lib.json && cp package.json README.md ../../dist/libs/core/` as declared. (3) File-list gate: `find` + `sort` on both the coder's preserved ground truth (`/tmp/b1-ground-truth/nx-dist-libs-core`, still present, 23 files) and the fresh `dist/libs/core` (23 files), piped through `diff` -> exit 0, byte-identical list, no extras/missing. (4) CJS gate: `grep -nE "^\s*(import |export )"` on `dist/libs/core/src/index.js` -> zero matches; manual read confirms `require("tslib")`, `Object.defineProperty(exports, ...)`, `tslib_1.__exportStar(require(...), exports)` -- CommonJS, no ESM keywords; `diff` against ground truth's `src/index.js` -> exit 0, byte-identical. (5) Require gate: `node -e "process.chdir('/tmp/why-ts-worktrees/b1'); require('./dist/libs/core')"` -> succeeded, exports `['PromiseStatus', 'createPromiseTrigger', 'drill', 'peek', 'delay']`, matching the recorded public API. (6) Copy gate: `README.md` diff against ground truth -> exit 0, byte-identical; `package.json` diff -> differs only by ground truth's Nx-auto-injected `types` field (absent in new output, not required by AC-B1) vs. the new build's declared `scripts.build` field (present, matches coder's intentional addition verbatim) -- `main: "./src/index.js"` and `typings: "./src/index.d.ts"` present and byte-identical in both, and both resolve to real files (`ls` confirmed `src/index.js` and `src/index.d.ts` exist). (7) Scope check: `git --no-pager status --porcelain` in the worktree shows only `libs/core/package.json`, `libs/core/tsconfig.lib.json`, and this roadmap doc modified -- no stray files; `grep packageManager package.json` -> no match (still clean).

All four declared gates for this chunk pass: clean-build file-list match, CJS emit, require-succeeds, and package.json/README.md copied unmodified except the declared script addition.

Residual risks for reviewer: (a) none new found by hardening -- this pass only reproduced the coder's/cleaner's already-passing results a third time, from a hardener-owned `NX_SOCKET_DIR`; (b) still open from coder's log: `NX_SOCKET_DIR` workaround is an artifact of this worktree's long `/tmp` path, not a repo change, out of scope for B1; (c) still open: B2 should reuse the `rootDir`/`outDir` recipe from `libs/core/tsconfig.lib.json` but must independently verify each of `cli`/`irpc`'s `project.json` for path-affecting differences before assuming it transfers unchanged; (d) the ground-truth capture at `/tmp/b1-ground-truth/nx-dist-libs-core` lives outside the repo and outside this worktree -- it will not survive worktree/tmp cleanup, so if a future re-verification is needed after this session, the ground truth must be re-captured from a fresh `pnpm exec nx build core` run (assuming Nx is still installed) rather than assumed to still be at that path. Did not touch Status or checklists; leaving Status as `in_progress` per protocol (hardener does not approve), no commit made.
2026-09-14 reviewer (B1): Verdict: approve. Reviewed fresh (no prior authorship of coder/cleaner/hardener work); worked only inside /tmp/why-ts-worktrees/b1.

(1) Ground-truth capture: confirmed genuine, not asserted from memory. Coder's log gives a specific 23-file listing plus root-cause analysis of Nx's `rootDir`/`outDir` behavior (read from `libs/core/project.json`). I independently reran `NX_SOCKET_DIR=/tmp/nx-tmp-b1-reviewer-verify COREPACK_ENABLE_AUTO_PIN=0 pnpm exec nx build core` myself from a clean `dist/` -- it succeeded and produced the exact same 23 files, and Nx's `dist/libs/core/package.json` did carry the auto-injected `"types": "./src/index.d.ts"` field the coder described. Ground truth is real and reproducible, not fabricated.

(2) CJS spot check: `rm -rf dist && NX_SOCKET_DIR=/tmp/nx-tmp-b1-reviewer COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/core build` succeeded; `head -20 dist/libs/core/src/index.js` shows `"use strict"`, `Object.defineProperty(exports, ...)`, `require("tslib")`, `tslib_1.__exportStar(require(...), exports)` -- CommonJS, zero `import`/`export` keyword matches via grep.

(3) package.json/README.md: both copied into `dist/libs/core/`; `main: "./src/index.js"` and `typings: "./src/index.d.ts"` present, unmodified, and both resolve to real files (`ls` confirmed). `README.md` byte-identical to source via `diff`.

(4) `node -e "require('./dist/libs/core')"` succeeded, logged exports `['PromiseStatus', 'createPromiseTrigger', 'drill', 'peek', 'delay']`.

(5) File list: my own `find dist/libs/core -type f | sort` produced the same 23 paths recorded in the coder/cleaner/hardener log entries -- no missing/extra files.

(6) Scope: `git status --short` shows exactly `libs/core/package.json`, `libs/core/tsconfig.lib.json`, and this roadmap doc modified. `grep packageManager package.json` in repo root -> no match, no drift. No scope creep.

(7) Cleanup: cleaner's "no changes needed" is plausible -- `git --no-pager diff` on the two Files-list files shows only the two minimal edits described (added `scripts.build`; changed `outDir`, added `rootDir`), consistent with a clean, intentional, unpadded diff.

Residual risks (none block approval): (a) `NX_SOCKET_DIR` workaround is specific to this worktree's long `/tmp` path, not a repo change -- irrelevant to normal contributor checkouts; (b) B2 must independently verify `cli`/`irpc`'s `project.json` before reusing this `rootDir`/`outDir` recipe, per coder/hardener's own note; (c) the ground-truth tree at `/tmp/b1-ground-truth/nx-dist-libs-core` won't survive worktree cleanup -- any future re-verification should re-run `pnpm exec nx build core` fresh rather than assume that path still exists (I did exactly that here and it reproduced cleanly). Checked off all three remaining Reviewer checklist boxes above. Did not set Status to `approved` and did not commit -- orchestrator's job.

---

### B2 — tsc build for cli and irpc

**Status:** approved

**Depends on:** B1, F1

**Files:** `libs/cli/package.json`, `libs/cli/tsconfig.lib.json`, `libs/irpc/package.json`, `libs/irpc/tsconfig.lib.json`

#### Implementor checklist

- [x] Repeat B1's proven recipe for `cli` and `irpc`
- [x] Run `pnpm -r run build` from repo root; capture the log and confirm `core`'s build completes before `irpc`'s build starts
- [x] Causal proof (not just an assertion of pnpm's default behavior): temporarily introduce a build error in `core`, rerun `pnpm -r run build`, confirm `irpc`'s build fails or never starts, then revert the induced error
- [x] Confirm `irpc`'s compiled output still resolves `@why-ts/core` types via the `tsconfig.base.json` path alias at compile time, not via `core`'s `dist` output

#### Reviewer checklist

- [x] Confirm the causal build-order proof was actually performed (log evidence), not just cited as "pnpm does this by default"
- [x] Confirm `cli`'s build (no internal dependency) is unaffected by ordering concerns

#### Agent log

2026-09-14 coder (B2): Starting tsc build for cli and irpc. Status: in_progress.

2026-09-14 coder (B2): Ran `COREPACK_ENABLE_AUTO_PIN=0 pnpm install` first (fresh worktree, no `node_modules`) -- `grep packageManager package.json` empty before and after every `pnpm`/`nx` invocation in this session, confirmed clean throughout. Captured Nx ground truth per-package as instructed (do not assume layout transfers from B1's core recipe):

- `NX_SOCKET_DIR=/tmp/nx-tmp-b2-coder COREPACK_ENABLE_AUTO_PIN=0 pnpm exec nx build cli` -- **fails**, `RangeError: Maximum call stack size exceeded` deep inside TypeScript 5.5.4's `outofbandVarianceMarkerHandler` (variance-checking recursion). This is the exact pre-existing, migration-unrelated failure already documented in this roadmap's Decisions section ("AC-W1a narrowing", item 2): reproduced identically here, confirming it is not something B2 introduced and is out of scope to fix (tracked separately, human-directed). No `dist/libs/cli` ground truth could be captured via Nx as a result -- recorded as a real finding, not assumed away.
- `NX_SOCKET_DIR=/tmp/nx-tmp-b2-coder COREPACK_ENABLE_AUTO_PIN=0 pnpm exec nx build irpc` -- succeeds, and (notably) ran `nx run core:build` first automatically (Nx's own project-graph dependency detection, via source-import scanning, already knows `irpc` depends on `core`). Ground truth `dist/libs/irpc/` (33 files, `find dist/libs/irpc -type f | sort`): `package.json`, `README.md`, plus the full mirrored `src/` tree (`index.{d.ts,js,js.map}`, `lib/irpc.{d.ts,js,js.map}`, `lib/irpc.proxy.*`, `lib/irpc.types.*`, `lib/transport/{index,local-bridge.transport,post-message-base.transport,post-message.transport,transferer,transport,worker-owner.transport,worker-self.transport}.{d.ts,js,js.map}`) -- same shape as B1's core recipe (flat `src/` mirror, no nested `libs/irpc/` prefix), and critically: **no `libs/core/` files anywhere inside `dist/libs/irpc/`** -- Nx's build does not pull core's compiled output into irpc's package. `dist/libs/irpc/src/lib/irpc.types.d.ts` line 1 reads `import type { Unsubscribe } from '@why-ts/core';` (bare specifier, unresolved/unrewritten) and the corresponding `.js` files use `const core_1 = require("@why-ts/core");` -- confirms today's Nx build resolves `@why-ts/core` at compile time via the bare module specifier (i.e. via `tsconfig.base.json`'s `paths` alias to `libs/core/src/index.ts` for type-checking) and leaves the runtime `require` unrewritten, to be resolved by whatever's on the module path at runtime (matches the roadmap's Decisions claim this is unchanged from today). Preserved both ground-truth trees to `/tmp/b2-ground-truth/{nx-dist-libs-irpc,nx-dist-libs-core-via-irpc-depchain}` (outside the repo, will not survive worktree cleanup -- future re-verification must re-run `pnpm exec nx build irpc` fresh) and deleted the worktree's `dist/` before building the new way.

Applied B1's recipe to `cli` (works unmodified, since `cli` has no cross-package source imports, exactly like `core`): `libs/cli/tsconfig.lib.json` gained explicit `"outDir": "../../dist/libs/cli"` + `"rootDir": "."` (both now resolve relative to `libs/cli/`, matching `project.json`'s `outputPath: "dist/libs/cli"` / `main: "libs/cli/src/index.ts"` options, mirroring core's B1 fix exactly). `libs/cli/package.json` needed more than B1's core recipe, because -- unlike `core`/`irpc` -- `cli`'s _source_ `package.json` had no `type`/`main`/`typings` fields at all (Nx injects these at publish time from the executor's own knowledge of the build output, not present in committed source). Verified via `fetch https://registry.npmjs.org/@why-ts/cli/latest`: the real published `@why-ts/cli@0.0.1` has `"type": "commonjs"`, `"main": "./src/index.js"`, `"types": "./src/index.d.ts"` -- added the equivalent `"type": "commonjs"`, `"main": "./src/index.js"`, `"typings": "./src/index.d.ts"` (matching core/irpc's existing source-level convention of `typings` over `types`) plus `"scripts": {"build": "tsc -p tsconfig.lib.json && cp package.json README.md ../../dist/libs/cli/"}` (identical shape to B1's core script). Ran `COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/cli build` -- **fails**, identical `RangeError: Maximum call stack size exceeded` / `outofbandVarianceMarkerHandler` stack trace as the `nx build cli` failure above (byte-for-byte same crash signature), proving this is the pre-existing TS bug, not a regression caused by the `rootDir`/`outDir`/`package.json` edits. Additionally tried `node --stack-size=8000 .../tsc.js -p tsconfig.lib.json` and `ulimit -s 65500` (both from `libs/cli`) to rule out a simple stack-depth limitation -- both crash identically, confirming this is unbounded/runaway recursion in TS's variance checker, not a shallow-but-large call depth fixable by more stack. Per this roadmap's own Decisions ("Nx build parity is dropped from this roadmap's Acceptance entirely... tracked as a separate, human-directed fix roadmap, not gating this migration"), did not attempt further fixes to the underlying TS bug (out of scope for B2; the `tsconfig.lib.json`/`package.json` recipe itself is correctly applied and verified-unaffected by this pre-existing crash).

Applied B1's recipe to `irpc`, but it required real adaptation (not a blind copy), exactly as B1's own residual-risk note anticipated: setting an explicit narrow `"rootDir": "."` (resolving to `libs/irpc/`) in `libs/irpc/tsconfig.lib.json`, identical to core/cli's recipe, **fails** with `TS6059: File '.../libs/core/src/...' is not under 'rootDir' '.../libs/irpc'` for every core file irpc imports (both `import type { Unsubscribe }` and value imports `import { PromiseStatus, createPromiseTrigger, drill } from '@why-ts/core'` in `irpc.ts`/`irpc.types.ts`/`transferer.ts`/transport files pull core's `.ts` source into irpc's compile program, which a narrow `rootDir` rejects). Root cause: `core`/`cli` have zero cross-package source imports, so a `rootDir` scoped to their own package directory trivially contains every file in their compile program; `irpc` does not have that property. Confirmed this is a real, structural difference (not something to paper over): temporarily removing the `rootDir` override entirely (leaving `outDir` only, so `rootDir` inherits `tsconfig.base.json`'s explicit `"rootDir": "."`, which resolves to the _repo root_ per the extends-resolution rule B1 already established) does compile successfully, but produces the wrong nested layout: `dist/libs/irpc/libs/irpc/src/...` (irpc's own files, double-nested) _and_ `dist/libs/irpc/libs/core/src/...` (a redundant recompiled mirror of core's source, pulled in only for irpc's own type-checking closure) -- confirmed via `find dist -type f | sort` after a clean build in that intermediate state. This is not the desired shape (does not match Nx's flat `dist/libs/irpc/src/...`, and pollutes irpc's own package output with an unwanted `core` mirror) -- plain `tsc` has no single-invocation way to keep `rootDir` broad enough to admit cross-package files for type-checking while still emitting only the requesting package's own files with a flat, package-relative `outDir` layout (Nx's own executor evidently does this internally via the TS compiler API, not via a plain CLI-equivalent `tsc -p` invocation). Adapted recipe: kept `outDir: "../../dist/libs/irpc"` with **no explicit `rootDir` override** (inherits repo-root default, avoiding the TS6059 violation), then added a postbuild flatten+prune step to `libs/irpc/package.json`'s `scripts.build`: `"tsc -p tsconfig.lib.json && rm -rf ../../dist/libs/irpc/src && mv ../../dist/libs/irpc/libs/irpc/src ../../dist/libs/irpc/src && rm -rf ../../dist/libs/irpc/libs && cp package.json README.md ../../dist/libs/irpc/"` -- moves irpc's own nested subtree up to the flat expected location and deletes the redundant `core` mirror, mirroring B1's own pattern of a second postbuild shell step (`cp package.json README.md ...`) rather than trying to force everything through `tsc`'s options alone. `libs/irpc/package.json` already had `type`/`main`/`typings` declared correctly from F1 (needed only the `scripts.build` addition, unlike `cli`).

Ran `rm -rf dist && COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/core build` then `pnpm --filter @why-ts/irpc build` with the adapted recipe -- both succeed. Diffed the result against the preserved Nx ground truth: (1) file list -- `find dist/libs/irpc -type f | sed 's#^dist/libs/irpc/##' | sort` vs. the same on `/tmp/b2-ground-truth/nx-dist-libs-irpc` piped through `diff` -> exit 0, byte-identical 33-file list, no extras/missing; (2) `diff dist/libs/irpc/src/index.js /tmp/.../src/index.js` -> exit 0; `diff .../lib/irpc.js .../lib/irpc.js` -> exit 0; `diff .../src/index.d.ts .../src/index.d.ts` -> exit 0; `diff .../README.md .../README.md` -> exit 0 (all byte-identical); (3) CJS check: `grep -nE "^\s*(import |export )" dist/libs/irpc/src/index.js dist/libs/irpc/src/lib/irpc.js` -> zero matches (exit 1), manual read confirms `require(...)`/`exports`/`tslib_1.__exportStar` -- CommonJS, no ESM keywords; (4) core-resolution check: `grep -n "require(" dist/libs/irpc/src/lib/irpc.js` and `.../transport/transferer.js` both show `const core_1 = require("@why-ts/core");` -- the literal bare specifier, unrewritten by `tsc` (confirms `paths` is a type-checking-only resolution aid, never rewriting emitted `require`/`import` specifiers -- standard, well-documented TS behavior), and no file inside `dist/libs/irpc/` references any `../core` or `dist/libs/core` path -- irpc's compiled output resolves `@why-ts/core` at compile time purely via the `tsconfig.base.json` path alias to `core`'s _source_, never via `core`'s `dist` output, exactly as AC-B2's third bullet requires; (5) require-succeeds check: real npm/pnpm consumers get `@why-ts/core` installed as an ancestor-`node_modules` sibling automatically, but this pnpm workspace's own local dev layout (from F1) only symlinks workspace deps _inside the consuming package's own_ `node_modules` (`libs/irpc/node_modules/@why-ts/core -> ../../../core`, confirmed via `ls -la`), not hoisted to the repo-root `node_modules` (which has no `@why-ts` entries at all) -- so a naive `node -e "require('./dist/libs/irpc')"` from the repo root fails with `Cannot find module '@why-ts/core'` (this is a pnpm workspace-layout artifact of local dev, not a defect in irpc's build output). Verified requireability correctly by manually creating `dist/libs/irpc/node_modules/@why-ts/core` as a symlink to `libs/core` (simulating what any real install -- local or published -- provides as an ancestor `node_modules` entry) and rerunning the same `require` -- succeeded, logging `['init', 'LocalBridgeTransport', 'PostMessageTransport', 'WorkerOwnerTransport', 'WorkerSelfTransport']` (matches irpc's public API). Removed that manual symlink afterward (was only ever inside gitignored `dist/`, never part of the repo).

Build-order proof: ran `rm -rf dist && COREPACK_ENABLE_AUTO_PIN=0 pnpm -r run build` (plain, default `--bail`) from repo root -- log shows `libs/cli build$ ...` and `libs/core build$ ...` starting together (both have no inter-dependency, so pnpm runs them concurrently), `libs/core build: Done`, then `libs/cli build` crashes with the pre-existing `RangeError` documented above, and pnpm's default bail-on-first-failure stops the whole recursive run immediately -- `libs/irpc build$` is **never printed at all** in this log (full capture at `/tmp/b2-pnpm-r-build-causal-defaultbail.log`, taken with the induced-error scenario below, but the same never-starts behavior holds in the clean-tree case too since `cli` fails regardless). Because `cli`'s pre-existing, out-of-scope crash prevents a plain default-bail `pnpm -r run build` from ever reaching `irpc` at all in this sandbox, additionally ran `COREPACK_ENABLE_AUTO_PIN=0 pnpm --no-bail -r run build` (full log at `/tmp/b2-pnpm-r-build-nobail.log`) to observe the full picture in one pass: `libs/core build: Done` appears, _then_ `libs/irpc build$ tsc -p tsconfig.lib.json && ...` starts and completes (`libs/irpc build: Done`), while `libs/cli build` fails independently and concurrently with `core`/`irpc` (started at the same time as `core`, never blocked on anything) -- directly observed evidence that (a) `core` completes before `irpc`'s build step starts, and (b) `cli`'s build is unaffected by ordering concerns (starts immediately, same as `core`, regardless of any other package's state), satisfying the Reviewer checklist's second item.

Causal proof (not an assertion): edited `libs/core/src/index.ts`, appending a line of garbage (`THIS IS A DELIBERATE SYNTAX ERROR FOR B2 CAUSAL PROOF ~!@#$%^&*(`) after the five existing `export * from ...` lines. Reran `COREPACK_ENABLE_AUTO_PIN=0 pnpm -r run build` (plain, default bail) from a clean `dist/` -- log (`/tmp/b2-pnpm-r-build-causal-defaultbail.log`): `libs/core build` fails immediately with real TS parser errors pointing at the induced garbage line (`src/index.ts(6,1): error TS1435: Unknown keyword or identifier...` etc.), pnpm reports `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` and stops -- `libs/irpc build` is **never printed anywhere in the log**, i.e. irpc's build never started, because `core` (its workspace dependency) failed first. Also reran with `--no-bail` (`/tmp/b2-pnpm-r-build-causal.log`) to see irpc's own reaction rather than just its absence: `libs/core build` fails with the same parser errors, `libs/cli build` fails with its own unrelated pre-existing crash, and `libs/irpc build` _does_ start (since `--no-bail` forces every package to attempt its script) but **fails**, with errors explicitly pointing at `../core/src/index.ts(6,1): error TS1435...` (the exact induced garbage, referenced from _inside irpc's own compile_, because irpc's program pulls in core's broken source via the path alias) -- `pnpm`'s summary: "3 fails, 0 passes". This is real causal proof: irpc's build result is directly downstream of `core`'s broken source, not merely sequenced after it by coincidence. Reverted the induced error immediately after: `git --no-pager diff libs/core/src/index.ts` -> empty (byte-identical to the original committed content), confirmed via `cat libs/core/src/index.ts` showing only the original five `export * from ...` lines. Re-ran `COREPACK_ENABLE_AUTO_PIN=0 pnpm --no-bail -r run build` once more post-revert (`/tmp/b2-pnpm-r-build-postrevert.log`) -- `core: Done`, `irpc: Done`, `cli` still fails only on its pre-existing unrelated bug -- confirms the revert fully restored working order and nothing else regressed.

Cleanup / scope hygiene: discovered (before finishing) that an early, abandoned attempt at the narrow-`rootDir` recipe for `irpc` (the one that hit `TS6059` above) had left 21 stray compiled `.js`/`.d.ts`/`.js.map` files directly inside `libs/core/src/` (e.g. `libs/core/src/index.js`, `libs/core/src/lib/delay.d.ts`, etc.) -- root cause: when `tsc` hits a `TS6059` rootDir violation, it does not abort emission entirely (no `noEmitOnError` is set anywhere in this repo's tsconfigs, so tsc's default is to still emit despite type/semantic errors); for the specific files that violate the declared `rootDir` (here, `core`'s files, pulled into `irpc`'s compile program but outside `irpc`'s declared `rootDir`), `tsc` fell back to writing them in place, alongside their own `.ts` source, since no valid `outDir`-relative path could be computed for them. Deleted all 21 stray files (`find libs/core/src -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" \) -delete`); confirmed via `find libs/cli/src libs/irpc/src -type f \(-name "*.js" -o -name "*.d.ts" -o -name "*.js.map"\)` that no other package's source tree was similarly contaminated (empty result), and `git --no-pager status --porcelain` afterward shows only the 4 declared `Files` plus this roadmap doc modified -- no stray untracked files remain. Also found and fixed a cosmetic issue introduced by my own edits: a trailing comma landed in both `libs/cli/tsconfig.lib.json` and `libs/irpc/tsconfig.lib.json` (JSON5-style, harmless to `tsc` but inconsistent with this repo's existing no-trailing-comma style in every other tsconfig) -- fixed via direct `perl -0pi` rewrite after `edit_file`/`write_file` both inexplicably reported "No edits were made" for this specific fix (possible tool caching quirk); re-verified both files are trailing-comma-free and reran the full `core`+`irpc` build sequence afterward to confirm the fix didn't break anything (`pnpm --no-bail -r run build` -> `core: Done`, `irpc: Done`, file-list diff against ground truth still exits 0).

Files changed (matches B2's declared Files list exactly): `libs/cli/package.json` (added `type`/`main`/`typings`/`scripts.build`), `libs/cli/tsconfig.lib.json` (`outDir` changed to `../../dist/libs/cli`, added `rootDir: "."`), `libs/irpc/package.json` (added `scripts.build` only -- `type`/`main`/`typings` already present from F1), `libs/irpc/tsconfig.lib.json` (`outDir` changed to `../../dist/libs/irpc`; deliberately **no** `rootDir` override, unlike `core`/`cli`, per the adaptation above). Plus this roadmap doc (Status/checklist/log only). Final `git --no-pager status --porcelain` shows exactly these 4 files plus the roadmap doc modified, nothing else -- `dist/` deleted before finishing (gitignored, does not appear in status regardless). `grep packageManager package.json` empty throughout the entire session, every time it was checked (before/after `pnpm install`, before/after every subsequent `pnpm`/`nx` invocation).

Residual risks / leftovers for cleaner/hardener/reviewer: (a) `cli`'s `build` script is present and matches the correct, verified recipe (byte-for-byte same config pattern as `core`'s approved B1 recipe), but **cannot currently complete** in this sandbox due to a pre-existing, migration-unrelated TypeScript 5.5.4 `RangeError` (identical crash via both `nx build cli` and plain `tsc`, with/without larger stack size) -- already documented and explicitly ruled out of this roadmap's Acceptance scope by the Decisions section; reviewer should confirm this reasoning holds and not treat it as a B2 regression, but also should not treat `cli`'s build as genuinely proven-working end-to-end (it isn't, in this environment) -- this is a known, accepted gap, not a hidden one; (b) `irpc`'s recipe needed a real adaptation (postbuild flatten+prune shell step) rather than a literal copy of B1's `rootDir`/`outDir`-only approach, because `irpc` (unlike `core`/`cli`) has cross-package source imports that a narrow `rootDir` rejects -- this is more fragile than a pure `tsc` option (depends on the exact nested-path shape `tsc` produces when `rootDir` is left at its repo-root default, i.e. `dist/libs/irpc/libs/irpc/src/...` and `dist/libs/irpc/libs/core/src/...`); if `irpc` ever gains a _second_ internal workspace dependency, or the repo's directory depth changes, this exact `mv`/`rm -rf` shell pipeline would need updating -- flagged clearly, not hidden; (c) the `--no-bail` flag was necessary to observe `core`→`irpc` ordering and the causal failure in a single `pnpm -r run build` pass, since the default bail-on-first-failure stops before `irpc` ever starts once `cli` (independently) fails first -- both the default-bail behavior (irpc never starts, log evidence captured) and the `--no-bail` behavior (full picture, log evidence captured) are documented above; reviewer should treat both logs as valid, complementary evidence, not one as a substitute forcing around the other; (d) ground-truth trees at `/tmp/b2-ground-truth/*` and full build logs at `/tmp/b2-pnpm-r-build-*.log` live outside the repo/worktree and will not survive cleanup -- future re-verification should re-run the same `pnpm exec nx build <pkg>` / `pnpm -r run build` commands fresh rather than assume those paths still exist; (e) intentionally left Status as `in_progress` and did not commit, per protocol -- worktree is dirty with exactly the 4 files listed above plus this roadmap doc.

2026-09-14 cleaner (B2): No changes needed. Reviewed all 4 declared Files against B1's approved core recipe for field order/shape and `prettier --check` (all pass). `irpc`'s flatten/prune `scripts.build` (`tsc -p tsconfig.lib.json && rm -rf ../../dist/libs/irpc/src && mv ../../dist/libs/irpc/libs/irpc/src ../../dist/libs/irpc/src && rm -rf ../../dist/libs/irpc/libs && cp package.json README.md ../../dist/libs/irpc/`) is already as clean/robust as it can be without redesigning the approach: paths are static literals with no spaces/globs, so quoting adds nothing (and core/cli's own scripts are unquoted too -- quoting only irpc's would be an inconsistency, not an improvement); the leading `rm -rf .../dist/libs/irpc/src` is a real, useful idempotency guard for reruns without a clean `dist/` first (verified: harmless no-op via `rm -rf` on a missing path when run against a clean tree); `&&`-chaining already aborts on first failure, matching `core`'s own script's error-handling style. No trailing commas or stray whitespace found in either `tsconfig.lib.json`. Cleanup verification: `find libs/core/src libs/irpc/src libs/cli/src -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" \)` -> empty, confirms zero stray compiled files remain anywhere the coder's 21-file cleanup targeted (or elsewhere); `git --no-pager status --short` -> only the 4 declared Files plus this roadmap doc, matching the coder's own final-state claim exactly. Re-verify: `rm -rf dist && COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/core build && COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter @why-ts/irpc build` -> both succeed; `find dist/libs/irpc -type f | sort` -> same 33-file flat layout the coder documented (no `libs/core` mirror, no double-nesting); re-checked `libs/core/src` for stray files immediately after this fresh build -> still empty. `libs/cli`'s `build` script (`tsc -p tsconfig.lib.json && cp package.json README.md ../../dist/libs/cli/`) is present and correctly formed (identical shape to `core`'s approved recipe); did not attempt to run it further, per the coder's documented pre-existing/out-of-scope `RangeError` finding -- no new evidence needed, nothing to add. `dist/` deleted again after re-verification (gitignored). Status left as `in_progress`; not committed. Handing off to hardener.

2026-09-14 hardener (B2): Independently re-ran every declared verify command from a clean `dist/`; all pass, evidence matches coder/cleaner's claims exactly. Did not redesign, approve, or change Status.

- Gate 1 (build order, default bail): `rm -rf dist && COREPACK_ENABLE_AUTO_PIN=0 pnpm -r run build` -- log shows `libs/core build: Done` before `libs/cli build` crashes with the pre-existing `RangeError: Maximum call stack size exceeded` (`outofbandVarianceMarkerHandler`); pnpm's default bail-on-first-failure stops immediately -- `grep -c "libs/irpc" <log>` -> `0`, confirming `libs/irpc build` is never printed anywhere. PASS. Full log: `/tmp/hardener-b2-build-defaultbail.log`.
- Gate 1b (build order, full picture): `COREPACK_ENABLE_AUTO_PIN=0 pnpm --no-bail -r run build` -- log shows `libs/core build: Done`, then `libs/irpc build$ tsc -p tsconfig.lib.json && ...` starts and completes (`libs/irpc build: Done`); `libs/cli build` fails independently, started concurrently with `core` (unaffected by ordering, satisfying Reviewer checklist item 2). PASS. Full log: `/tmp/hardener-b2-build.log`.
- Gate 2 (causal proof): appended `THIS IS A DELIBERATE SYNTAX ERROR FOR HARDENER CAUSAL PROOF ~!@#$%^&*(` to `libs/core/src/index.ts`. Reran default-bail `pnpm -r run build`: `libs/core build` fails with real `TS1435`/`TS1434`/`TS1109`/`TS1005` parser errors pointing at the induced garbage line; `grep -c "libs/irpc" <log>` -> `0` -- irpc's build never started. Reran `--no-bail`: `libs/core build` fails with the same parser errors, and `libs/irpc build` **starts** (forced by `--no-bail`) but **fails**, with errors explicitly at `../core/src/index.ts(6,1): error TS1435...` -- the exact induced garbage, referenced from inside irpc's own compile program. This is real causal proof, not sequencing coincidence: irpc's failure is directly downstream of core's broken source. PASS. Logs: `/tmp/hardener-b2-causal-defaultbail.log`, `/tmp/hardener-b2-causal-nobail.log`. Reverted immediately: `git checkout -- libs/core/src/index.ts`; `git --no-pager diff libs/core/src/index.ts` -> empty (byte-identical to committed content). Re-ran `--no-bail -r run build` post-revert -- `libs/core build: Done`, `libs/irpc build: Done` -- confirms full restoration. Log: `/tmp/hardener-b2-postrevert.log`.
- Gate 3 (compile-time type resolution via path alias, not dist): `tsconfig.base.json`'s `paths` maps `"@why-ts/core": ["libs/core/src/index.ts"]` (source, not `dist`). `libs/irpc/src/lib/irpc.ts`/`irpc.types.ts` import `@why-ts/core` as a bare specifier; the compiled `dist/libs/irpc/src/lib/irpc.types.d.ts` line 1 still reads `import type { Unsubscribe } from '@why-ts/core';` (unrewritten), and `dist/libs/irpc/src/lib/irpc.js` line 4 reads `const core_1 = require("@why-ts/core");` (also unrewritten). `grep -rln "dist/libs/core\|dist/core" dist/libs/irpc/` -> no matches (`none found`). `find dist/libs/irpc -type f | sort` -> same 33-file flat layout the coder/cleaner documented, no `libs/core` mirror anywhere inside it. PASS.
- Gate 4 (cli build script present/correct despite pre-existing, out-of-scope crash): `libs/cli/package.json`'s `scripts.build` (`tsc -p tsconfig.lib.json && cp package.json README.md ../../dist/libs/cli/`) and `libs/cli/tsconfig.lib.json` (`outDir`/`rootDir` set, matches core's approved B1 shape) are present and structurally correct -- both files parse as valid JSON (`node -e "JSON.parse(...)"` on both `tsconfig.lib.json`s succeeded, no illegal trailing commas). Isolated `pnpm --filter @why-ts/cli build` reproduces the identical documented `RangeError: Maximum call stack size exceeded` crash signature, confirming this is the same pre-existing, out-of-scope bug (Decisions: "AC-W1a narrowing", item 2) and not a B2 regression. `cli`'s build cannot be proven to complete end-to-end in this sandbox -- known, accepted, already-documented gap, not hidden.
- Hygiene: `find libs/core/src libs/irpc/src libs/cli/src -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" \)` -> empty (no stray compiled files). `git --no-pager status --porcelain` -> exactly the 4 declared Files plus this roadmap doc, nothing else. `dist/` deleted after all verification (gitignored). `grep packageManager package.json` empty throughout.

Residual risks for reviewer (carried forward from coder/cleaner, independently re-confirmed, none resolved by hardener since resolving them is out of this role's scope):

1. **`irpc`'s flatten/prune postbuild shell step is fragile to future structural change.** `libs/irpc/package.json`'s `scripts.build` depends on the exact nested-path shape `tsc` emits when `rootDir` is left at its repo-root default (`dist/libs/irpc/libs/irpc/src/...` + `dist/libs/irpc/libs/core/src/...`) because `irpc` (unlike `core`/`cli`) has cross-package source imports that reject a narrow `rootDir` with `TS6059`. If `irpc` ever gains a second internal workspace dependency, or the repo's directory depth changes, this `mv`/`rm -rf` pipeline will need updating -- it is not a generic solution, it is shaped to today's exact two-package (`core` + `irpc`) topology. Flagged, not fixed (out of scope for hardening).
2. **`cli`'s `build` script cannot be proven to complete in this sandbox.** The script/tsconfig recipe is verified correct and byte-consistent with core's approved B1 pattern, but the pre-existing TS 5.5.4 `RangeError` (out-of-scope, tracked separately per Decisions) means no one has yet observed a real, successful `dist/libs/cli` output from the plain-tsc pipeline. This is a real, accepted gap in end-to-end proof for `cli` specifically -- reviewer should not treat `cli`'s build as fully proven, only as correctly configured.
3. **Ground-truth artifacts and logs live outside the repo** (`/tmp/b2-ground-truth/*`, `/tmp/b2-pnpm-r-build-*.log` from coder; `/tmp/hardener-b2-*.log` from this session) and will not survive worktree cleanup. Future re-verification should re-run the commands fresh rather than assume these paths persist.
4. No new risks were found by hardening beyond what coder/cleaner already flagged; all previously-flagged risks were independently reproduced, not just re-cited.

Status left as `in_progress`; Status not changed to approved (not this role's call). Not committed. Handing off to reviewer.

2026-09-14 reviewer (B2): Verdict: approve. Reviewed fresh (no prior authorship of coder/cleaner/hardener work); worked only inside `why-ts/.worktrees/b2`; re-ran every claimed command myself rather than trusting the log.

(1) Causal build-order proof -- independently reproduced, not just cited. `git --no-pager diff` on the 4 declared Files matches the coder's described edits exactly (spot-checked all 4 files directly). Ran `rm -rf dist && pnpm -r run build` (default bail) from a clean tree: `libs/core build: Done`, then `libs/cli build` crashes with the pre-existing `RangeError`, and `grep -c "libs/irpc" <log>` -> `0` -- irpc's build line never printed. Ran `pnpm --no-bail -r run build`: `core: Done` first, then `libs/irpc build$ ...` starts and completes (`irpc: Done`), while `cli` fails independently, started concurrently with `core` (unaffected by ordering). Then did my own causal injection (not reusing the coder's/hardener's prior edit): appended a garbage line to `libs/core/src/index.ts` myself. Default-bail rerun: `core` fails with real `TS1435`/`TS1434`/`TS1109`/`TS1005` parser errors at the induced line; `irpc` never printed in the log (grep count 0). `--no-bail` rerun: `core` fails with the same parser errors, and `irpc` _starts_ but _fails_, with errors explicitly at `../core/src/index.ts(6,1): error TS1435...` -- the exact induced garbage, referenced from inside irpc's own compile program. This is real causal proof (irpc's failure is downstream of core's broken source), not sequencing coincidence. Reverted: `git checkout -- libs/core/src/index.ts`; `git --no-pager diff libs/core/src/index.ts` -> empty, `cat` shows only the original 5 `export * from ...` lines. Rebuilt post-revert (`pnpm --no-bail -r run build`): `core: Done`, `irpc: Done`, `cli` still fails only on its pre-existing unrelated bug -- full restoration confirmed.

(2) `cli`'s build is unaffected by ordering concerns. Its failure is the pre-existing, documented, out-of-scope TS `RangeError: Maximum call stack size exceeded` (`outofbandVarianceMarkerHandler` recursion) -- byte-identical crash signature in every rerun I did (isolated `pnpm --filter @why-ts/cli build`, default-bail `-r run build`, `--no-bail -r run build`, both before and after my own causal-error injection/revert). `cli` starts concurrently with `core` every time, never blocked by anything -- confirms its failure is intrinsic to the TS bug, not a B2-introduced ordering regression, and not something new from B2's Files (only `tsconfig.lib.json`'s `outDir`/`rootDir` and `package.json`'s `type`/`main`/`typings`/`scripts.build` were added -- none of these affect TS's variance-checker recursion path).

(3) Compile-time resolution via path alias, not `core`'s dist. `tsconfig.base.json`'s `paths` maps `"@why-ts/core": ["libs/core/src/index.ts"]` (source). My own fresh build: `dist/libs/irpc/src/lib/irpc.js` line 4 reads `const core_1 = require("@why-ts/core");` (bare specifier, unrewritten); `dist/libs/irpc/src/lib/irpc.types.d.ts` line 1 reads `import type { Unsubscribe } from '@why-ts/core';` (also unrewritten). `grep -rln "dist/libs/core\|dist/core" dist/libs/irpc/` -> no matches. `find dist/libs/irpc -type f | sort` -> 33 files, flat `src/` layout, no `libs/` subdirectory anywhere inside it (confirmed no stray `dist/libs/irpc/libs/core` mirror survives the flatten/prune step). Matches AC-B2's third bullet exactly.

(4) Scope: `git --no-pager status --short` shows exactly the 4 declared Files (`libs/cli/package.json`, `libs/cli/tsconfig.lib.json`, `libs/irpc/package.json`, `libs/irpc/tsconfig.lib.json`) plus this roadmap doc -- nothing else. `find libs/core/src libs/cli/src libs/irpc/src -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" \)` -> empty, confirming no stray compiled files leaked into any lib's `src/` (the coder's documented 21-file `TS6059`-fallout cleanup held). `grep packageManager package.json` -> no match, no drift. `dist/` deleted after every verification pass (gitignored, doesn't affect status regardless).

(5) Cleanup: cleaner's "no changes needed" is plausible -- `git --no-pager diff` on all 4 Files shows only the minimal, intentional edits described by the coder (matches what I read directly), and `prettier --check` on all 4 passes. Sanity-checked `libs/irpc/package.json`'s flatten/prune `scripts.build` myself: ran it fresh (`pnpm --filter @why-ts/core build` then `pnpm --filter @why-ts/irpc build` from a clean `dist/`) -- produces the correct flat 33-file layout with no stray `libs/` directory or `core` mirror left behind. The script is coherent for this chunk's scope: static literal paths (no spaces/globs needing quotes, consistent with core/cli's own unquoted scripts), a real idempotency guard (`rm -rf .../src` before the `mv`, harmless on a missing path), and `&&`-chaining that aborts on first failure like every other package's script. It is admittedly shaped to today's exact two-package topology (flagged already by coder/hardener) -- I agree this is an acceptable, clearly-flagged fragility for a chunk scoped to "repeat B1's recipe for cli and irpc," not a defect to block on.

Verdict: **approve**.

Residual risks (none block approval, all previously flagged by coder/hardener, independently confirmed by me rather than newly discovered):

1. `irpc`'s flatten/prune postbuild shell step is shaped to today's exact two-package (`core` + `irpc`) topology and the specific nested-path shape `tsc` emits when `rootDir` is left at its repo-root default. If `irpc` ever gains a second internal workspace dependency, or repo directory depth changes, the `mv`/`rm -rf` pipeline will need updating. Flagged, not a blocker for this chunk's scope.
2. `cli`'s build recipe (`tsconfig.lib.json`/`package.json`) is correctly configured and verified byte-consistent with `core`'s approved B1 pattern, but cannot be proven to complete end-to-end in this sandbox due to the pre-existing, out-of-scope TS 5.5.4 `RangeError` -- a real, accepted gap in end-to-end proof for `cli` specifically, already ruled out of this roadmap's Acceptance scope by the Decisions section.
3. Ground-truth artifacts and logs from the coder/cleaner/hardener sessions live outside the repo (`/tmp/b2-ground-truth/*`, various `/tmp/*.log`) and will not survive worktree cleanup. I re-ran every claimed command fresh myself rather than relying on those paths, and results reproduced cleanly each time -- future re-verification should do the same.

Checked off both remaining Reviewer checklist boxes above. Did not set Status to `approved` and did not commit -- orchestrator's job.

---

### R1 — Changesets setup

**Status:** pending

**Depends on:** F1

**Files:** `.changeset/config.json` (new), root `package.json`

#### Implementor checklist

- [ ] `pnpm add -Dw @changesets/cli`
- [ ] `pnpm changeset init`; configure `.changeset/config.json` for independent versioning (the default — do not enable `fixed`/`linked` groups), `"access": "public"`, `baseBranch: "main"`
- [ ] Add root scripts: `"changeset": "changeset"`, `"version-packages": "changeset version"`, `"release": "changeset publish"`
- [ ] Do NOT run `changeset publish` for real in this chunk (that's R2, local registry only)

#### Reviewer checklist

- [ ] Confirm independent-mode config (no `fixed`/`linked` groups accidentally introduced)
- [ ] Confirm no publish was attempted in this chunk

#### Agent log

---

### R2 — Verdaccio dry-run proof

**Status:** pending

**Depends on:** R1, B1, B2

**Files:** root `package.json` (add `local-registry` script)

#### Implementor checklist

- [ ] Add `"local-registry": "verdaccio --config .verdaccio/config.yml --listen 4873 --storage tmp/local-registry/storage"` to root `package.json` (replaces the existing manual dev workflow currently provided by root `project.json`'s `@nx/js:verdaccio` target — not a new capability)
- [ ] Start it: `pnpm run local-registry`
- [ ] Add a throwaway changeset bumping `core` (patch), run `pnpm changeset version`, then `pnpm changeset publish` pointed at the local registry only (via `.npmrc` override or `--registry` flag); confirm `registry.npmjs.org` is never contacted
- [ ] `npm view @why-ts/core --registry http://localhost:4873` returns the new version
- [ ] Fetch the published `irpc` package.json from the local registry; confirm its `@why-ts/core` dependency is a real resolved semver, never the literal `workspace:*`
- [ ] Revert the throwaway version bumps/changelog entries after the proof

#### Reviewer checklist

- [ ] Confirm the local-only registry constraint was actually enforced/verified
- [ ] Confirm the `workspace:*` rewrite was checked in the actual fetched artifact
- [ ] Confirm throwaway version bumps were reverted

#### Agent log

---

### R3 — Decision record

**Status:** pending

**Depends on:** R2

**Files:** `docs/decisions/0002-nx-to-pnpm-changesets.md` (new) — no other files; this chunk does not touch release code/config

#### Implementor checklist

- [ ] Write `docs/decisions/0002-nx-to-pnpm-changesets.md` following the existing `0001-cold-run.md` shape (Decision, rationale, evidence, rejected alternatives)
- [ ] Record what changed (nx release → Changesets), what was preserved (independent per-package versioning, public access, immutable-once-published), and cite the R1/R2 evidence

#### Reviewer checklist

- [ ] Confirm this chunk touches only the one new file
- [ ] Confirm it accurately reflects what R1/R2 actually proved

#### Agent log

---

### C1 — CI + verify.sh (Ask-human tier)

**Status:** pending

**Depends on:** B1, B2, T1, T2, L1

**Files:** `.github/workflows/ci.yml`, `scripts/verify.sh`

#### Implementor checklist

- [ ] This chunk edits `.github/workflows/ci.yml`, an explicit Ask-human-tier file per `AGENTS.md`'s territory map — flag explicitly for human sign-off before merge
- [ ] Rewrite `ci.yml`: `pnpm install --frozen-lockfile`, then `pnpm -r --if-present run lint`, `pnpm -r --if-present run test`, `pnpm -r --if-present run build`; remove `nrwl/nx-set-shas`, the `nx affected` step, and the commented-out Nx Cloud lines
- [ ] Rewrite `scripts/verify.sh` to call the same `pnpm -r --if-present run lint test build` commands instead of `pnpm exec nx run-many`
- [ ] Note inline (comment or Agent log) that `examples/cli` intentionally has no `build` script (see Decisions) so `--if-present` silently skips it — accepted, not a bug
- [ ] Push a throwaway branch with a deliberately broken test/lint/build, confirm CI reports failure, then remove the throwaway breakage

#### Reviewer checklist

- [ ] Confirm this chunk is flagged for explicit human sign-off (Ask-human tier)
- [ ] Confirm the negative-case CI failure test was actually run (link the failed workflow run)
- [ ] Confirm `scripts/verify.sh` and `ci.yml` agree, beyond the documented full-vs-affected tradeoff being dropped entirely

#### Agent log

---

### E1 — examples/cli off Nx

**Status:** approved

**Depends on:** F1

**Files:** `examples/cli/package.json` (new), delete `examples/cli/project.json`

#### Implementor checklist

- [x] Add a minimal `examples/cli/package.json` (`"private": true`, name e.g. `examples-cli`) with `"start": "node -r @swc-node/register src/main.ts"` (reusing the exact loader already used by the Nx `eval` target — `@swc-node/register` is a real, used dependency, not dead Nx weight)
- [x] Delete `examples/cli/project.json`
- [x] Confirm `pnpm --filter examples-cli start` runs the CLI example interactively, matching today's `nx run example-cli:eval` behavior
- [x] Confirm no `build` script is added (accepted: this app drops out of CI/build coverage per Decisions)

#### Reviewer checklist

- [x] Confirm the example runs identically to today's manual `eval` workflow
- [x] Confirm no stray `@nx/esbuild`-only config remains referencing this app

#### Agent log

2026-09-14 coder (E1): Starting. Reading examples/cli/project.json, tsconfig chain, libs/cli/package.json for conventions. Status: in_progress.

2026-09-14 coder (E1): Implemented. Files changed: added `examples/cli/package.json` (private, name `examples-cli`, single `start` script `node -r @swc-node/register src/main.ts`, deps `@why-ts/cli: workspace:*` and `ts-pattern` — both are directly imported by `src/main.ts` / `src/prompt-test/*` and are required for pnpm's strict node_modules to resolve them at runtime, since pnpm does not hoist undeclared deps into a package's own resolution scope); deleted `examples/cli/project.json`. `pnpm-lock.yaml` updated by `pnpm install` (root package.json untouched, verified no `packageManager` field was injected).

Commands + evidence (all run with `COREPACK_ENABLE_AUTO_PIN=0` prefix):

- `pnpm install` — succeeded, linked all deps incl. `@why-ts/cli` workspace link, no errors (only pre-existing "Ignored build scripts" advisory unrelated to this chunk).
- `git status --short` after install — confirmed no `packageManager` field appended to root `package.json` (grep for `packageManager` in `package.json` returned no hits).
- `pnpm --filter examples-cli start` (no args) — exits 1, prints `ERROR No command provided` + full help/command list, identical shape to prior `nx run example-cli:eval` behavior with no args.
- `pnpm --filter examples-cli start flip` — prints `> flip`, exits 0.
- `printf 'hello\n' | pnpm --filter examples-cli start prompt-test --type string` — prompt `Enter a string …` answered from piped stdin, printed `hello (string)`, exits 0. Confirms real interactive (prompts-based) behavior works end-to-end through `@swc-node/register` without `TS_NODE_PROJECT`/nx.
- `pnpm --filter examples-cli run` — lists only one lifecycle script, `start`; confirms no `build` script present.

Residual risks / notes for cleaner-hardener-reviewer:

- `nx.json` (`plugins[].exclude`) still references a stale `example-cli-e2e/**/*` glob (for a project that doesn't appear to exist in this repo). It is NOT in E1's Files list (nx.json is Ask-human tier per AGENTS.md) so left untouched; flagging for whoever eventually retires `nx.json` wholesale.
- `examples/cli/.eslintrc.json`, `tsconfig.json`, `tsconfig.app.json` were left as-is (not in Files list); they still extend root eslint/tsconfig config and are plain (non-Nx) TS config, so lint/type-check should keep working, but not independently re-verified by me here (no `lint`/`typecheck` script exists in the new minimal `package.json` since the Files list only specifies package.json + project.json deletion).
- Did not run `pnpm approve-builds`; pre-existing "Ignored build scripts" warning (`@swc/core, core-js, esbuild, nx`) is a pre-existing condition from `pnpm install`, unrelated to E1, left as-is.
- Status left at `in_progress` per instructions; not committed — worktree left dirty for cleaner/hardener/reviewer.

2026-09-14 cleaner (E1): Reviewed `examples/cli/package.json` and confirmed `examples/cli/project.json` deletion; no changes made, implementation was already minimal and correct. Checks performed: (1) dependency need — `@why-ts/cli` and `ts-pattern` are both directly imported by `src/main.ts`; `@swc-node/register` is intentionally omitted from this package's own deps because Node's module resolution walks up to root `node_modules` (confirmed `ls node_modules | grep -i swc` at root shows `@swc`, `@swc-node`, `swc-loader`; `examples/cli/node_modules` has only the `@why-ts/cli` symlink) — not an oversight. (2) formatting — `COREPACK_ENABLE_AUTO_PIN=0 pnpm exec prettier --check examples/cli/package.json` → passes; trailing newline present; 2-space indent matches sibling `package.json` files. (3) naming — `examples-cli` differs from the old Nx project name `example-cli` (singular), but this matches the roadmap's own Files/Acceptance text (`pnpm --filter examples-cli start`), so not a defect. (4) half-done check — no stray `build`/`lint`/`test` scripts, no leftover Nx-only fields; `.eslintrc.json`/`tsconfig*.json` correctly left untouched (outside Files list) and still resolve (extends chain unchanged). Re-verification: `COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter examples-cli start flip` → prints `> flip`, exit code 0. `git status --porcelain` unchanged from coder's handoff (`M` roadmap doc, `D examples/cli/project.json`, `M pnpm-lock.yaml`, `?? examples/cli/package.json`); no `packageManager` drift in root `package.json`. Flag for hardener/reviewer: none new: the two residual risks the coder already logged (stale `example-cli-e2e` glob in `nx.json`; `.eslintrc.json`/tsconfig lint/typecheck not independently re-run since no such script exists in the new minimal `package.json`) still stand and remain out of E1's Files scope. Status: in_progress.

2026-09-14 hardener (E1): Ran only the three declared verify commands for this chunk, no others. (1) `COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter examples-cli start flip` — exit 0; output `> examples-cli@0.0.0 start ... node -r @swc-node/register src/main.ts flip` then `> flip`. PASS. (2) `grep -ri nx examples/cli/package.json` — zero matches (grep exit 1 = no hits); `ls examples/cli/project.json` — `No such file or directory` (file confirmed gone from worktree). PASS. (3) Read `examples/cli/package.json` directly — `scripts` object contains only `start`; no `build` key present. PASS. `git status --short` reconfirms unchanged worktree state from cleaner's handoff (`M` roadmap doc, `D examples/cli/project.json`, `M pnpm-lock.yaml`, `?? examples/cli/package.json`). All three declared gates: PASS. Residual risks for reviewer (no new ones found; restating coder/cleaner's already-flagged items plus confirming their scope): (a) `nx.json` (`plugins[].exclude`) still has a stale `example-cli-e2e/**/*` glob for a project that doesn't appear to exist in this repo — out of scope for E1 (nx.json is Ask-human tier, not in E1's Files list); unresolved carry-over for whoever retires `nx.json` wholesale. (b) `examples/cli/.eslintrc.json` and `tsconfig.json`/`tsconfig.app.json` were left untouched (correctly, per Files list) and were not independently re-verified by lint/typecheck here either, since no `lint`/`typecheck` script exists in the new minimal `package.json` and none of the three declared verify commands for this chunk exercise them. Not a gate failure — outside this chunk's declared verify surface — but reviewer should note it as unverified-by-automation. No other residual risks identified. Status: in_progress (not changed by hardener, per role).

2026-09-14 reviewer (E1): Verdict: approve. Independently re-ran both AC-E1 workflows from a clean shell: COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter examples-cli start flip exits 0 with output '> flip'. printf 'hello\n' piped into COREPACK_ENABLE_AUTO_PIN=0 pnpm --filter examples-cli start prompt-test --type string answers the prompt from stdin, prints 'hello (string)', exits 0. examples/cli/project.json confirmed absent (find_path no match). grep -ril nx examples/cli --exclude-dir=node_modules returns zero hits. pnpm --filter examples-cli run lists only the start script, no build. git status --short (full repo) shows exactly four entries: modified roadmap doc, deleted examples/cli/project.json, modified pnpm-lock.yaml, new examples/cli/package.json -- no scope creep. grep packageManager package.json at root returns zero hits, no drift. Traced both @why-ts/cli and ts-pattern to real imports in src/main.ts, src/prompt-test/command.ts, and src/prompt-test/handler.ts -- not speculative additions. Confirmed @swc-node/register is correctly omitted from the example's own deps: it is a root devDependency and Node's upward node_modules resolution finds it via the root node_modules/@swc-node/register symlink from examples/cli, whose own node_modules contains only @why-ts and ts-pattern -- matches cleaner's claim exactly. Cleanup pass (no changes needed) is plausible: implementation was already minimal and correctly scoped to the Files list; found nothing to add or remove beyond what coder/cleaner/hardener already logged. Checked off both outstanding Reviewer checklist boxes above.

Residual risks (none block approval): (a) stale example-cli-e2e glob in nx.json plugins[].exclude -- out of E1's Files scope (Ask-human tier), carry-over for whole-nx.json retirement later. (b) examples/cli/.eslintrc.json and tsconfig\*.json lint/typecheck not exercised by any script in the new package.json -- correctly out of scope per Files list, unverified-by-automation only, not a gate failure. Status: in_progress (Status change to approved left to orchestrator, per role).

---

### A1 — AGENTS.md and MENTAL_MODEL.md alignment

**Status:** pending

**Depends on:** R3, C1

**Files:** `AGENTS.md`, `docs/MENTAL_MODEL.md`

#### Implementor checklist

- [ ] In `docs/MENTAL_MODEL.md`, replace the `nx release`/git-tag-resolver framing under "Why this shape" and "What must never change without a human deciding it" with the Changesets equivalent (independent versioning via Changesets preserved as the locked policy; the mechanism changed with human approval, recorded at `docs/decisions/0002-nx-to-pnpm-changesets.md`)
- [ ] In `AGENTS.md`: update territory-map rows referencing `nx.json`/`nx release`/`.verdaccio/config.yml` to reference `pnpm-workspace.yaml`, `.changeset/config.json`, and the plain `verdaccio` script; update "Debug loops"'s `pnpm exec nx test <project>` example to `pnpm --filter <project> test`; update "Done = evidence"'s description of `scripts/verify.sh` to describe the new `pnpm -r` commands
- [ ] `rg -i 'nx release|nx run-many|nx affected|git-tag' docs/MENTAL_MODEL.md AGENTS.md` returns zero hits outside `docs/decisions/0002-*.md`'s own historical framing

#### Reviewer checklist

- [ ] Confirm `AGENTS.md`'s Never-tier rows (`git push --force`, `npm publish`, `git tag -d/-f`) are untouched — this chunk only updates the Nx-specific rows
- [ ] Confirm the "policy preserved, mechanism changed" framing is stated clearly, not just deleted

#### Agent log

---
