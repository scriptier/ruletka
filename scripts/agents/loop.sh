#!/usr/bin/env bash
# Drain pending queue: dispatch --wait each task (Claude workhorse).
#
# Usage:
#   ./scripts/agents/loop.sh           # all pending (max 5)
#   ./scripts/agents/loop.sh 3         # at most 3 tasks
#   MAX_TASKS=10 ./scripts/agents/loop.sh
set -euo pipefail
# shellcheck source=lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
agents_load

MAX="${1:-${MAX_TASKS:-5}}"
n=0
ok=0
fail=0

echo "=== agent loop max=$MAX ==="
while (( n < MAX )); do
  next=$(ls -1 "$PENDING"/*.md 2>/dev/null | sort | head -1 || true)
  if [[ -z "${next:-}" ]]; then
    echo "queue empty after $n task(s)"
    break
  fi
  n=$((n + 1))
  echo ""
  echo "══════════════════════════════════════"
  echo "▶ [$n/$MAX] $(basename "$next")"
  echo "══════════════════════════════════════"
  if bash "$AGENTS/dispatch.sh" --wait "$next"; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1))
    echo "task failed — continuing queue" >&2
  fi
done

echo ""
echo "=== loop done: ran=$n ok=$ok fail=$fail ==="
echo "status: ./scripts/agents/status.sh"
(( fail == 0 ))
