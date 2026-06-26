#!/usr/bin/env bash
# Build gate: does the studio (incl. generated components) typecheck? exit code = verdict. cwd = repo root.
# Usage: scripts/gates/build.sh
set -euo pipefail
exec npx tsc -p apps/studio/tsconfig.json --noEmit
