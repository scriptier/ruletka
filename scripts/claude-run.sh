#!/usr/bin/env bash
# Backward-compatible wrapper → agents/dispatch.sh
# Usage: ./scripts/claude-run.sh path/to/task.md [--wait]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WAIT=()
TASK=""
for a in "$@"; do
  case "$a" in
    --wait|-w) WAIT=(--wait) ;;
    *) TASK="$a" ;;
  esac
done
if [[ -z "$TASK" ]]; then
  echo "Usage: $0 path/to/task.md [--wait]" >&2
  exit 1
fi
exec bash "$ROOT/scripts/agents/dispatch.sh" "${WAIT[@]}" "$TASK"
