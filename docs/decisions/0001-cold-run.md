# 0001 — Cold-run rehearsal

## Decision

The why-ts harness (`AGENTS.md`, `docs/`, `scripts/verify.sh`, tool gates
under `.zed/`, `.cursor/`, `.github/hooks/`) is validated by a cold run: a
fresh agent session, given only a task description and the repo, completed
real work using the files alone.

## Rehearsal task

Remove the unused `import { get } from 'http'` from
`libs/core/src/lib/promise-trigger.ts` (flagged by `core:lint`) and confirm
the project's full verification passes.

No roadmap existed yet at rehearsal time (this is the harness's first
piece of work), so the task was ad hoc rather than a roadmap chunk. The
Claimed-by / Protocol Pack ceremony in `execute-roadmap` was not exercised
by this rehearsal — that remains to be proven by the first real roadmap.

## What the fresh agent did, unprompted

- Was given no path to `AGENTS.md` and no explanation of the harness. It
  found and read project instructions on its own.
- Made the minimal correct edit (deleted the dead import and its blank
  line, nothing else).
- Ran `./scripts/verify.sh`, hit the same `NX_SOCKET_DIR` socket-path-length
  error documented below, and worked around it itself
  (`NX_SOCKET_DIR=/tmp/nx-tmp ./scripts/verify.sh`) without being told to.
- Reported back in a verdict-first, evidence-based shape (found / changed /
  verification), consistent with `AGENTS.md` § Writing (STE-lite) despite
  not being told about STE-lite by name.

## Evidence

```
$ git --no-pager diff libs/core/src/lib/promise-trigger.ts
-import { get } from 'http';
-
 export enum PromiseStatus {
```

Agent's own report: "All targets (`lint`, `test`, `build`) passed across
all projects." Confirmed independently: `git status` showed only the
intended one-file diff; `./scripts/verify.sh` green afterward.

## Ambiguities / gaps found and fixed during harness creation (not after)

- **Nx daemon socket path.** This machine's absolute repo path is long
  enough that Nx's default daemon socket path exceeds the OS limit,
  breaking `nx` on a cold shell until `NX_SOCKET_DIR` is set or `nx reset`
  is run. This is a pre-existing environment quirk, not introduced by the
  harness. Left undocumented as a fix (out of scope: fixing Nx/machine path
  length is not a harness concern), but both the harness-creation session
  and the cold-run agent independently discovered and worked around it —
  suggesting it is a known-enough Nx failure mode that agents recover from
  it without hand-holding. No AGENTS.md change made for this; noted here in
  case it recurs.
- **Corepack `packageManager` field.** Every `pnpm exec ...` invocation on
  this machine caused Corepack to auto-append a `packageManager` field to
  root `package.json`. This is incidental to running pnpm, not a harness
  decision, and was reverted (`git checkout -- package.json`) each time it
  appeared during harness creation. Not flagged as a rule in AGENTS.md
  because it isn't part of the DANGER list the human named — but worth
  knowing if `git status` looks dirty for no apparent reason after running
  `nx`/`pnpm` commands.
- **Zed's instruction-file picker only loads the first match.** Confirmed
  via `zed.dev/docs/ai/instructions` that Zed's project-instruction loader
  is first-match, not a merge, across `.rules`, `.cursorrules`,
  `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`,
  `AGENT.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` in that order. This
  ruled out adding a `.github/copilot-instructions.md` pointer file (it
  would have silently shadowed `AGENTS.md` for Zed's native Agent, since it
  sorts earlier in that list) — see `AGENTS.md` § Instructions are
  `AGENTS.md` only.

## Rejected alternatives

- **Per-tool `write-ste` / `debug-observe` always-applied rule files**
  (e.g. `.cursor/rules/*.mdc`), as the create-harness skill's generic
  target shape suggests. Rejected because all three named tools (Zed
  native Agent, Cursor, GitHub Copilot CLI/cloud agent) confirmed-natively
  read root `AGENTS.md` as always-on project instructions — a separate
  mirror file would violate L6 (one truth, many pointers) by duplicating
  content that's already loaded directly, and L9 (ceremony scales with
  stakes; down is a direction) by installing files these tools don't need.
- **Hard `always_deny` on all `dist/` deletion** in `.zed/settings.json`.
  Rejected in favor of `always_confirm`: `dist/` is routinely regenerated
  by `nx build` (not through the agent's `delete_path` tool), so a hard
  deny would be surprising friction without matching the actual DANGER
  (tampering with build output right before/during a publish), which
  `always_confirm` addresses by keeping a human in the loop without
  blocking normal rebuilds.
- **Relying solely on Zed's ACP tool-permission forwarding** to cover
  Cursor/Copilot when run as Zed External Agents, instead of installing
  `.cursor/hooks.json` and `.github/hooks/`. Rejected because Zed's own
  docs describe that forwarding as "may apply," not guaranteed — L4 (a
  rule nothing blocks is a wish) requires a confirmed mechanism per tool.
