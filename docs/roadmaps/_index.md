# Roadmap Index

Ready / Not Ready / Blocked queue for `docs/roadmaps/`. Register every new
roadmap here immediately (Not Ready until a human sets it Executable).
Completed roadmaps move to `docs/roadmaps/_archive.md` — do not leave them
here.

## Ready

- `2609141945_NX_TEARDOWN_ROADMAP.md` — hard blocker resolved 2026-09-16: `origin/main` at `66363de` includes the full migration; real CI run for `main` (https://github.com/why-ts/why-ts/actions/runs/34978655655/job/104412894227) succeeded. Executable.

## Not Ready

_(none)_

## Blocked

_(none)_

## Human actions needed

| Opened     | Roadmap / residual                                                                                                        | Action                                      | Unblocks                                    | Requested by | Resolved                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| 2026-09-14 | `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` chunk R2 — stray local git tags `@why-ts/core@0.0.2` / `@why-ts/irpc@0.0.2`. | Delete the two tags.                        | R2 cleaner/hardener/reviewer, R3, A1        | orchestrator | **2026-09-15: done** — human deleted both tags, confirmed empty before resuming; R2 approved and merged. |
| 2026-09-14 | `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` chunk C1 — AC-C1a's `cli:build` gap on real CI.                              | Confirm accepting the same F1/B2 precedent. | Closed the open question on C1's Acceptance | orchestrator | **2026-09-15: done** — human confirmed deferred to the separate draft fix roadmap.                       |

| 2026-09-15 | End-of-roadmap qa on `2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` found: `AGENTS.md`'s Never-tier row for `pnpm changeset publish` is not actually matched by any of the three deny-dangerous hook files (`.zed/settings.json`, `.cursor/hooks/deny-dangerous.js`, `.github/hooks/scripts/deny-dangerous.js`) — they still only match `\b(npm\|pnpm\|yarn)\s+publish\b` / `\bnx\s+release\b`. | Decide whether/when to open a small follow-up roadmap adding a `changeset publish` (and `pnpm run release`) pattern to all three hook files. | Closes a live gap between AGENTS.md's documented Never-tier guarantee and actual enforcement. | orchestrator | open |
| 2026-09-15 | Migration fully executed locally (12/12 chunks approved, qa pass) but never pushed/merged to a real remote `main`, and never exercised by real CI against `main` (only a throwaway PR branch was CI-tested). `NX_TEARDOWN_ROADMAP.md` is Blocked on this — human judgment call on timing. | Decide whether/when to push this work to real `main` and confirm real CI green there, which would then make `NX_TEARDOWN_ROADMAP.md` eligible. | Unblocks `2609141945_NX_TEARDOWN_ROADMAP.md`. | orchestrator | **2026-09-16: done** — `origin/main` at `66363de` (includes migration + CI fixup commits); real CI on `main` succeeded (run 34978655655). `NX_TEARDOWN_ROADMAP.md` moved to Ready. |
| 2026-09-15 | `2609142054_CLI_BUILD_STACK_OVERFLOW_FIX_ROADMAP.md` complete (TS1+TS2 approved), but TS1's fix only relocates the underlying TS structural/variance-checker cost: a downstream consumer pattern (`const c: Command<ConcreteOptions, R> = command();`) and `examples-cli`'s own `tsc --noEmit` (not wired to any pnpm/Nx target) still crash with the same `RangeError` once a concrete-options command is registered. See TS1 Agent log and `_archive.md` entry. | Decide whether to open a follow-up roadmap addressing the deeper recursive-generic cost, and/or wire `examples-cli` type-checking into a verify/CI target so a future regression is caught. | Prevents a silent regression of the underlying crash for real consumers; closes the gap between "cli build passes" and "library is usable downstream." | orchestrator | open |

## Claimed-by

Solo project today (see `AGENTS.md` § Parallel work). If a second agent or
human joins, claim a chunk here before starting:

| Agent        | Roadmap                             | Chunk | Branch | Since      |
| ------------ | ----------------------------------- | ----- | ------ | ---------- |
| orchestrator | `2609141945_NX_TEARDOWN_ROADMAP.md` | X1    | main   | 2026-09-16 |

## Orchestrator Notes (2026-09-15)

`2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md` complete 2026-09-15 (12/12 chunks approved, end-of-roadmap qa: PASS WITH NOTED RESIDUALS). See `docs/roadmaps/_archive.md`.

`2609142054_CLI_BUILD_STACK_OVERFLOW_FIX_ROADMAP.md` complete 2026-09-15 (2/2 chunks approved: TS1, TS2; commits `4828e36`, `9fe01cc`, `dfd952c`). See `docs/roadmaps/_archive.md`. Residual finding surfaced as a new Human actions row above (fix relocates rather than eliminates the underlying variance-checker cost for real downstream consumers).

**Execute-all-roadmaps drain status (updated 2026-09-16):** Hard blocker resolved — `origin/main` (`66363de`) includes the full migration and real CI on `main` succeeded (run 34978655655). `NX_TEARDOWN_ROADMAP.md` moved from Blocked to Ready.

1. `CLI_BUILD_STACK_OVERFLOW_FIX`: Complete, archived.
2. `NX_TEARDOWN` (X1): Ready — hard dependency cleared 2026-09-16.
3. **Human actions open:** 2 items (deny-dangerous hook gap; TS1 residual follow-up).

Next session: execute `2609141945_NX_TEARDOWN_ROADMAP.md` via execute-roadmap.
