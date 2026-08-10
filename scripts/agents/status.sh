#!/usr/bin/env bash
# Dual-agent status: queue + Claude PID + recent logs.
set -euo pipefail
# shellcheck source=lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
agents_load

echo "=== Grok↔Claude agent status ==="
echo "ROOT=$ROOT"
echo "WT=$WT"
echo "CLAUDE_BIN=${CLAUDE_BIN:-missing}"
echo ""

echo "── Queue ──"
printf "pending: %s\n" "$(find "$PENDING" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)"
printf "running: %s\n" "$(find "$RUNNING" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)"
printf "done:    %s\n" "$(find "$DONE" -maxdepth 1 -name '*RESULT*' 2>/dev/null | wc -l)"
printf "failed:  %s\n" "$(find "$FAILED" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)"
echo ""
if ls "$PENDING"/*.md >/dev/null 2>&1; then
  echo "Pending:"
  ls -1 "$PENDING"/*.md | xargs -n1 basename
fi
if ls "$RUNNING"/*.md >/dev/null 2>&1; then
  echo "Running:"
  ls -1 "$RUNNING"/*.md | xargs -n1 basename
fi
echo ""

echo "── Continuous shift ──"
if [[ -f "$LOGS/continuous.lock" ]]; then
  cpid=$(cat "$LOGS/continuous.lock" 2>/dev/null || true)
  if [[ -n "${cpid:-}" ]] && kill -0 "$cpid" 2>/dev/null; then
    echo "RUNNING pid=$cpid"
    ps -p "$cpid" -o pid,etime,cmd 2>/dev/null || true
  else
    echo "lock stale (not running)"
  fi
else
  echo "not running — start: ./scripts/agents/start-sleep-shift.sh"
fi
if [[ -f "$LOGS/continuous.stop" ]]; then
  echo "STOP FLAG present"
fi
printf "backlog: %s\n" "$(find "$QUEUE/backlog" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)"
echo ""

echo "── Claude process ──"
if [[ -f "$LOGS/claude.pid" ]]; then
  pid=$(cat "$LOGS/claude.pid" 2>/dev/null || true)
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    ps -p "$pid" -o pid,etime,cmd
    echo "LOG=$(cat "$LOGS/claude.logpath" 2>/dev/null || echo '?')"
  else
    echo "no live Claude (stale pid file ok)"
  fi
else
  echo "no pid file"
fi
echo ""

echo "── Latest log tail ──"
latest=$(ls -t "$LOGS"/claude-*.out 2>/dev/null | head -1 || true)
if [[ -n "${latest:-}" ]]; then
  echo "$latest ($(wc -c <"$latest") bytes)"
  tail -20 "$latest" 2>/dev/null || true
else
  echo "(no logs)"
fi
