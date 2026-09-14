#!/usr/bin/env bash
# why-ts harness verifier (L2: Done means proven).
# Runs the full local check across every project: lint, test, build.
# Always runs everything, on both CI and locally (no changed-projects-only
# fast path -- see roadmap Decisions "CI runtime tradeoff"), so a single
# green result is trustworthy evidence for docs/roadmaps Status and Agent
# log.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Root `lint` script (`eslint libs examples --ext .ts`) lints every library
# and example in one pass; it is not a per-package script, so it must run
# once at the workspace root rather than via `-r` (pnpm's recursive run
# excludes the workspace root by default, and there is no per-package
# `lint` script for `--if-present` to find -- `pnpm -r --if-present run
# lint` would silently run zero times).
pnpm --if-present run lint
pnpm -r --if-present run test
# `examples/cli` intentionally has no `build` script (non-published manual
# demo app, see roadmap Decisions) so `--if-present` silently skips it here
# -- accepted, not a bug.
pnpm -r --if-present run build
