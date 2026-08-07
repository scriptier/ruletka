#!/usr/bin/env bash
PIDFILE="$(cd "$(dirname "$0")" && pwd)/claude-logs/claude.pid"
if [[ -f "$PIDFILE" ]] && ps -p "$(cat "$PIDFILE")" >/dev/null 2>&1; then
  echo "RUNNING pid=$(cat "$PIDFILE")"
else
  echo "IDLE"
fi
ls -lt "$(dirname "$0")/claude-logs/"*.out 2>/dev/null | head -3
