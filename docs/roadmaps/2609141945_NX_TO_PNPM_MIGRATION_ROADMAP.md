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

**Status:** pending

**Depends on:** F1

**Files:** root `package.json` (add `vite-tsconfig-paths` devDependency), `libs/core/vite.config.ts`, `libs/core/package.json`

#### Implementor checklist

- [ ] Add `vite-tsconfig-paths` as a root devDependency
- [ ] In `libs/core/vite.config.ts`, replace `nxViteTsPaths()` (`@nx/vite/plugins/nx-tsconfig-paths.plugin`) with `tsconfigPaths()` (`vite-tsconfig-paths`)
- [ ] Add `"test": "vitest run"` to `libs/core/package.json` scripts
- [ ] Before changing anything, record baseline: `pnpm exec nx test core` test-file/test-case counts, written into this chunk's Agent log
- [ ] Run `pnpm --filter @why-ts/core test`; confirm same test file(s)/case count as the baseline

#### Reviewer checklist

- [ ] Confirm no other package's config was touched
- [ ] Confirm the baseline count was actually recorded in the Agent log, not asserted from memory
- [ ] Confirm `core`'s Nx-driven test target still works too (Nx not yet removed)

#### Agent log

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

**Status:** pending

**Depends on:** F1

**Files:** `libs/core/package.json`, `libs/core/tsconfig.lib.json`

#### Implementor checklist

- [ ] Run `pnpm exec nx build core` once (Nx still installed); record the exact contents/structure of `dist/libs/core/` as ground truth in this chunk's Agent log — do not assume the layout
- [ ] Move that recorded `dist/libs/core/` aside before building the new way, to avoid false confidence from stale files
- [ ] Set `libs/core/tsconfig.lib.json`'s `outDir` so a plain `tsc -p tsconfig.lib.json` reproduces the recorded layout (`dist/libs/core/src/index.js`, `.d.ts`, etc.)
- [ ] Add `"build": "tsc -p tsconfig.lib.json && cp package.json README.md ../../dist/libs/core/"` (or equivalent) to `libs/core/package.json`
- [ ] Run `pnpm --filter @why-ts/core build`; diff the result against the recorded ground truth (module format, file list, `main`/`typings` resolution)
- [ ] Confirm `node -e "require('./dist/libs/core')"` succeeds from `dist/libs/core`

#### Reviewer checklist

- [ ] Confirm the ground-truth capture actually happened (evidence in Agent log)
- [ ] Confirm CJS emit is unchanged (spot check `dist/libs/core/src/index.js` uses `require`/`exports`, not `import`/`export`)
- [ ] Confirm `package.json`/`README.md` are copied unmodified

#### Agent log

---

### B2 — tsc build for cli and irpc

**Status:** pending

**Depends on:** B1, F1

**Files:** `libs/cli/package.json`, `libs/cli/tsconfig.lib.json`, `libs/irpc/package.json`, `libs/irpc/tsconfig.lib.json`

#### Implementor checklist

- [ ] Repeat B1's proven recipe for `cli` and `irpc`
- [ ] Run `pnpm -r run build` from repo root; capture the log and confirm `core`'s build completes before `irpc`'s build starts
- [ ] Causal proof (not just an assertion of pnpm's default behavior): temporarily introduce a build error in `core`, rerun `pnpm -r run build`, confirm `irpc`'s build fails or never starts, then revert the induced error
- [ ] Confirm `irpc`'s compiled output still resolves `@why-ts/core` types via the `tsconfig.base.json` path alias at compile time, not via `core`'s `dist` output

#### Reviewer checklist

- [ ] Confirm the causal build-order proof was actually performed (log evidence), not just cited as "pnpm does this by default"
- [ ] Confirm `cli`'s build (no internal dependency) is unaffected by ordering concerns

#### Agent log

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

**Status:** pending

**Depends on:** F1

**Files:** `examples/cli/package.json` (new), delete `examples/cli/project.json`

#### Implementor checklist

- [ ] Add a minimal `examples/cli/package.json` (`"private": true`, name e.g. `examples-cli`) with `"start": "node -r @swc-node/register src/main.ts"` (reusing the exact loader already used by the Nx `eval` target — `@swc-node/register` is a real, used dependency, not dead Nx weight)
- [ ] Delete `examples/cli/project.json`
- [ ] Confirm `pnpm --filter examples-cli start` runs the CLI example interactively, matching today's `nx run example-cli:eval` behavior
- [ ] Confirm no `build` script is added (accepted: this app drops out of CI/build coverage per Decisions)

#### Reviewer checklist

- [ ] Confirm the example runs identically to today's manual `eval` workflow
- [ ] Confirm no stray `@nx/esbuild`-only config remains referencing this app

#### Agent log

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
