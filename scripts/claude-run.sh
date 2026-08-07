#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$HOME/.config/Claude/claude-code/2.1.222:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WT="${CLAUDE_WORKTREE:-$HOME/freenet-roulette-claude}"
TASK="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
if [[ ! -f "$TASK" ]]; then
  echo "Usage: $0 path/to/task.md" >&2
  exit 1
fi
mkdir -p "$ROOT/scripts/claude-logs"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOG="$ROOT/scripts/claude-logs/claude-${STAMP}.out"
echo "WORKTREE=$WT TASK=$TASK LOG=$LOG"
# Sync latest from main working tree into Claude worktree before each run
rsync -a "$ROOT/mobile/src/media/" "$WT/mobile/src/media/"
rsync -a "$ROOT/mobile/src/hub/" "$WT/mobile/src/hub/"
rsync -a "$ROOT/mobile/app/live.tsx" "$WT/mobile/app/live.tsx"
rsync -a "$ROOT/ui/webrtc.js" "$WT/ui/webrtc.js"
rsync -a "$ROOT/ui/live.js" "$WT/ui/live.js"
[[ -f "$ROOT/mobile/scripts/test-connect-ui.mjs" ]] && rsync -a "$ROOT/mobile/scripts/test-connect-ui.mjs" "$WT/mobile/scripts/test-connect-ui.mjs"
cd "$WT"
nohup claude -p "$(cat "$TASK")" \
  --output-format text \
  --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
  >"$LOG" 2>&1 &
echo $! > "$ROOT/scripts/claude-logs/claude.pid"
echo "CLAUDE_PID=$(cat "$ROOT/scripts/claude-logs/claude.pid")"
echo "LOG=$LOG"
