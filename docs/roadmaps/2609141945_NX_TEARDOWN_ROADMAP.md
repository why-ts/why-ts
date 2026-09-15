# Nx Teardown — Task Map

## Goal (locked)

Physically remove all remaining Nx packages and config files from `why-ts`, now that the pnpm + Changesets pipeline (see the companion `NX_TO_PNPM_MIGRATION` roadmap) has been proven end-to-end and has run green in real CI on `main` at least once post-merge. This is the irreversible point of no return the migration roadmap deliberately excluded.

**Out of scope:** any further tooling change. This roadmap only deletes now-dead Nx artifacts; if a migration gap is discovered, fix it in a follow-up to the migration roadmap first, not here.

## Decisions (locked)

- This roadmap must not start until the `NX_TO_PNPM_MIGRATION` roadmap's chunks are all merged to `main` and CI has run green on `main` (not just a branch) using the new `pnpm`-only pipeline at least once. This is a human judgment call on timing (bake-in period), recorded in `docs/roadmaps/_index.md` under Blocked.
- Rollback: no special git tag; each prior migration chunk already landed as its own commit, so this single chunk can be reverted independently via `git revert` if needed.
- `@swc-node/register`, `@swc/core`, `@swc/helpers` are kept (used by `examples/cli`'s `start` script, wired in the migration roadmap's `E1`) — they are not Nx packages and must not be removed here.

## Acceptance

### Feature: Nx fully removed

Scenario AC-N1 — enumerated removal, not prose
Given the literal removal list in `X1`'s checklist (`nx.json`; every remaining `project.json`; `jest.config.ts`; `jest.preset.js`; every `@nx/*`, `nx`, and Jest-stack devDependency named in `X1`)
When `X1` completes and `pnpm install` reruns
Then `rg -i '"nx"|@nx/|"jest"' package.json libs/*/package.json examples/*/package.json` returns zero hits, `pnpm ls -r --depth 0` lists no Nx or Jest package, and `./scripts/verify.sh` passes

## Protocol

**Pack:** six-pack

Justification: single irreversible chunk, no automated rollback path once merged (a `git revert` is possible but this is the terminal step of a production-stakes migration) — full rigor (cleaner, hardener, end-of-roadmap qa, reviewer) applies to this one chunk without exception.

- Dependency order: `X1` depends on the external `NX_TO_PNPM_MIGRATION` roadmap being fully merged to `main` and green in real (non-branch) CI. No other roadmap chunk exists here.
- Verify command: `pnpm install && pnpm -r --if-present run lint test build && ./scripts/verify.sh`, all must be green.

---

## Human gate / Executable

- [x] User sets this roadmap **Executable** (explicit approval) before implementors treat it as execute-ready. This roadmap additionally requires the human to confirm the `NX_TO_PNPM_MIGRATION` roadmap's bake-in condition (see Decisions) is met — Executable on this roadmap must not be granted before that.

## Task list

### X1 — Final Nx removal

**Status:** approved

**Depends on:** external — `NX_TO_PNPM_MIGRATION` roadmap fully executed, merged to `main`, and green in real CI on `main` at least once post-merge

**Files:** delete `nx.json`, `project.json` (root), `libs/cli/project.json`, `libs/core/project.json`, `libs/irpc/project.json`; delete `jest.config.ts`, `jest.preset.js`; root `package.json` (remove Nx/Jest devDependencies)

#### Implementor checklist

