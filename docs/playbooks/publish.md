# Playbook: Publish a release (`nx release`)

Publishing is the worst irreversible act in this repo: it puts a public,
effectively-permanent version on npm. The actual publish step is
**human-only**. An agent may prepare and dry-run a release; it must never
execute the real one. This is enforced by:

- `.zed/settings.json` — `agent.tool_permissions.tools.terminal.always_deny`
  blocks `nx release`, `npm/pnpm/yarn publish`, `git push --force`, and git
  tag deletion/force-move for Zed's native Agent.
- `.cursor/hooks.json` + `.cursor/hooks/deny-dangerous.js` — same denials
  for Cursor.
- `.github/hooks/deny-dangerous.json` +
  `.github/hooks/scripts/deny-dangerous.js` — same denials for GitHub
  Copilot CLI / cloud agent.

## Trigger

You (the human) decide one or more of `@why-ts/cli`, `@why-ts/core`,
`@why-ts/irpc` are ready for a new version. Each package releases
independently (`projectsRelationship: "independent"` in `nx.json`).

## Pre-checks

1. `./scripts/verify.sh` passes (lint + test + build, all projects).
2. `git status` is clean; you are on `main`; `main` is up to date with
   origin.
3. Commit history since the last tag follows Conventional Commits
   (`nx.json` → `release.version.conventionalCommits: true` derives the
   version bump from these).

## Backup

There is nothing to snapshot beyond git itself: `nx release`'s version
source of truth is git tags (`currentVersionResolver: "git-tag"` in each
`libs/*/project.json`). Note the current tags before you start
(`git tag -l`) so you have a known-good reference point if something needs
investigation afterward.

## Steps (human-run)

1. Dry run first, always:
   ```
   pnpm exec nx release --dry-run
   ```
   Review the version bumps and changelog it proposes. An agent may run
   this step and report the output — it does not publish or tag anything.
2. If the dry run looks right, run the real release yourself:
   ```
   pnpm exec nx release
   ```
   This bumps versions, creates git tags, builds (`preVersionCommand: pnpm
   dlx nx run-many -t build`), and publishes to npm
   (`nx-release-publish` per project). This step requires your npm auth and
   must not be run by an agent.

## Post-release verification

1. Confirm the new version(s) appear on the npm registry
   (`npm view @why-ts/<pkg> versions`).
2. Confirm the new git tag(s) exist and point at the released commit
   (`git tag -l`, `git show <tag>`).
3. Optionally install the freshly published version in a scratch project
   to confirm it resolves and runs.

## Rollback

- npm's unpublish window is short and discouraged for packages with any
  real usage; treat a bad publish as needing a **new patch release** that
  fixes the problem, not an unpublish.
- Never delete or force-move the git tag `nx release` created (see
  Territory map in `AGENTS.md` — tag mutation is Never-tier). The tag is
  the historical record of what was actually published, even if the
  contents were wrong.

## Human-only steps (cannot be delegated to an agent)

- Running `pnpm exec nx release` for real (requires npm auth you hold).
- Any `npm unpublish` decision.
- Deciding to skip or override a failing `verify.sh` before releasing.
