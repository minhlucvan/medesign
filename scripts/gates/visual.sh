#!/usr/bin/env bash
# Visual-regression gate. exit code = verdict (0 = pass/new baseline, 1 = changed). cwd = repo root.
# Usage: scripts/gates/visual.sh <ComponentName>   (requires Storybook running on :6006)
set -euo pipefail
COMPONENT="${1:?usage: visual.sh <ComponentName>}"
MDS="${MEDESIGN_CLI:-npx tsx packages/cli/src/cli.ts}"
exec $MDS visual-test "$COMPONENT"
