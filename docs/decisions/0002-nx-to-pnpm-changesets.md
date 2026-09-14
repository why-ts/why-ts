# 0002 — Migrate from Nx to pnpm + Changesets

## Decision

`why-ts` replaced all Nx tooling (build, test, lint, release, task
orchestration) with plain pnpm-workspace-based tooling, executed as the
roadmap at `docs/roadmaps/2609141945_NX_TO_PNPM_MIGRATION_ROADMAP.md`
(12 chunks: F1, T1, T2, L1, B1, B2, R1, R2, R3, C1, E1, A1). This record
covers the release-mechanism half of that migration (nx release →
Changesets) plus the build/test/lint half, and states plainly what the
roadmap's own chunks proved, what they did not, and what remains open.

Nx itself is not deleted by this migration — it stays installed, unused,
as a safety net. Physical removal is a separate, later roadmap
(`NX_TEARDOWN`), deliberately excluded here to keep this migration's own
worst-case blast radius at "revert a commit," not "point of no return."

## What changed

- **Release mechanism**: `nx release` → Changesets (`@changesets/cli`) for
  independent per-package versioning and changelogs (chunk R1). Root
  `package.json` gained `changeset`, `version-packages`, and `release`
  scripts wired to `changeset`, `changeset version`, and `changeset
  publish` respectively.
- **Build**: `@nx/js:tsc` (Nx executor) → plain per-package `tsc -p
  tsconfig.lib.json` plus a `cp package.json README.md ...` postbuild step
  (chunks B1 for `core`, B2 for `cli`/`irpc`).
- **Test**: Nx's `nxViteTsPaths()` Vite plugin → standalone
  `vite-tsconfig-paths`, run directly via `vitest run` (chunks T1 for
  `core`, T2 for `cli`/`irpc`).
- **Lint**: Nx's `@nx/eslint-plugin` configs (`plugin:@nx/typescript`,
  `plugin:@nx/javascript`, `@nx/enforce-module-boundaries`,
  `@nx/dependency-checks`) → a single root `.eslintrc.json` inlining the
  same underlying `@typescript-eslint/recommended` rule set directly, no
  Nx plugin (chunk L1, Ask-human tier).
- **CI / local verify**: `nx affected -t lint test build` (changed-projects
  only) → `pnpm -r --if-present run lint/test/build`, always full-repo, in
  both `.github/workflows/ci.yml` and `scripts/verify.sh` (chunk C1,
  Ask-human tier).
- **Workspace linking**: no `pnpm-workspace.yaml` existed before this
  migration; `libs/irpc/package.json`'s `@why-ts/core` dependency changed
  from a hardcoded `"0.0.1"` to `"workspace:*"` (chunk F1), giving pnpm a
  real symlink and a real topological build order in place of Nx's
  project-graph inference.

## What was preserved

- Independent per-package npm publishing under the `@why-ts` scope.
- Public access (`publishConfig.access` untouched).
- The immutable-once-published policy for released versions.
- CJS module format. B1 diffed the plain-`tsc` build's
  `dist/libs/core/src/index.js` against Nx's own ground-truth build
  (captured by running `pnpm exec nx build core` once, before any change)
  and got a byte-identical file: `require("tslib")`,
  `Object.defineProperty(exports, ...)`, no `import`/`export` keywords.
- The `dist/libs/<pkg>/src/...` output layout. B1 captured Nx's real
  23-file `dist/libs/core/` tree as ground truth and reproduced it exactly
  with plain `tsc` (`rootDir`/`outDir` set explicitly in
  `tsconfig.lib.json`, resolved relative to the package directory). B2
  reproduced the same shape for `irpc`'s 33-file tree, but needed a real
  adaptation, not a blind copy of B1: `irpc` has cross-package source
  imports (`@why-ts/core`), so a narrow `rootDir` fails compilation with
  `TS6059`. The working recipe leaves `rootDir` at its inherited
  repo-root default and adds a postbuild flatten/prune shell step
  (`mv`/`rm -rf`) to collapse the resulting nested output and drop the
  redundant `core` source mirror `tsc` pulls in for type-checking. This
  postbuild step is shaped to today's exact two-package topology and will
  need updating if `irpc` gains a second internal workspace dependency —
  flagged by B2's coder/hardener/reviewer alike, not silently accepted.

## Evidence — R1 (Changesets setup)

- `.changeset/config.json`, written by the real `changeset init` command
  (not hand-authored): `"fixed": [], "linked": []` — independent
  versioning mode, no groups introduced by accident — plus
  `"access": "public"` and `"baseBranch": "main"`.
