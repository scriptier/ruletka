#!/usr/bin/env bash
# One admin-agent cycle (v4.1): reap → forensics → alert → auto-queue → Claude → verify → Ralph → commit → Grok.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
admin_load_config

FORENSICS_ONLY=0
FORCE_GROK=0
for arg in "$@"; do
  case "$arg" in
    --forensics-only) FORENSICS_ONLY=1 ;;
    --with-grok) FORCE_GROK=1 ;;
    -h|--help)
      echo "Usage: $0 [--forensics-only] [--with-grok]"
      exit 0
      ;;
  esac
done

CYCLE_LOCK="$ROOT/scripts/admin-agent/logs/cycle.lock"
if [[ -f "$CYCLE_LOCK" ]]; then
  old="$(cat "$CYCLE_LOCK" 2>/dev/null || true)"
  if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
    echo "cycle already running pid=$old" >&2
    exit 0
  fi
fi
echo $$ >"$CYCLE_LOCK"
trap 'rm -f "$CYCLE_LOCK"' EXIT

admin_log "=== admin cycle v4.1 start ==="
export ADMIN_CLAUDE_RATE_LIMITED=0

{
  echo "## Cycle start (v4.1)"
  echo ""
  echo "- host: $(hostname)"
  echo "- claude=$ENABLE_CLAUDE grok=$ENABLE_GROK branch_iso=$ENABLE_BRANCH_ISOLATION verify=$ENABLE_VERIFY"
  echo "- ralph=$ENABLE_RALPH_RETRY max_attempts=$RALPH_MAX_ATTEMPTS auto_commit=$ENABLE_AUTO_COMMIT"
  echo "- rate_backoff=$ENABLE_RATE_LIMIT_BACKOFF reset~${CLAUDE_RESET_LOCAL}"
  echo "- $(admin_queue_summary)"
} | admin_report_append

if ! admin_reap_stale_claude; then
  CLAUDE_BUSY=1
else
  CLAUDE_BUSY=0
fi

admin_cleanup_empty_worktrees || true

admin_hub_forensics | admin_report_append
admin_alert_if_red || true
admin_auto_enqueue || true

if [[ "$FORENSICS_ONLY" == "1" ]]; then
  admin_git_snapshot | admin_report_append
  admin_log "forensics-only exit"
  exit 0
fi

# If still rate-limited from prior cycle and before reset time, skip Claude entirely
if [[ -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag" && "${ENABLE_RATE_LIMIT_BACKOFF}" == "1" ]]; then
  wait_left="$(admin_seconds_until_local_hhmm "${CLAUDE_RESET_LOCAL}")"
  if (( wait_left > 120 )); then
    admin_log "skip Claude — rate-limit flag set, ~${wait_left}s until ${CLAUDE_RESET_LOCAL}"
    {
      echo "## Claude skipped (rate-limit backoff)"
      echo ""
      echo "- reset ~\`${CLAUDE_RESET_LOCAL}\` (~${wait_left}s)"
      echo "- queue preserved in pending"
    } | admin_report_append
    CLAUDE_BUSY=1
  else
    rm -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag"
    admin_log "rate-limit window elapsed — clearing flag"
  fi
fi

if [[ "$ENABLE_CLAUDE" == "1" && "$CLAUDE_BUSY" == "0" ]]; then
  n=0
  while (( n < MAX_TASKS_PER_CYCLE )); do
    if [[ -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag" || "${ADMIN_CLAUDE_RATE_LIMITED:-0}" == "1" ]]; then
      admin_log "Claude rate-limited — stop task loop this cycle"
      {
        echo "## Claude rate-limited"
        echo ""
        echo "Tasks left in pending. Nightly will backoff until ~${CLAUDE_RESET_LOCAL}."
      } | admin_report_append
      break
    fi
    task="$(admin_pick_pending_task)"
    [[ -z "$task" ]] && break
    admin_run_claude_task "$task" || true
    n=$((n + 1))
  done
  if (( n == 0 )) && [[ ! -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag" ]]; then
    {
      echo "## Queue empty"
      echo ""
      echo "No pending tasks. Auto-enqueue only fires on RED/YELLOW hub metrics."
    } | admin_report_append
  fi
elif [[ "$CLAUDE_BUSY" == "1" ]]; then
  echo "## Claude skipped (busy or backoff)" | admin_report_append
fi

# Grok: always if --with-grok; else if ENABLE_GROK and not restricted by nightly
if [[ "$FORCE_GROK" == "1" || ( "$ENABLE_GROK" == "1" && "${ADMIN_SKIP_GROK:-0}" != "1" ) ]]; then
  admin_optional_grok || true
fi

admin_git_snapshot | admin_report_append
admin_log "=== cycle end === $(admin_queue_summary)"
echo "Report: $(admin_report_file)"
echo "$(admin_queue_summary)"
