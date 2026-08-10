#!/usr/bin/env bash
set -euo pipefail
WT="${CLAUDE_WORKTREE:-$HOME/freenet-roulette-claude}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== git status (claude worktree) ==="
git -C "$WT" status -sb
echo "=== diff stat ==="
git -C "$WT" diff --stat
echo "=== test-connect-ui ==="
node "$WT/mobile/scripts/test-connect-ui.mjs" 2>&1 || node "$ROOT/mobile/scripts/test-connect-ui.mjs" 2>&1 || true
