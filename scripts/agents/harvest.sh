#!/usr/bin/env bash
# Harvest Claude worktree → main, verify units, promote task.
#
# Usage:
#   ./scripts/agents/harvest.sh [slug]
#   ./scripts/agents/harvest.sh --no-verify 054-i18n-blur-overlay-sync
set -euo pipefail
# shellcheck source=lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
agents_load

NO_VERIFY=0
SLUG=""
for a in "$@"; do
  case "$a" in
    --no-verify) NO_VERIFY=1 ;;
    *) SLUG="$a" ;;
  esac
done

if [[ -z "$SLUG" && -f "$LOGS/claude.task" ]]; then
  SLUG=$(basename "$(cat "$LOGS/claude.task")" .md)
fi

agents_harvest_from_worktree "$SLUG"

# If RESULT exists with COMPLETE, move running task → done
if [[ -n "$SLUG" ]]; then
  if ls "$DONE"/*"${SLUG}"*RESULT* >/dev/null 2>&1; then
    if grep -q 'COMPLETE' "$DONE"/*"${SLUG}"*RESULT* 2>/dev/null; then
      if [[ -f "$RUNNING/${SLUG}.md" ]]; then
        mv "$RUNNING/${SLUG}.md" "$DONE/${SLUG}.md"
        echo "promoted running → done: $SLUG"
      fi
    fi
  fi
fi

if [[ "$NO_VERIFY" != "1" ]]; then
  echo "── verify: dev-smoke --unit ──"
  if bash "$ROOT/scripts/dev-smoke.sh" --unit; then
    echo "VERIFY=PASS"
  else
    echo "VERIFY=FAIL" >&2
    exit 1
  fi
fi

# Snapshot harvest log
at=$(date -u +%Y%m%dT%H%M%SZ)
echo "{\"at\":\"$at\",\"slug\":\"${SLUG:-}\",\"verify\":$([[ $NO_VERIFY == 1 ]] && echo null || echo true)}" \
  >>"$ROOT/artifacts/agents/harvest.jsonl"
echo "harvest complete slug=${SLUG:-}"
