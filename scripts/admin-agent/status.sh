#!/usr/bin/env bash
# Human-facing status of the automation loop (v4.1).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
admin_load_config

echo "=== Ruletka admin agent status ==="
echo "ROOT=$ROOT"
echo "time: $(date '+%F %H:%M %Z')"
echo "$(admin_queue_summary)"
echo ""

if [[ -f "$ROOT/scripts/admin-agent/logs/last-snapshot-id.txt" ]]; then
  echo "Pre-sleep snapshot: $(cat "$ROOT/scripts/admin-agent/logs/last-snapshot-id.txt")"
  echo "  restore: ./scripts/admin-agent/restore-pre-sleep.sh"
fi

if [[ -f "$ROOT/scripts/admin-agent/logs/nightly.lock" ]]; then
  npid="$(cat "$ROOT/scripts/admin-agent/logs/nightly.lock" 2>/dev/null || true)"
  if [[ -n "$npid" ]] && kill -0 "$npid" 2>/dev/null; then
    echo "Nightly: RUNNING pid=$npid"
  else
    echo "Nightly: idle (stale lock)"
  fi
else
  echo "Nightly: idle"
fi

if [[ -f "$ROOT/scripts/admin-agent/logs/rate-limited.flag" ]]; then
  w="$(admin_seconds_until_local_hhmm "${CLAUDE_RESET_LOCAL}")"
  echo "Claude rate-limit: YES — backoff until ~${CLAUDE_RESET_LOCAL} (~${w}s)"
  if [[ -f "$ROOT/scripts/admin-agent/logs/claude-reset-at.env" ]]; then
    sed 's/^/  /' "$ROOT/scripts/admin-agent/logs/claude-reset-at.env"
  fi
else
  echo "Claude rate-limit flag: no"
fi
echo "Claude success count (toward judge): $(admin_claude_success_count_get) / ${GROK_JUDGE_EVERY_N_CLAUDE}"
echo "Grok: judge_every=${GROK_JUDGE_EVERY_N_CLAUDE} manager_on_limit=${ENABLE_GROK_DURING_RATE_LIMIT}"
for f in JUDGE-LATEST.md MANAGER-LATEST.md MORNING-BRIEF.md; do
  if [[ -f "$ROOT/tasks/admin-queue/reports/$f" ]]; then
    echo "  report: tasks/admin-queue/reports/$f ($(wc -l <"$ROOT/tasks/admin-queue/reports/$f") lines)"
  fi
done

echo ""
echo "Pending:"
find "$ROOT/tasks/admin-queue/pending" -maxdepth 1 -name '*.md' -printf '  %f\n' 2>/dev/null | sort || echo "  (none)"
echo ""
echo "Running:"
find "$ROOT/tasks/admin-queue/running" -maxdepth 1 -name '*.md' -printf '  %f\n' 2>/dev/null || echo "  (none)"
echo ""
echo "Recent done:"
find "$ROOT/tasks/admin-queue/done" -maxdepth 1 -name '*.md' -printf '  %f\n' 2>/dev/null | sort | tail -5 || echo "  (none)"
echo ""
echo "Failed:"
find "$ROOT/tasks/admin-queue/failed" -maxdepth 1 -name '*.md' -printf '  %f\n' 2>/dev/null | sort | tail -5 || echo "  (none)"
echo ""
echo "Blocked (needs human / deferred):"
find "$ROOT/tasks/admin-queue/blocked" -maxdepth 1 -name '*.md' -printf '  %f\n' 2>/dev/null | sort || echo "  (none)"
echo ""
if [[ -f "$ROOT/scripts/claude-logs/admin-claude.pid" ]]; then
  pid=$(cat "$ROOT/scripts/claude-logs/admin-claude.pid")
  if kill -0 "$pid" 2>/dev/null; then
    echo "Claude: RUNNING pid=$pid"
  else
    echo "Claude: idle (stale pid file)"
  fi
else
  echo "Claude: idle"
fi
echo ""
echo "Overnight branches / worktrees:"
admin_list_overnight_branches
echo ""
echo "Latest report:"
rf="$(admin_report_file)"
if [[ -f "$rf" ]]; then
  echo "  $rf ($(wc -l <"$rf") lines)"
  grep -E 'Verdict:|match_to_offer|Queue empty|Claude finished|rate-limit|Cycle start' "$rf" | tail -10 | sed 's/^/  /'
else
  echo "  (none for today)"
fi
echo ""
if [[ -f "$ROOT/scripts/admin-agent/logs/last-hub-metrics.env" ]]; then
  echo "Last hub metrics:"
  sed 's/^/  /' "$ROOT/scripts/admin-agent/logs/last-hub-metrics.env"
fi
echo ""
echo "Commands:"
echo "  ./scripts/admin-agent/run-once.sh --forensics-only"
echo "  ./scripts/admin-agent/run-once.sh"
echo "  ./scripts/admin-agent/run-once.sh --grok-manager   # re-rank queue"
echo "  ./scripts/admin-agent/run-once.sh --grok-judge     # judge admin/* branches"
echo "  ./scripts/admin-agent/run-once.sh --with-grok      # MORNING-BRIEF"
echo "  ./scripts/admin-agent/nightly.sh"
echo "  ./scripts/admin-agent/morning.sh"
echo "  ./scripts/admin-agent/snapshot-pre-sleep.sh"
echo "  ./scripts/admin-agent/restore-pre-sleep.sh"
echo "  ./scripts/admin-agent/enqueue.sh 030 short-slug <<'EOF' ... EOF"
