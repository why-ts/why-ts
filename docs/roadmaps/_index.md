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

| Opened     | Roadmap / residual                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Action                                                                                                                                                                                            | Unblocks                                                                                              | Requested by |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------ |
| 2026-09-14 | `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` chunk R2 — `changeset publish`'s `--no-git-tag` passthrough failed (`pnpm run` re-inserts a literal `--`), creating two real local-only git tags `@why-ts/core@0.0.2` / `@why-ts/irpc@0.0.2` (visible repo-wide; worktrees share one `.git` ref database). Violates this roadmap's locked Decision "no extra git tag is added." Confirmed neither tag was pushed to `origin`.                                                                                                                                          | Run `git tag -d '@why-ts/core@0.0.2' '@why-ts/irpc@0.0.2'` in `.worktrees/r2` (or confirm leaving them is acceptable) — deleting tags is Never-tier for agents, mechanically blocked.             | R2 cleaner/hardener/reviewer stages, then R3 (depends on R2), then A1 (depends on R3)                 | orchestrator |
| 2026-09-14 | `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` chunk C1 (already `approved`, not blocking) — AC-C1a's literal text says CI lint/test/build "succeed for all three libraries," but `cli`'s build still fails on real CI (verified, run `34850054641`) due to the pre-existing, migration-unrelated TS `RangeError` already accepted at F1/B2. C1's reviewer flagged that AC-C1a names all three libraries explicitly (stricter wording than B1/B2's own scenarios), so inheriting the F1/B2 precedent here should get an explicit human nod rather than being assumed. | Confirm (or reject) treating this gap the same way as F1/B2: accepted, tracked separately at `docs/roadmaps/2609142054_CLI_BUILD_STACK_OVERFLOW_FIX_ROADMAP.md` (still draft, awaiting approval). | Closes the open question on C1's Acceptance; informs whether that draft roadmap should be prioritized | orchestrator |

## Claimed-by

Solo project today (see `AGENTS.md` § Parallel work). If a second agent or
human joins, claim a chunk here before starting:

| Agent        | Roadmap | Chunk | Branch | Since |
| ------------ | ------- | ----- | ------ | ----- |
| _(none yet)_ |         |       |        |       |

R2 is parked `blocked` (see Human actions needed above); its worktree/branch
(`.worktrees/r2`, `roadmap/nx-to-pnpm-migration/r2`) is intentionally left in
place, uncommitted-to-main, for the human to act on directly. All other
eligible chunks in `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` are done
(F1, L1, B1, E1, T1, B2, R1, T2, C1 all `approved`); R3 and A1 both depend
(directly or transitively) on R2, so no further chunk in this roadmap is
executable until the human action above clears.
