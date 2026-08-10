#!/usr/bin/env bash
# Start continuous Claude worker in background (PC stays on while you sleep).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOGS="$ROOT/scripts/claude-logs"
mkdir -p "$LOGS"
LOCK="$LOGS/continuous.lock"

if [[ -f "$LOCK" ]]; then
  old=$(cat "$LOCK" 2>/dev/null || true)
  if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
    echo "already running pid=$old"
    echo "  status: $ROOT/scripts/agents/status.sh"
    echo "  log:    $LOGS/continuous-$(date -u +%Y%m%d).log"
    exit 0
  fi
fi

rm -f "$LOGS/continuous.stop"
OUT="$LOGS/continuous-nohup-$(date -u +%Y%m%dT%H%M%SZ).out"
# Keep running indefinitely; optional STOP_HOUR empty
export AUTO_REFILL="${AUTO_REFILL:-1}"
export IDLE_SLEEP_SEC="${IDLE_SLEEP_SEC:-180}"
export BETWEEN_TASK_SEC="${BETWEEN_TASK_SEC:-20}"
export MAX_TASKS="${MAX_TASKS:-0}"
export CLAUDE_TIMEOUT_SEC="${CLAUDE_TIMEOUT_SEC:-2400}"

nohup bash "$ROOT/scripts/agents/continuous.sh" >>"$OUT" 2>&1 &
echo $! >"$LOGS/continuous.supervisor.pid"
sleep 1
echo "STARTED continuous Claude shift"
echo "  supervisor_pid=$(cat "$LOGS/continuous.supervisor.pid")"
echo "  nohup: $OUT"
echo "  live:  $LOGS/continuous-$(date -u +%Y%m%d).log"
echo "  stop:  $ROOT/scripts/agents/stop-sleep-shift.sh"
echo "  status:$ROOT/scripts/agents/status.sh"
# show queue
bash "$ROOT/scripts/agents/status.sh" | head -40