- `pnpm exec changeset status --verbose` ran clean against the real
  workspace with zero changesets present, confirming the config is valid
  with no side effects.
- No `changeset version`/`changeset publish` (real or dry-run) was
  invoked in R1 — confirmed by an empty `find . -name CHANGELOG.md`
  and an empty `git diff` on every lib `package.json`.

## Evidence — R2 (Verdaccio dry-run proof)

- A local Verdaccio instance (root `local-registry` script, reusing the
  pre-existing `.verdaccio/config.yml` unmodified) received a real
  `pnpm changeset publish` of a throwaway `core` patch bump.
- **Dependent-bump cascade confirmed**: `pnpm exec changeset status
  --verbose` showed `@why-ts/core -> 0.0.2` and `@why-ts/irpc -> 0.0.2`
  (cascaded, because `irpc` depends on `core` via `workspace:*`);
  `@why-ts/cli` was untouched — matching this roadmap's locked,
  accepted-cascade Decision exactly.
- **`workspace:*` never reached the published tarball**: fetching the
  published `irpc` package back from the local registry
  (`curl http://localhost:4873/@why-ts/irpc/0.0.2`) showed
  `"@why-ts/core": "0.0.2"` in its `dependencies` — a real resolved
  semver, never the literal string `workspace:*`. This is pnpm's built-in
  publish-time rewrite, observed on the wire, not merely cited from
  documentation.
- **Real registry never touched**: an independent, direct HTTPS fetch to
  `https://registry.npmjs.org/@why-ts/core/latest` (outside any repo
  tooling) showed the real released version (`0.3.1`) unchanged by the
  local dry run.
- **Throwaway state fully reverted**: version bumps on `libs/core` and
  `libs/irpc` `package.json`, and the two `CHANGELOG.md` files created by
  `changeset version`, were all reverted; confirmed via `git diff` against
  `main` showing no residual change to any lib version.
- One incident during R2 is worth recording as harness evidence, not just
  a footnote: `changeset publish` created two real local git tags
  (`@why-ts/core@0.0.2`, `@why-ts/irpc@0.0.2`) as a side effect of the
  dry run, visible repo-wide because git worktrees share one object
  database. This directly conflicted with this roadmap's locked "no extra
  git tag is added" Decision. Deleting tags is Never-tier for agents per
  `AGENTS.md`'s territory map, so the chunk correctly stopped and escalated
  to the human rather than self-fixing; the human deleted the two stray
  tags, and the chunk resumed once confirmed clean (`git ls-remote --tags
  origin` and local `git tag` both showed zero matches for `0.0.2`
  afterward). This is direct, first-hand proof that the Never-tier tag
  gate in `AGENTS.md`'s territory map functions as designed under a real
  policy violation, not just in theory.

## Gaps this migration surfaced but did not close

Both of the following are explicitly out of this roadmap's scope. Neither
is resolved by R1, R2, R3, or any other chunk in this roadmap.

**(a) Pre-existing `cli` build failure, unrelated to this migration.**
`nx build cli` and its plain-`tsc` equivalent both fail with `RangeError:
Maximum call stack size exceeded` inside TypeScript 5.5.4's variance-check
recursion (`outofbandVarianceMarkerHandler`). First found at chunk F1 on a
pristine pre-migration checkout with a fresh `pnpm install` (this sandbox's
Node/pnpm regenerate the committed `lockfileVersion: '6.0'` lockfile into a
newer format that triggers it); reproduced identically at B2 (isolated
`tsc` invocation, with and without a larger stack size — ruling out a
simple depth limit) and again at C1 on real GitHub Actions infrastructure
(run `34850054641`, Ubuntu, Node 20.20.2) — confirming this is a genuine,
infrastructure-independent TypeScript bug, not a local sandbox artifact.
The human narrowed this roadmap's Acceptance to drop `cli` build parity
entirely rather than gate the migration on it, and directed that it be
tracked separately at
`docs/roadmaps/2609142054_CLI_BUILD_STACK_OVERFLOW_FIX_ROADMAP.md` (still
draft, not yet Executable). The human has confirmed this is deferred, not
blocking.

