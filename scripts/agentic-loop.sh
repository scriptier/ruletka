#!/usr/bin/env bash
# agentic-loop — one-shot: preflight + measure/route (agentic engineering entry).
# Does not implement. Prints director next steps.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONNECT=1
MIN=10
WAIT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-connect) CONNECT=0; shift ;;
    --min) MIN="${2:-10}"; shift 2 ;;
    --wait) WAIT="${2:-90}"; shift 2 ;;
    -h|--help)
      echo "Usage: ./scripts/agentic-loop.sh [--min N] [--wait S] [--no-connect]"
      exit 0
      ;;
    *) echo "unknown: $1" >&2; exit 2 ;;
  esac
done

echo "======== 1/2 agentic-check ========"
if [[ "$CONNECT" == "1" ]]; then
  ./scripts/agentic-check.sh --connect || true
else
  ./scripts/agentic-check.sh || true
fi

echo
echo "======== 2/2 av-loop (measure + job cards) ========"
ARGS=(--min "$MIN")
[[ "$WAIT" -gt 0 ]] && ARGS+=(--wait "$WAIT")
set +e
./scripts/av-loop.sh "${ARGS[@]}"
RC=$?
set -e

echo
echo "======== director next ========"
if [[ -f artifacts/av-loop/director.md ]]; then
  head -40 artifacts/av-loop/director.md
fi
echo
echo "MODE: agentic"
echo "Exit from av-verify/av-loop: $RC"
echo "Spawn ONE writer from artifacts/av-loop/grok-job.md if NEXT_ROLE is implementer."
echo "Then: artifacts/av-loop/verify-after.md"
exit "$RC"
