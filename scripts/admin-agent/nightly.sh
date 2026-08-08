#!/usr/bin/env bash
# Overnight multi-cycle loop (v4.2). Claude build + Grok manage/judge + morning brief.
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

admin_log "nightly v4.2 START max=$NIGHTLY_MAX_CYCLES interval=${NIGHTLY_INTERVAL_SEC}s stop_hour=$NIGHTLY_STOP_HOUR judge_every=$GROK_JUDGE_EVERY_N_CLAUDE manager_on_limit=$ENABLE_GROK_DURING_RATE_LIMIT"

cycle=0
while (( cycle < NIGHTLY_MAX_CYCLES )); do
  hour="$(date +%H)"
  if (( 10#$hour >= 10#$NIGHTLY_STOP_HOUR )); then
    admin_log "nightly STOP hour=$hour (stop_hour=$NIGHTLY_STOP_HOUR)"
    break
  fi
  cycle=$((cycle + 1))
  admin_log "nightly cycle $cycle / $NIGHTLY_MAX_CYCLES"

  # Full MORNING-BRIEF only on last cycle (or if GROK_ONLY_LAST_CYCLE=0)
  # Mid-judge + manager still run inside run-once when due / rate-limited.
  if [[ "${GROK_ONLY_LAST_CYCLE}" == "1" && "$cycle" -lt "$NIGHTLY_MAX_CYCLES" ]]; then
    export ADMIN_SKIP_GROK=1
  else
    export ADMIN_SKIP_GROK=0
  fi

  if (( cycle == NIGHTLY_MAX_CYCLES )); then
    export ADMIN_SKIP_GROK=0
    "$SCRIPT_DIR/run-once.sh" --with-grok || admin_log "cycle $cycle errors"
  else
    "$SCRIPT_DIR/run-once.sh" || admin_log "cycle $cycle errors"
  fi

  if (( cycle >= NIGHTLY_MAX_CYCLES )); then
    break
  fi

  hour="$(date +%H)"
  if (( 10#$hour >= 10#$NIGHTLY_STOP_HOUR )); then
    admin_log "nightly STOP before sleep hour=$hour"
    break
  fi

  sleep_sec="$(admin_next_sleep_seconds "$NIGHTLY_INTERVAL_SEC")"
  until_stop="$(admin_seconds_until_local_hhmm "$(printf '%02d:00' "$((10#$NIGHTLY_STOP_HOUR))")")"
  if (( sleep_sec > until_stop )); then
    sleep_sec=$until_stop
  fi
  if (( sleep_sec < 30 )); then
    admin_log "nightly near stop — no more sleep"
    break
  fi

  # While rate-limited for a long backoff, still allow a mid-wait manager
  # if sleep is very long: split into chunks of max 90m and re-enter run-once manager-only
  if [[ -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag" && "$sleep_sec" -gt 5400 ]]; then
    admin_log "long rate-limit sleep ${sleep_sec}s — chunk with manager wakes"
    remaining=$sleep_sec
    chunk=5400
    while (( remaining > 60 )); do
      this=$chunk
      if (( this > remaining )); then this=$remaining; fi
      # leave last ~10m for final approach to reset
      if (( remaining - this < 600 && remaining > chunk )); then
        this=$(( remaining - 600 ))
      fi
      admin_log "rate-limit chunk sleep ${this}s (remaining~${remaining}s)"
      sleep "$this"
      remaining=$(( remaining - this ))
      hour="$(date +%H)"
      if (( 10#$hour >= 10#$NIGHTLY_STOP_HOUR )); then
        admin_log "STOP during rate-limit chunks"
        remaining=0
        break
      fi
      if (( remaining > 120 )); then
        # Manager-only wake (forensics + re-rank); still skip Claude if flag set
        admin_log "manager wake during rate-limit"
        "$SCRIPT_DIR/run-once.sh" --forensics-only || true
        admin_grok_manager_during_rate_limit || true
      fi
    done
    if (( remaining > 0 && remaining < 30 )); then
      sleep "$remaining" || true
    elif (( remaining >= 30 )); then
      sleep "$remaining" || true
    fi
    rm -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag"
    rm -f "$ROOT/scripts/admin-agent/logs/grok-manager-ran.flag"
    admin_log "cleared rate-limit flags after long backoff"
  else
    admin_log "sleep ${sleep_sec}s"
    was_rate_limited=0
    if [[ -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag" ]]; then
      was_rate_limited=1
    fi
    sleep "$sleep_sec"
    if (( was_rate_limited == 1 && sleep_sec > NIGHTLY_INTERVAL_SEC )); then
      rm -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag"
      rm -f "$ROOT/scripts/admin-agent/logs/grok-manager-ran.flag"
      admin_log "cleared rate-limit flags after backoff sleep"
    fi
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
  echo "- judge: \`tasks/admin-queue/reports/JUDGE-LATEST.md\`"
  echo "- manager: \`tasks/admin-queue/reports/MANAGER-LATEST.md\`"
  echo "- restore: \`./scripts/admin-agent/restore-pre-sleep.sh\`"
} | admin_report_append

admin_log "nightly END"
echo "Morning: ./scripts/admin-agent/morning.sh"