- [x] Confirm the migration roadmap's chunks are all merged and CI is green on `main` before starting
- [x] Delete `nx.json`, all `project.json` files (root + 3 libs — `examples/cli/project.json` was already removed in the migration roadmap's `E1`)
- [x] Delete `jest.config.ts`, `jest.preset.js`
- [x] Remove from root `package.json`: `@nx/esbuild`, `@nx/eslint`, `@nx/eslint-plugin`, `@nx/jest`, `@nx/js`, `@nx/node`, `@nx/vite`, `@nx/web`, `@nx/workspace`, `nx`, `jest`, `jest-environment-jsdom`, `jest-environment-node`, `ts-jest`, `@swc/jest`, `@types/jest`; keep `@swc-node/register`, `@swc/core`, `@swc/helpers` (used by `examples/cli`)
- [x] Check whether `ts-node` is invoked anywhere (`rg ts-node`); remove from devDependencies if genuinely unused
- [x] Run `pnpm install`; run `pnpm -r --if-present run lint test build` and `./scripts/verify.sh`; both must pass
- [x] Delete the local `.nx/` cache directory if present

#### Reviewer checklist

- [x] Confirm `rg -i '"nx"|@nx/|"jest"' package.json libs/*/package.json examples/*/package.json` returns zero hits
- [x] Confirm `pnpm ls -r --depth 0` lists no Nx or Jest package
- [x] Confirm `@swc-node/register`/`@swc/core`/`@swc/helpers` were deliberately kept
- [x] Confirm full `./scripts/verify.sh` is green after removal

#### Agent log

- 2026-09-16 orchestrator: Pack: six-pack (explicit Protocol). Starting X1 — dispatching coder.
- 2026-09-16 coder: Deleted nx.json, root/libs project.json (cli, core, irpc), jest.config.ts, jest.preset.js, local .nx/ cache. Edited root package.json: removed all @nx/_ deps, nx, jest, jest-environment-jsdom, jest-environment-node, ts-jest, @swc/jest, @types/jest, and ts-node (grep showed ts-node only referenced in README usage examples, not invoked by any script — genuinely unused). Kept @swc-node/register, @swc/core, @swc/helpers per locked decision. Checked .eslintrc.json — no @nx/eslint-plugin references found, no change needed. No .nxignore file existed. Evidence: `pnpm install` succeeded (429 packages removed, only pre-existing @swc/core peer-dep warning unrelated to this change); `./scripts/verify.sh` green (lint 0 errors/38 pre-existing warnings, all tests pass, all builds pass); `grep -inE '"nx"|@nx/|"jest"' package.json libs/_/package.json examples/\*/package.json`and`pnpm ls -r --depth 0 | grep -iE 'nx|jest'` both zero hits, matching AC-N1. Status left in_progress for reviewer.
- 2026-09-16 cleaner: Checked `.eslintrc.json`, `tsconfig*.json`, `.github/workflows/*.yml`, `scripts/*.sh`, root/lib/example `README.md` files, `pnpm-lock.yaml` — zero Nx/Jest references in any, no change needed there. Found one leftover cruft item: `.gitignore` still had `.nx/cache` and `.nx/workspace-data` entries for the now-deleted `.nx/` directory; removed both lines (behavior-preserving, dead ignore rules for a tool no longer present). Left `docs/decisions/`, `docs/notes/`, and `docs/playbooks/publish.md`'s Nx mentions untouched — historical framing / separately-tracked residual, out of scope per roadmap. Re-ran `./scripts/verify.sh` after the `.gitignore` edit: green (lint 0 errors/38 pre-existing warnings, all tests pass, all builds pass). Status: in_progress, handing to hardener.
- 2026-09-16 hardener: Ran declared verify fresh: `pnpm install` (up to date), `pnpm -r --if-present run lint test build` (exit 0), `./scripts/verify.sh` (exit 0, lint 0 errors/38 pre-existing warnings, all tests pass, all builds pass). AC-N1 checks: zero Nx/Jest hits in package.json files (used `grep -inE` — `rg` not installed in this environment); `pnpm ls -r --depth 0` shows no Nx/Jest package; `@swc-node/register`/`@swc/core`/`@swc/helpers` present as kept deps. Confirmed nx.json/project.json/jest.config.ts/jest.preset.js/.nx all absent. Flagged one risk for reviewer: `pnpm -r --if-present run lint test build` is a silent no-op (root excluded from `-r` by default, no workspace package has a `lint` script) — verify.sh's own comment documents this; does not affect correctness since verify.sh independently runs lint/test/build correctly, but the Protocol's declared command doesn't add coverage beyond verify.sh. Status: in_progress, handing to reviewer.
- 2026-09-16 reviewer: Verdict: approve. Independently inspected `git status`/`git diff`: deletions are exactly `nx.json`, root + `libs/{cli,core,irpc}/project.json`, `jest.config.ts`, `jest.preset.js`; edits are `package.json` (removes every `@nx/*` dep, `nx`, `jest`/`jest-environment-*`/`ts-jest`/`@swc/jest`/`@types/jest`/`ts-node`, and the `"nx": {...}` block; keeps `@swc-node/register`, `@swc/core`, `@swc/helpers` per locked decision — confirmed present at lines 27-29), `.gitignore` (drops dead `.nx/cache`/`.nx/workspace-data` entries — `.nx/` confirmed absent from disk, behavior-preserving), `pnpm-lock.yaml`, and `_index.md` (Claimed-by row, in scope for solo-project convention). Ran own AC-N1 checks: `grep -inE '"nx"|@nx/|"jest"' package.json libs/*/package.json examples/*/package.json` — zero hits (exit 1); `pnpm ls -r --depth 0 | grep -iE 'nx|jest'` — zero hits (exit 1); `find . -iname nx.json -o -iname project.json -o -iname jest.config.ts -o -iname jest.preset.js` (excl. node_modules) — zero hits. Ran full `./scripts/verify.sh` myself fresh: exit 0, lint 0 errors/38 pre-existing warnings, all test suites pass (libs/core has no test files, pre-existing), all builds pass — matches coder/cleaner/hardener's reports exactly. Hardener's residuals weighed: (1) `pnpm -r --if-present run lint test build` no-op — cosmetic Protocol-wording gap, `verify.sh` is the actual gate and is correctly green, does not block AC-N1 which explicitly names `./scripts/verify.sh` as the pass condition; (2) `rg` unavailable, `grep -inE` is semantically equivalent for this check; (3) 38 pre-existing lint warnings — unrelated to this chunk, out of scope; (4) `libs/core` zero test files — pre-existing, not introduced by this chunk; (5) out-of-scope Nx mentions in docs/decisions and docs/notes correctly left untouched per roadmap's Out of scope clause. None block acceptance. Checked off all 4 reviewer checklist items. Residual risks to carry forward (informational only, none blocking): the four hardener-flagged items above, plus note that Protocol's declared verify command wording should eventually be corrected to match what `verify.sh` actually does (cosmetic, not a correctness gap).
- 2026-09-16 orchestrator: Reviewer approved X1. All AC-N1 evidence confirmed (zero Nx/Jest hits, verify.sh green, @swc-node/register/@swc/core/@swc/helpers kept). Residual risks: Protocol's declared `pnpm -r --if-present run lint test build` is a wording no-op (verify.sh is the real gate, correctly green); `rg` unavailable in sandbox (grep used, equivalent); 38 pre-existing lint warnings; libs/core has zero test files — none block acceptance. Setting Status: approved. Committing chunk + roadmap together.
- 2026-09-16 orchestrator: Committed as `d1dd6d2` (chunk + roadmap docs together).
- 2026-09-16 qa: End-of-roadmap QA (required — Pack six-pack). Verdict: **PASS**. Re-read Goal/Out of scope/Decisions/Acceptance from disk. AC-N1 re-verified fresh: zero Nx/Jest hits (grep fallback, rg not installed), `pnpm ls -r --depth 0` shows no Nx/Jest package, `./scripts/verify.sh` green (lint 0 errors/38 pre-existing warnings, all tests pass, all builds pass). Confirmed nx.json/project.json(x4)/jest.config.ts/jest.preset.js/.nx all absent from disk; confirmed @swc-node/register/@swc/core/@swc/helpers still present (locked decision honored). Confirmed Out of scope honored via `git show --stat d1dd6d2` (only Nx-artifact-removal-related files touched). Residual risks (informational, non-blocking, independently reconfirmed): (1) Protocol's declared `pnpm -r --if-present run lint test build` is a wording no-op, `verify.sh` is the real gate; (2) `rg` unavailable in sandbox, grep used as equivalent fallback; (3) 38 pre-existing lint warnings; (4) `libs/core` has zero test files (pre-existing). None block Goal/Acceptance. Roadmap fully and correctly executed.

---
