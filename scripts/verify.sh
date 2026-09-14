#!/usr/bin/env bash
# why-ts harness verifier (L2: Done means proven).
# Runs the full local check across every project: lint, test, build.
# CI uses `nx affected` for speed; this runs everything so a single green
# result is trustworthy evidence for docs/roadmaps Status and Agent log.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

pnpm exec nx run-many -t lint test build
