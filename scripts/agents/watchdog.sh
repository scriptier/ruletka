#!/usr/bin/env bash
# Hourly / @reboot: ensure continuous Claude shift is alive (PC-on automation).
# Safe: never deploys; only restarts continuous if lock dead.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOGS="$ROOT/scripts/claude-logs"
mkdir -p "$LOGS"
LOCK="$LOGS/continuous.lock"
LOG="$LOGS/watchdog.log"
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >>"$LOG"; }

# Optional: skip if user set stop flag intentionally
if [[ -f "$LOGS/continuous.stop" ]]; then
  log "stop flag present — not restarting"
  exit 0
fi

alive=0
if [[ -f "$LOCK" ]]; then
  pid=$(cat "$LOCK" 2>/dev/null || true)
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    alive=1
  fi
fi

if [[ "$alive" == "1" ]]; then
  log "continuous ok pid=$(cat "$LOCK")"
  exit 0
fi

log "continuous dead — restarting"
# Clear stale lock
rm -f "$LOCK"
bash "$ROOT/scripts/agents/start-sleep-shift.sh" >>"$LOG" 2>&1 || log "restart failed"
exit 0
