#!/usr/bin/env bash
# Overnight multi-cycle loop (v4). Grok review on last cycle only by default.
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

admin_log "nightly v4 START max=$NIGHTLY_MAX_CYCLES interval=${NIGHTLY_INTERVAL_SEC}s stop_hour=$NIGHTLY_STOP_HOUR ralph=$ENABLE_RALPH_RETRY commit=$ENABLE_AUTO_COMMIT"

cycle=0
while (( cycle < NIGHTLY_MAX_CYCLES )); do
  hour="$(date +%H)"
  if (( 10#$hour >= 10#$NIGHTLY_STOP_HOUR && 10#$hour < 12 )); then
    admin_log "nightly STOP hour=$hour"
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
  admin_log "sleep ${NIGHTLY_INTERVAL_SEC}s"
  sleep "$NIGHTLY_INTERVAL_SEC"
done

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
} | admin_report_append

admin_log "nightly END"
echo "Morning: ./scripts/admin-agent/morning.sh"
