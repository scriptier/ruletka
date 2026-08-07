#!/usr/bin/env bash
# Overnight multi-cycle loop (v4.1). Smart rate-limit backoff + Grok on last cycle.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
admin_load_config

LOCK="$ROOT/scripts/admin-agent/logs/nightly.lock"
if [[ -f "$LOCK" ]]; then
  old="$(cat "$LOCK" 2>/dev/null || true)"
  if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
    echo "nightly already running pid=$old" >&2
    exit 0
  fi
fi
echo $$ >"$LOCK"
trap 'rm -f "$LOCK"' EXIT

admin_log "nightly v4.1 START max=$NIGHTLY_MAX_CYCLES interval=${NIGHTLY_INTERVAL_SEC}s stop_hour=$NIGHTLY_STOP_HOUR backoff=$ENABLE_RATE_LIMIT_BACKOFF reset~${CLAUDE_RESET_LOCAL}"

cycle=0
while (( cycle < NIGHTLY_MAX_CYCLES )); do
  hour="$(date +%H)"
  # Stop once local hour reaches NIGHTLY_STOP_HOUR (e.g. 13 = 1pm)
  if (( 10#$hour >= 10#$NIGHTLY_STOP_HOUR )); then
    admin_log "nightly STOP hour=$hour (stop_hour=$NIGHTLY_STOP_HOUR)"
    break
  fi
  cycle=$((cycle + 1))
  admin_log "nightly cycle $cycle / $NIGHTLY_MAX_CYCLES"

  # Skip Grok until last cycle (saves cost) unless GROK_ONLY_LAST_CYCLE=0
  if [[ "${GROK_ONLY_LAST_CYCLE}" == "1" && "$cycle" -lt "$NIGHTLY_MAX_CYCLES" ]]; then
    export ADMIN_SKIP_GROK=1
  else
    export ADMIN_SKIP_GROK=0
  fi
  # Force Grok on final cycle
  if (( cycle == NIGHTLY_MAX_CYCLES )); then
    export ADMIN_SKIP_GROK=0
    "$SCRIPT_DIR/run-once.sh" --with-grok || admin_log "cycle $cycle errors"
  else
    "$SCRIPT_DIR/run-once.sh" || admin_log "cycle $cycle errors"
  fi

  if (( cycle >= NIGHTLY_MAX_CYCLES )); then
    break
  fi

  # Re-check stop hour before long sleep
  hour="$(date +%H)"
  if (( 10#$hour >= 10#$NIGHTLY_STOP_HOUR )); then
    admin_log "nightly STOP before sleep hour=$hour"
    break
  fi

  sleep_sec="$(admin_next_sleep_seconds "$NIGHTLY_INTERVAL_SEC")"
  # Don't sleep past stop hour: clamp to seconds until stop_hour:00
  until_stop="$(admin_seconds_until_local_hhmm "$(printf '%02d:00' "$((10#$NIGHTLY_STOP_HOUR))")")"
  if (( sleep_sec > until_stop )); then
    sleep_sec=$until_stop
  fi
  if (( sleep_sec < 30 )); then
    admin_log "nightly near stop — no more sleep"
    break
  fi
  admin_log "sleep ${sleep_sec}s"
  was_rate_limited=0
  if [[ -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag" ]]; then
    was_rate_limited=1
  fi
  sleep "$sleep_sec"
  # After long backoff, allow Claude again
  if (( was_rate_limited == 1 && sleep_sec > NIGHTLY_INTERVAL_SEC )); then
    rm -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag"
    admin_log "cleared rate-limit flag after backoff sleep"
  fi
done

admin_cleanup_empty_worktrees || true

{
  echo "## Nightly finished"
  echo ""
  echo "- cycles: $cycle"
  echo "- $(admin_queue_summary)"
  echo "- overnight branches:"
  echo '```'
  admin_list_overnight_branches
  echo '```'
  echo "- report: \`$(admin_report_file)\`"
  echo "- restore: \`./scripts/admin-agent/restore-pre-sleep.sh\`"
} | admin_report_append

admin_log "nightly END"
echo "Morning: ./scripts/admin-agent/morning.sh"
