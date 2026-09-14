# Mental Model — why-ts

Changing this file needs human approval. It is the inviolable spirit of the
project; decisions and roadmaps must not contradict it.

## What this project is

A small collection of independent, focused TypeScript libraries, each
published to npm under the `@why-ts` scope:

- `@why-ts/cli` — hackable command line parser and executor
- `@why-ts/core` — shared utilities used by other `@why-ts` packages
- `@why-ts/irpc` — bi-directional reactive protocol

Each library is versioned and released **independently** (via Changesets,
independent versioning mode — `.changeset/config.json`'s `"fixed": []`,
`"linked": []`). A change to one library does not force a version bump in
the others, aside from Changesets' own dependent-bump cascade for a
package that depends on the changed one via `workspace:*` (e.g. `irpc`
when `core` changes) — accepted, not a lockstep version.

## Why this shape

- **Small, focused libraries** over one big utility-belt package. Each
  package should do one thing and be usable on its own.
- **Public npm packages are a one-way door.** Once a version is published,
  its published contents are effectively permanent (unpublishing is
  discouraged and time-limited). Treat every publish as if it cannot be
  undone.
- **Independent per-package release, now via Changesets.** Nx's release
  command and its git tag-based version resolver were replaced by
  Changesets (`@changesets/cli`) with human approval; the locked policy —
  independent per-package versioning — did not change, only the
  mechanism. See `docs/decisions/0002-nx-to-pnpm-changesets.md` for the
  full record.
- **CI and local verify run the identical full pipeline.** Both
  `.github/workflows/ci.yml` and `scripts/verify.sh` run `pnpm -r
  --if-present run lint/test/build` on every invocation — no
  changed-projects-only fast path (an accepted tradeoff at 3 packages; see
  `docs/decisions/0002-nx-to-pnpm-changesets.md`).

## What must never change without a human deciding it

- Independent per-package release/versioning strategy (vs. a single
  lockstep version) — the policy is locked; only its mechanism changed,
  from Nx's git tag-based version resolver to Changesets, with human
  approval (`docs/decisions/0002-nx-to-pnpm-changesets.md`).
- Release-history git tags. Changesets does not read tags as its version
  source of truth (unlike the retired resolver), but `changeset publish`
  still creates one tag per published package as a side effect — deleting
  or force-mutating any tag remains a human-only call (see `AGENTS.md`'s
  Never-tier).
- Public `publishConfig.access: "public"` on the published packages —
  flipping any of them to private/restricted is a deliberate, human-only
  call.
