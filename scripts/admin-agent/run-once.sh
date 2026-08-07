#!/usr/bin/env bash
# One admin-agent cycle (v4): reap → forensics → alert → auto-queue → Claude → verify → Ralph retry → auto-commit → Grok.
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

admin_log "=== admin cycle v4 start ==="

{
  echo "## Cycle start (v4)"
  echo ""
  echo "- host: $(hostname)"
  echo "- claude=$ENABLE_CLAUDE grok=$ENABLE_GROK branch_iso=$ENABLE_BRANCH_ISOLATION verify=$ENABLE_VERIFY"
  echo "- ralph=$ENABLE_RALPH_RETRY max_attempts=$RALPH_MAX_ATTEMPTS auto_commit=$ENABLE_AUTO_COMMIT"
  echo "- $(admin_queue_summary)"
} | admin_report_append

if ! admin_reap_stale_claude; then
  CLAUDE_BUSY=1
else
  CLAUDE_BUSY=0
fi

admin_hub_forensics | admin_report_append
admin_alert_if_red || true
admin_auto_enqueue || true

if [[ "$FORENSICS_ONLY" == "1" ]]; then
  admin_git_snapshot | admin_report_append
  admin_log "forensics-only exit"
  exit 0
fi

if [[ "$ENABLE_CLAUDE" == "1" && "$CLAUDE_BUSY" == "0" ]]; then
  n=0
  while (( n < MAX_TASKS_PER_CYCLE )); do
    task="$(admin_pick_pending_task)"
    [[ -z "$task" ]] && break
    admin_run_claude_task "$task" || true
    n=$((n + 1))
  done
  if (( n == 0 )); then
    {
      echo "## Queue empty"
      echo ""
      echo "No pending tasks. Auto-enqueue only fires on RED/YELLOW hub metrics."
    } | admin_report_append
  fi
elif [[ "$CLAUDE_BUSY" == "1" ]]; then
  echo "## Claude skipped (busy)" | admin_report_append
fi

# Grok: always if --with-grok; else if ENABLE_GROK and not restricted by nightly
if [[ "$FORCE_GROK" == "1" || ( "$ENABLE_GROK" == "1" && "${ADMIN_SKIP_GROK:-0}" != "1" ) ]]; then
  admin_optional_grok || true
fi

admin_git_snapshot | admin_report_append
admin_log "=== cycle end === $(admin_queue_summary)"
echo "Report: $(admin_report_file)"
echo "$(admin_queue_summary)"
