#!/usr/bin/env bash
# Human-facing status of the automation loop.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
admin_load_config

echo "=== Ruletka admin agent status ==="
echo "ROOT=$ROOT"
echo "$(admin_queue_summary)"
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
echo "Latest report:"
rf="$(admin_report_file)"
if [[ -f "$rf" ]]; then
  echo "  $rf ($(wc -l <"$rf") lines)"
  # show verdict if present
  grep -E 'Verdict:|match_to_offer|Queue empty|Claude finished' "$rf" | tail -8 | sed 's/^/  /'
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
echo "  ./scripts/admin-agent/nightly.sh"
echo "  ./scripts/admin-agent/morning.sh"
echo "  ./scripts/admin-agent/enqueue.sh 030 short-slug <<'EOF' ... EOF"