**(b) Changesets publishes from TypeScript source, not compiled `dist/`.**
R2's dry run — and the Changesets/`pnpm` wiring introduced by R1 — publish
each package from its own workspace directory (`libs/<pkg>`, as declared
in `pnpm-workspace.yaml`), which only ever contains TypeScript source
(`src/index.ts`). Nothing in R1 or R2 wires publishing from
`dist/libs/<pkg>` instead. This is a real behavior change from Nx's old
release path: Nx's `nx-release-publish` target reads `packageRoot:
"dist/{projectRoot}"` (per `libs/core/project.json`), i.e. it always
published from the compiled output, never from source. R2's Acceptance
(AC-REL-PUBLISH) only required checking the published version and the
`workspace:*`→semver rewrite, both of which were verified against the real
published artifact regardless of what else that artifact contained — so
this gap did not block R2's own scenario. But it means: **a real (non-dry-run)
`pnpm changeset publish` today would ship each package's TypeScript
source, not its compiled CommonJS output, unless a `packageRoot`-equivalent
mechanism is added first.** This is an explicit open follow-up item, not
resolved by this roadmap, and must be addressed before any real release is
attempted through this new pipeline.

## Accepted tradeoffs

- **CI runtime**: CI and `scripts/verify.sh` both moved from `nx
  affected` (changed-projects-only) to always running the full `pnpm -r`
  pipeline for lint/test/build, on every push/PR and every local run
  (chunk C1). Accepted per this roadmap's locked Decisions: at 3 packages,
  the affected-only savings were judged negligible against removing an
  entire tool category (task-graph/caching).
- **`@nx/dependency-checks` ESLint rule dropped, no replacement** (chunk
  L1): this rule checked that `package.json` dependencies matched actual
  source imports. Accepted minor coverage loss; revisit only if it causes
  a real incident.
- **`examples/cli` drops out of CI/build coverage** (chunk E1): it is a
  non-published manual demo with no tests and, correspondingly, no `build`
  script — an accepted reduction in CI surface versus Nx's prior coverage
  of it via `@nx/esbuild`.

## Outstanding human sign-offs

Two chunks in this roadmap edit files `AGENTS.md`'s territory map marks
Ask-human tier. Neither is a rubber stamp from six-pack review alone —
both require explicit human sign-off before a real merge:

- **L1** — root `.eslintrc.json` rewrite (dropped the Nx ESLint plugin and
  module-boundary/dependency-checks rules; inlined the equivalent
  `@typescript-eslint` rule set directly).
- **C1** — `.github/workflows/ci.yml` rewrite (removed
  `nrwl/nx-set-shas`/Nx Cloud/`nx affected`; added the `pnpm -r
  --if-present` pipeline; also bumped `pnpm/action-setup` from major
  version 8 to 10, a real, necessary fix discovered only by a real failing
  CI run against the committed `lockfileVersion: '9.0'` lockfile).

C1's own reviewer additionally flagged that AC-C1a's literal text ("both
succeed for all three libraries") is not fully met — `cli`'s build still
fails on gap (a) above, confirmed on real CI infrastructure — and
recommended the human resolve this explicitly during the same sign-off,
rather than treating it as silently accepted by six-pack review precedent
from B1/B2.

## Rejected alternatives

- **Turborepo, or any other task-graph/caching tool**, as a lighter-weight
  Nx replacement. Rejected per this roadmap's Goal: introducing a new
  task-orchestration/cache layer would reintroduce the exact tool category
  this migration exists to remove, in exchange for savings judged
  negligible at 3 packages (see "Accepted tradeoffs" above).
- **A bundler (tsup/esbuild) for the 3 published libraries**, instead of
  plain `tsc`. Rejected: the Goal explicitly named this out of scope, and
  B1/B2 proved plain per-package `tsc` reproduces Nx's exact CJS output
  and directory layout without one.
- **Changesets `fixed`/`linked` version groups**, instead of independent
  mode. Rejected in favor of the default independent mode (R1's
  `.changeset/config.json`), matching this roadmap's locked Decision to
  accept Changesets' standard dependent-bump cascade for `irpc` rather
  than force it to version in lockstep with `core`.
- **Deleting Nx outright as part of this migration.** Rejected: Nx stays
  installed, unused, as a safety net until this migration is merged and
  baked in on `main`. Physical removal is deliberately deferred to a
  separate `NX_TEARDOWN` roadmap, keeping this migration's own worst-case
  blast radius at "revert a commit."
- **A CLI `--registry` flag on `changeset publish` for R2's local-only
  scoping.** No such flag exists (confirmed via `changeset publish
  --help`); rejected in favor of env-var-only registry scoping
  (`npm_config_registry`, `NPM_CONFIG_USERCONFIG` pointed at a gitignored
  scratch `.npmrc`), which kept the repo's real `.npmrc` untouched and
  outside R2's declared Files list.
