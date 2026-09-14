# AGENTS.md — why-ts

why-ts is an Nx monorepo of small, independent TypeScript libraries
(`@why-ts/cli`, `@why-ts/core`, `@why-ts/irpc`) published publicly to npm.
Stakes are **production**: published packages are public and versions are
immutable once released.

Agents: solo (one human + AI agents; Zed native Agent, GitHub Copilot,
Cursor — see Tool gates below). No multi-agent coordination ceremony is
required, but the roadmap layout below is still installed so work survives
across sessions and tools (L1).

## Authority order

`docs/MENTAL_MODEL.md` > `docs/decisions/` > `docs/roadmaps/` > `docs/notes/`

Notes are where thinking happens. Only promoted conclusions (decisions,
roadmap Status) bind anyone.

## Writing (STE-lite)

Apply to: replies to the human, roadmap Agent log lines, failure
explanations, commit messages you author. Do not force onto existing
doctrine on disk unless you are already editing it for substance.

1. One term, one meaning. Prefer: Claimed-by, Open / Ask human / Never,
   `./scripts/verify.sh`, Executable, Status.
2. Short sentences, one idea each. Prefer ≤25 words.
3. Active voice. Imperatives for required acts.
4. No fluff, hedges, or restating the task back to the human.
5. First sentence = verdict, status, or next action.
6. Evidence, not essay: paths, commands, Status values, checklist ticks.

Do not use: seamlessly, robust, leverage, comprehensively, in order to, it
is worth noting, as previously mentioned, going forward, "feel free to",
just / simply (when hiding cost).

Agent log line shape:

```text
YYYY-MM-DD agent (chunk): Did X. Evidence: <cmd or path>. Status: <status>.
```

## Debug loops

Form a hypothesis, instrument if needed, then auto-run the narrowest path
that can exercise the behavior and collect the evidence yourself. Prefer:
project test targets (`pnpm exec nx test <project>`) → `./scripts/verify.sh`
→ manual repro script. Do not stop at "please run this and paste logs" if
you can observe it yourself. Ask the human only for operator-only steps
(publishing, npm auth, anything the DANGER list marks Never/Ask human).

## Territory map & permission tiers

| Area | Tier | Why | Mechanism |
| --- | --- | --- | --- |
| `libs/*/src`, tests, docs, `README.md`, non-release config | **Open** | Ordinary development work | none needed |
| `nx.json`, `tsconfig.base.json`, `.eslintrc.json`, CI workflow (`.github/workflows/ci.yml`) | **Ask human** | Changes here affect every project's build/lint/test contract | code review; no mechanical block |
| `libs/*/package.json` version/publishConfig fields, `.npmrc`, `.verdaccio/config.yml` | **Ask human** | Touches how/where packages get published | code review; no mechanical block |
| `dist/**` (build output) | **Ask human** if touched directly by an agent tool (not via `nx build`) | Build output that becomes the published artifact | `.zed/settings.json` `delete_path.always_confirm` on `dist/` |
| `git push --force` / `-f` (any branch) | **Never** | Public repo; force-push rewrites shared history | `.zed/settings.json` terminal `always_deny`; `.cursor/hooks.json`; `.github/hooks/deny-dangerous.json` |
| `npm publish`, `pnpm publish`, `yarn publish`, `nx release` (version + tag + publish) | **Never** | Publishes public, immutable package versions | same three gates as above |
| `git tag -d/-f/--delete`, `git push --delete <tag>` / `:refs/tags/...` | **Never** | `nx release` uses git tags as the version source of truth (`currentVersionResolver: git-tag`); mutating tags corrupts version history | same three gates as above |

**Never** means: an agent must not run it, and three independent mechanisms
block the *terminal/bash* form of it regardless of which tool is driving:

- Zed native Agent: `.zed/settings.json` → `agent.tool_permissions` (regex
  `always_deny`, cannot be overridden by `always_allow` or a global "allow"
  default). Docs: <https://zed.dev/docs/ai/tool-permissions>
- Cursor (standalone or as a Zed External Agent): `.cursor/hooks.json` →
  `beforeShellExecution` hook (`.cursor/hooks/deny-dangerous.js`), fails
  closed. Docs: <https://cursor.com/docs/agent/hooks>
- GitHub Copilot CLI / cloud agent (standalone or as a Zed External Agent):
  `.github/hooks/deny-dangerous.json` → `preToolUse` hook
  (`.github/hooks/scripts/deny-dangerous.js`), fails closed on error. Docs:
  <https://docs.github.com/en/copilot/reference/hooks-reference>

Zed's own docs note that ACP tool-permission forwarding to External Agents
(Copilot/Cursor run inside Zed) "may apply" but is not guaranteed — the
Cursor and Copilot hook files above are the confirmed mechanism for those
tools regardless of how they are launched. There is no known mechanical
gate for a human running these commands directly by hand; that path is
Ask-human by convention, not blocked.

The actual `nx release` execution (which publishes to npm) is **human-only**
— see `docs/playbooks/publish.md`. An agent may prepare and dry-run a
release, never execute the real one.

## Instructions are `AGENTS.md` only

Zed's native Agent, Cursor, and GitHub Copilot CLI/cloud agent all read
this root `AGENTS.md` directly as always-on project instructions (confirmed
during harness creation — see `docs/decisions/`). Do **not** add
`.github/copilot-instructions.md`, `.rules`, `.cursorrules`, or similar
pointer files: Zed's project-instruction loader picks the **first** match
from a fixed priority list, and `.github/copilot-instructions.md` / `.rules`
outrank `AGENTS.md` in that list — creating one would silently shadow this
file for Zed's own Agent. One truth, no shadow files.

## Parallel work / Claimed-by

Solo project today. If a second agent or human ever works here in parallel,
claim a roadmap chunk in `docs/roadmaps/_index.md` (agent + roadmap + chunk
+ branch + since) before starting, one writer per branch, and follow
`execute-roadmap`'s Protocol Pack.

## Done = evidence

A chunk of work is done when `./scripts/verify.sh` passes
(`pnpm exec nx run-many -t lint test build`), and the roadmap Status /
checklist / Agent log are updated on disk in the same session. CI runs
`nx affected` for speed (`.github/workflows/ci.yml`); `verify.sh` runs
everything, so treat it as the trustworthy full-repo signal.

## Roadmaps

- Author new roadmaps with the **create-roadmap** skill.
- Execute roadmaps with the **execute-roadmap** skill.
- Current focus / Ready queue: `docs/roadmaps/_index.md`.
- Completed roadmap inventory (append-only, no Claimed-by): `docs/roadmaps/_archive.md`.

## Model quota retry

If a task or subagent fails due to paid-model quota or a rate limit,
automatically resume/retry using whatever automatic or free fallback model
path the environment offers (e.g. an "auto" mode), if any. Do not stall
waiting only for human intervention on quota alone. Quota retry never
overrides an Ask-human gate or a Never-tier block.
