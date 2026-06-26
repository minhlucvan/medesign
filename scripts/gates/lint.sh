#!/usr/bin/env bash
# Consistency-lint gate. exit code = verdict (0 = clean, 1 = has P0). cwd = repo root.
# Usage: scripts/gates/lint.sh <ComponentName>
set -euo pipefail
COMPONENT="${1:?usage: lint.sh <ComponentName>}"
MDS="${MEDESIGN_CLI:-npx tsx packages/cli/src/cli.ts}"
exec $MDS lint "$COMPONENT"
