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

- [ ] User sets this roadmap **Executable** (explicit approval) before implementors treat it as execute-ready. This roadmap additionally requires the human to confirm the `NX_TO_PNPM_MIGRATION` roadmap's bake-in condition (see Decisions) is met — Executable on this roadmap must not be granted before that.

## Task list

### X1 — Final Nx removal

**Status:** pending

**Depends on:** external — `NX_TO_PNPM_MIGRATION` roadmap fully executed, merged to `main`, and green in real CI on `main` at least once post-merge

**Files:** delete `nx.json`, `project.json` (root), `libs/cli/project.json`, `libs/core/project.json`, `libs/irpc/project.json`; delete `jest.config.ts`, `jest.preset.js`; root `package.json` (remove Nx/Jest devDependencies)

#### Implementor checklist

- [ ] Confirm the migration roadmap's chunks are all merged and CI is green on `main` before starting
- [ ] Delete `nx.json`, all `project.json` files (root + 3 libs — `examples/cli/project.json` was already removed in the migration roadmap's `E1`)
- [ ] Delete `jest.config.ts`, `jest.preset.js`
- [ ] Remove from root `package.json`: `@nx/esbuild`, `@nx/eslint`, `@nx/eslint-plugin`, `@nx/jest`, `@nx/js`, `@nx/node`, `@nx/vite`, `@nx/web`, `@nx/workspace`, `nx`, `jest`, `jest-environment-jsdom`, `jest-environment-node`, `ts-jest`, `@swc/jest`, `@types/jest`; keep `@swc-node/register`, `@swc/core`, `@swc/helpers` (used by `examples/cli`)
- [ ] Check whether `ts-node` is invoked anywhere (`rg ts-node`); remove from devDependencies if genuinely unused
- [ ] Run `pnpm install`; run `pnpm -r --if-present run lint test build` and `./scripts/verify.sh`; both must pass
- [ ] Delete the local `.nx/` cache directory if present

#### Reviewer checklist

- [ ] Confirm `rg -i '"nx"|@nx/|"jest"' package.json libs/*/package.json examples/*/package.json` returns zero hits
- [ ] Confirm `pnpm ls -r --depth 0` lists no Nx or Jest package
- [ ] Confirm `@swc-node/register`/`@swc/core`/`@swc/helpers` were deliberately kept
- [ ] Confirm full `./scripts/verify.sh` is green after removal

#### Agent log

---
