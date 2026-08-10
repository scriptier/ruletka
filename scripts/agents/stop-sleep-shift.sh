#!/usr/bin/env bash
# Stop continuous Claude worker cleanly.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOGS="$ROOT/scripts/claude-logs"
mkdir -p "$LOGS"
touch "$LOGS/continuous.stop"
echo "stop flag set → $LOGS/continuous.stop"

# Kill continuous parent if known
if [[ -f "$LOGS/continuous.lock" ]]; then
  pid=$(cat "$LOGS/continuous.lock" 2>/dev/null || true)
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "sending TERM to continuous pid=$pid"
    kill "$pid" 2>/dev/null || true
  fi
fi
if [[ -f "$LOGS/continuous.supervisor.pid" ]]; then
  spid=$(cat "$LOGS/continuous.supervisor.pid" 2>/dev/null || true)
  if [[ -n "${spid:-}" ]] && kill -0 "$spid" 2>/dev/null; then
    kill "$spid" 2>/dev/null || true
  fi
fi
# Do NOT kill mid-Claude by default — wait up to 30s for clean exit
for i in 1 2 3 4 5 6; do
  if [[ -f "$LOGS/continuous.lock" ]]; then
    pid=$(cat "$LOGS/continuous.lock" 2>/dev/null || true)
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      sleep 5
      continue
    fi
  fi
  break
done

if [[ -f "$LOGS/claude.pid" ]]; then
  cpid=$(cat "$LOGS/claude.pid" 2>/dev/null || true)
  if [[ -n "${cpid:-}" ]] && kill -0 "$cpid" 2>/dev/null; then
    echo "Claude still running pid=$cpid (finishing current task is OK)"
    echo "  force: kill $cpid"
  fi
fi
echo "stop requested — continuous will not start new tasks"
