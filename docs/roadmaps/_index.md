# Roadmap Index

Ready / Not Ready / Blocked queue for `docs/roadmaps/`. Register every new
roadmap here immediately (Not Ready until a human sets it Executable).
Completed roadmaps move to `docs/roadmaps/_archive.md` — do not leave them
here.

## Ready

_(none)_

## Not Ready

- `2609142054_CLI_BUILD_STACK_OVERFLOW_FIX_ROADMAP.md` — draft, not Executable. Awaiting human approval.

## Blocked

- `2609141945_NX_TEARDOWN_ROADMAP.md` — hard block: Blocked on NX_TO_PNPM_MIGRATION roadmap being fully executed, merged to `main`, and green in real CI on `main` at least once post-merge (human judgment call on timing).

## Human actions needed

| Opened     | Roadmap / residual                                                                                                                                                                                                                                                                                                                                                                            | Action                                                                                                                                         | Unblocks                                                                                      | Requested by | Resolved                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| 2026-09-14 | `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` chunk R2 — stray local git tags `@why-ts/core@0.0.2` / `@why-ts/irpc@0.0.2`.                                                                                                                                                                                                                                                                     | Delete the two tags.                                                                                                                           | R2 cleaner/hardener/reviewer, R3, A1                                                          | orchestrator | **2026-09-15: done** — human deleted both tags, confirmed empty before resuming; R2 approved and merged. |
| 2026-09-14 | `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` chunk C1 — AC-C1a's `cli:build` gap on real CI.                                                                                                                                                                                                                                                                                                  | Confirm accepting the same F1/B2 precedent.                                                                                                    | Closed the open question on C1's Acceptance                                                   | orchestrator | **2026-09-15: done** — human confirmed deferred to the separate draft fix roadmap.                       |
| 2026-09-15 | End-of-roadmap qa on `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` found: `AGENTS.md`'s Never-tier row for `pnpm changeset publish` is not actually matched by any of the three deny-dangerous hook files (`.zed/settings.json`, `.cursor/hooks/deny-dangerous.js`, `.github/hooks/scripts/deny-dangerous.js`) — they still only match `\b(npm\|pnpm\|yarn)\s+publish\b` / `\bnx\s+release\b`. | Decide whether/when to open a small follow-up roadmap adding a `changeset publish` (and `pnpm run release`) pattern to all three hook files.   | Closes a live gap between AGENTS.md's documented Never-tier guarantee and actual enforcement. | orchestrator | open                                                                                                     |
| 2026-09-15 | Migration fully executed locally (12/12 chunks approved, qa pass) but never pushed/merged to a real remote `main`, and never exercised by real CI against `main` (only a throwaway PR branch was CI-tested). `NX_TEARDOWN_ROADMAP.md` is Blocked on this — human judgment call on timing.                                                                                                     | Decide whether/when to push this work to real `main` and confirm real CI green there, which would then make `NX_TEARDOWN_ROADMAP.md` eligible. | Unblocks `2609141945_NX_TEARDOWN_ROADMAP.md`.                                                 | orchestrator | open                                                                                                     |

## Claimed-by

Solo project today (see `AGENTS.md` § Parallel work). If a second agent or
human joins, claim a chunk here before starting:

| Agent    | Roadmap | Chunk | Branch | Since |
| -------- | ------- | ----- | ------ | ----- |
| _(none)_ |         |       |        |       |

`2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` complete 2026-09-15 (12/12 chunks approved, end-of-roadmap qa: PASS WITH NOTED RESIDUALS). See `docs/roadmaps/_archive.md`.
