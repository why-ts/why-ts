# Mental Model — why-ts

Changing this file needs human approval. It is the inviolable spirit of the
project; decisions and roadmaps must not contradict it.

## What this project is

A small collection of independent, focused TypeScript libraries, each
published to npm under the `@why-ts` scope:

- `@why-ts/cli` — hackable command line parser and executor
- `@why-ts/core` — shared utilities used by other `@why-ts` packages
- `@why-ts/irpc` — bi-directional reactive protocol

Each library is versioned and released **independently** (Nx release,
`projectsRelationship: "independent"`). A change to one library does not
force a version bump in the others.

## Why this shape

- **Small, focused libraries** over one big utility-belt package. Each
  package should do one thing and be usable on its own.
- **Public npm packages are a one-way door.** Once a version is published,
  its published contents are effectively permanent (unpublishing is
  discouraged and time-limited). Treat every publish as if it cannot be
  undone.
- **Git tags are the version source of truth** (`currentVersionResolver:
  "git-tag"` in each project's `project.json`). Tag history integrity
  matters as much as npm registry integrity — corrupting tags corrupts the
  release record even if npm itself is untouched.
- **CI (`nx affected`) and local verify (`nx run-many`) intentionally
  differ.** CI optimizes for PR feedback speed; `scripts/verify.sh` is the
  full-repo, no-shortcuts signal used before anything is considered "done."

## What must never change without a human deciding it

- Independent per-package release/versioning strategy (vs. a single
  lockstep version).
- Git tags as the version resolver for `nx release`.
- Public `publishConfig.access: "public"` on the published packages —
  flipping any of them to private/restricted is a deliberate, human-only
  call.
