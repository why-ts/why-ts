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

| Opened     | Roadmap / residual                                                                                                        | Action                                      | Unblocks                                    | Requested by | Resolved                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| 2026-09-14 | `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` chunk R2 — stray local git tags `@why-ts/core@0.0.2` / `@why-ts/irpc@0.0.2`. | Delete the two tags.                        | R2 cleaner/hardener/reviewer, R3, A1        | orchestrator | **2026-09-15: done** — human deleted both tags, confirmed empty before resuming; R2 approved and merged. |
| 2026-09-14 | `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` chunk C1 — AC-C1a's `cli:build` gap on real CI.                              | Confirm accepting the same F1/B2 precedent. | Closed the open question on C1's Acceptance | orchestrator | **2026-09-15: done** — human confirmed deferred to the separate draft fix roadmap.                       |

## Claimed-by

Solo project today (see `AGENTS.md` § Parallel work). If a second agent or
human joins, claim a chunk here before starting:

| Agent        | Roadmap                                    | Chunk | Branch | Since      |
| ------------ | ------------------------------------------ | ----- | ------ | ---------- |
| orchestrator | 2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md | R3    | main   | 2026-09-15 |

R2 approved and merged 2026-09-15. Remaining: R3 (in progress), then A1.
