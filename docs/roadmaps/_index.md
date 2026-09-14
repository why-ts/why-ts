# Roadmap Index

Ready / Not Ready / Blocked queue for `docs/roadmaps/`. Register every new
roadmap here immediately (Not Ready until a human sets it Executable).
Completed roadmaps move to `docs/roadmaps/_archive.md` — do not leave them
here.

## Ready

- `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` — Executable (approved by user 2026-09-14).

## Not Ready

- `2609142054_CLI_BUILD_STACK_OVERFLOW_FIX_ROADMAP.md` — draft, not Executable. Awaiting human approval.

## Blocked

- `2609141945_NX_TEARDOWN_ROADMAP.md` — hard block: Blocked on NX_TO_PNPM_MIGRATION roadmap being fully executed, merged to `main`, and green in real CI on `main` at least once post-merge (human judgment call on timing).

## Human actions needed

| Opened     | Roadmap / residual                                                                                                                                                                                                                                                                                                                                                                                                         | Action                                                                                                                                                                                | Unblocks                                                                              | Requested by |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------ |
| 2026-09-14 | `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` chunk R2 — `changeset publish`'s `--no-git-tag` passthrough failed (`pnpm run` re-inserts a literal `--`), creating two real local-only git tags `@why-ts/core@0.0.2` / `@why-ts/irpc@0.0.2` (visible repo-wide; worktrees share one `.git` ref database). Violates this roadmap's locked Decision "no extra git tag is added." Confirmed neither tag was pushed to `origin`. | Run `git tag -d '@why-ts/core@0.0.2' '@why-ts/irpc@0.0.2'` in `.worktrees/r2` (or confirm leaving them is acceptable) — deleting tags is Never-tier for agents, mechanically blocked. | R2 cleaner/hardener/reviewer stages, then R3 (depends on R2), then A1 (depends on R3) | orchestrator |

## Claimed-by

Solo project today (see `AGENTS.md` § Parallel work). If a second agent or
human joins, claim a chunk here before starting:

| Agent        | Roadmap                                    | Chunk | Branch | Since      |
| ------------ | ------------------------------------------ | ----- | ------ | ---------- |
| orchestrator | 2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md | C1    | main   | 2026-09-14 |

R2 is parked `blocked` (see Human actions needed above); its worktree/branch
(`.worktrees/r2`, `roadmap/nx-to-pnpm-migration/r2`) is intentionally left in
place, uncommitted-to-main, for the human to act on directly.
