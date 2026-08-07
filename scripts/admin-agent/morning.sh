#!/usr/bin/env bash
# Morning ritual after overnight admin agent.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
admin_load_config

echo "=============================================="
echo "  Ruletka morning brief — $(date '+%F %H:%M')"
echo "=============================================="
echo ""
if [[ -f "$ROOT/scripts/admin-agent/logs/last-snapshot-id.txt" ]]; then
  echo "Pre-sleep snapshot: $(cat "$ROOT/scripts/admin-agent/logs/last-snapshot-id.txt")"
  echo "  Restore if overnight went bad:"
  echo "    ./scripts/admin-agent/restore-pre-sleep.sh"
  echo "  Plan: docs/OVERNIGHT_8H_PLAY_PLAN.md"
  echo ""
fi
"$SCRIPT_DIR/status.sh"
echo ""
echo "Overnight branches / worktrees:"
admin_list_overnight_branches
echo ""

rf="$(admin_report_file)"
if [[ -f "$rf" ]]; then
  echo "-------- report verdicts / claude --------"
  grep -E 'Verdict:|Claude finished|RED alert|branch:|worktree:|PASS|FAIL' "$rf" | tail -40 || true
  echo "------------------------------------------"
fi

if [[ -f "$ROOT/tasks/admin-queue/reports/MORNING-BRIEF.md" ]]; then
  echo ""
  echo "======== Grok MORNING-BRIEF ========"
  cat "$ROOT/tasks/admin-queue/reports/MORNING-BRIEF.md"
  echo "===================================="
elif [[ "${ENABLE_GROK}" == "1" ]]; then
  echo ""
  echo "(No MORNING-BRIEF yet — run: ./scripts/admin-agent/run-once.sh --with-grok)"
fi

if [[ -f "$ROOT/tasks/admin-queue/reports/JUDGE-LATEST.md" ]]; then
  echo ""
  echo "-------- Grok mid-night JUDGE (summary) --------"
  head -40 "$ROOT/tasks/admin-queue/reports/JUDGE-LATEST.md"
  echo "-----------------------------------------------"
fi
if [[ -f "$ROOT/tasks/admin-queue/reports/MANAGER-LATEST.md" ]]; then
  echo ""
  echo "-------- Grok MANAGER (queue re-rank) --------"
  head -40 "$ROOT/tasks/admin-queue/reports/MANAGER-LATEST.md"
  echo "---------------------------------------------"
fi

if ls "$ROOT/scripts/admin-agent/logs/alerts/RED-"* >/dev/null 2>&1; then
  echo ""
  echo "!!!!!!!! RED ALERTS PRESENT !!!!!!!!"
  ls -la "$ROOT/scripts/admin-agent/logs/alerts/RED-"*
fi

echo ""
echo "Suggested next:"
echo "  1) less $rf"
echo "  2) Review branches: git branch --list 'admin/*'"
echo "  3) For each worktree: git -C .admin-worktrees/<dir> log --oneline -5 && git -C .admin-worktrees/<dir> diff main --stat"
echo "  4) ./scripts/hub-match-speed.sh 60"
echo "  5) Smoke Play↔PC (APK + hard-refresh)"
echo "  6) Merge good admin/* only after smoke (agent never pushes)"
echo "  7) Deploy only if GREEN and you tested"
echo ""
echo "Docs: docs/AGENT_FACTORY.md  CLAUDE.md  docs/CONNECTIVITY_LOCK.md"
