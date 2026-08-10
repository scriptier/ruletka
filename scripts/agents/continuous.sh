#!/usr/bin/env bash
# Continuous Claude worker — keep PC on; drains queue forever until stop.
#
# Never deploys. Never touches CONNECTIVITY_LOCK unless a task explicitly allows.
#
# Usage:
#   ./scripts/agents/continuous.sh              # foreground
#   ./scripts/agents/start-sleep-shift.sh       # background (recommended for sleep)
#   ./scripts/agents/stop-sleep-shift.sh        # stop
#
# Env:
#   IDLE_SLEEP_SEC=300       sleep when queue empty (default 5m)
#   BETWEEN_TASK_SEC=15      pause between tasks
#   MAX_TASKS=0              0 = unlimited; else stop after N successes+fails
#   AUTO_REFILL=1            pull next from backlog/ when pending empty
#   STOP_HOUR=               if set (0-23), exit when local hour >= this (optional)
set -euo pipefail
# shellcheck source=lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
agents_load

IDLE_SLEEP_SEC="${IDLE_SLEEP_SEC:-300}"
BETWEEN_TASK_SEC="${BETWEEN_TASK_SEC:-15}"
MAX_TASKS="${MAX_TASKS:-0}"
AUTO_REFILL="${AUTO_REFILL:-1}"
STOP_HOUR="${STOP_HOUR:-}"
STOP_FLAG="$LOGS/continuous.stop"
LOCK="$LOGS/continuous.lock"
LOG_FILE="$LOGS/continuous-$(date -u +%Y%m%d).log"

log() {
  local m="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
  echo "$m" | tee -a "$LOG_FILE"
}

if [[ -f "$LOCK" ]]; then
  old=$(cat "$LOCK" 2>/dev/null || true)
  if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
    log "already running pid=$old — exit"
    exit 0
  fi
fi
echo $$ >"$LOCK"
rm -f "$STOP_FLAG"
trap 'rm -f "$LOCK"; log "continuous EXIT"' EXIT

log "CONTINUOUS START idle=${IDLE_SLEEP_SEC}s between=${BETWEEN_TASK_SEC}s auto_refill=$AUTO_REFILL max=$MAX_TASKS"
log "stop with: ./scripts/agents/stop-sleep-shift.sh"

n=0
ok=0
fail=0

refill_from_backlog() {
  local backlog="$QUEUE/backlog"
  mkdir -p "$backlog"
  local next
  next=$(ls -1 "$backlog"/*.md 2>/dev/null | sort | head -1 || true)
  if [[ -z "${next:-}" ]]; then
    return 1
  fi
  local base
  base=$(basename "$next")
  # Avoid clobbering existing pending with same name
  if [[ -f "$PENDING/$base" ]]; then
    mv "$next" "$backlog/done-$base" 2>/dev/null || rm -f "$next"
    return 1
  fi
  mv "$next" "$PENDING/$base"
  log "refill → pending/$base"
  return 0
}

while true; do
  if [[ -f "$STOP_FLAG" ]]; then
    log "stop flag set — exiting cleanly"
    break
  fi
  if [[ -n "$STOP_HOUR" ]]; then
    hour=$(date +%H)
    if (( 10#$hour >= 10#$STOP_HOUR )); then
      log "STOP_HOUR=$STOP_HOUR reached (now $hour) — exit"
      break
    fi
  fi
  if [[ "$MAX_TASKS" != "0" && "$n" -ge "$MAX_TASKS" ]]; then
    log "MAX_TASKS=$MAX_TASKS reached — exit"
    break
  fi

  next=$(ls -1 "$PENDING"/*.md 2>/dev/null | sort | head -1 || true)
  if [[ -z "${next:-}" ]]; then
    if [[ "$AUTO_REFILL" == "1" ]] && refill_from_backlog; then
      continue
    fi
    log "queue empty — sleep ${IDLE_SLEEP_SEC}s (add tasks to pending/ or backlog/)"
    # sleep in chunks so stop flag is responsive
    left=$IDLE_SLEEP_SEC
    while (( left > 0 )); do
      [[ -f "$STOP_FLAG" ]] && break 2
      s=30
      (( s > left )) && s=$left
      sleep "$s"
      left=$((left - s))
    done
    continue
  fi

  n=$((n + 1))
  log "▶ task $n: $(basename "$next")"
  if bash "$AGENTS/dispatch.sh" --wait "$next" >>"$LOG_FILE" 2>&1; then
    ok=$((ok + 1))
    log "✓ ok=$ok fail=$fail"
  else
    fail=$((fail + 1))
    log "✗ fail=$fail (continuing)"
  fi

  left=$BETWEEN_TASK_SEC
  while (( left > 0 )); do
    [[ -f "$STOP_FLAG" ]] && break 2
    s=5
    (( s > left )) && s=$left
    sleep "$s"
    left=$((left - s))
  done
done

log "CONTINUOUS DONE ran=$n ok=$ok fail=$fail"
echo "ran=$n ok=$ok fail=$fail"
