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

# ── Herd (additive; light note if CURRENT exists — keep light) ──
HERD_CUR="$ROOT/artifacts/herd/CURRENT"
if [[ -e "$HERD_CUR" ]]; then
  herd_run=""
  if [[ -L "$HERD_CUR" || -d "$HERD_CUR" ]]; then
    herd_run=$(cd "$HERD_CUR" 2>/dev/null && pwd || true)
  elif [[ -f "$HERD_CUR" ]]; then
    rid=$(tr -d '[:space:]' <"$HERD_CUR" 2>/dev/null || true)
    if [[ -n "$rid" ]]; then
      if [[ -d "$ROOT/artifacts/herd/$rid" ]]; then
        herd_run="$ROOT/artifacts/herd/$rid"
      elif [[ -d "$ROOT/artifacts/herd/runs/$rid" ]]; then
        herd_run="$ROOT/artifacts/herd/runs/$rid"
      fi
    fi
  fi
  if [[ -n "${herd_run:-}" && -d "${herd_run}/lanes" ]]; then
    herd_id=$(basename "$herd_run")
    echo "── herd CURRENT note: $herd_id ──"
    note_dir="$ROOT/artifacts/agents/herd-notes"
    mkdir -p "$note_dir"
    # Prefer machine lanes (*.json); also copy job-card REPORT (*.md) if present
    shopt -s nullglob
    for jf in "$herd_run/lanes"/*.json; do
      lid=$(basename "$jf" .json)
      # Extract light fields via python (no jq)
      st="?"
      goal_met="-"
      if eval_out=$(python3 - "$jf" <<'PY' 2>/dev/null
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    d = json.load(f)
st = d.get("status") or "?"
gm = d.get("goal_met") if d.get("goal_met") not in (None, "") else "-"
print(f"{st} {gm}")
PY
); then
        st=${eval_out%% *}
        goal_met=${eval_out#* }
      fi
      has_card=0
      card_yes=no
      if [[ -f "$herd_run/lanes/${lid}.md" ]]; then
        has_card=1
        card_yes=yes
        cp -a "$herd_run/lanes/${lid}.md" "$note_dir/${herd_id}-${lid}.md" 2>/dev/null || true
      fi
      echo "{\"at\":\"$at\",\"kind\":\"herd-lane\",\"run\":\"$herd_id\",\"lane\":\"$lid\",\"state\":\"${st}\",\"goal_met\":\"${goal_met}\",\"card\":$has_card,\"slug\":\"${SLUG:-}\"}" \
        >>"$ROOT/artifacts/agents/harvest.jsonl"
      printf "  herd lane=%s state=%s goal_met=%s card=%s\n" \
        "$lid" "$st" "$goal_met" "$card_yes"
    done
    # Cards without json (register-only layout)
    for md in "$herd_run/lanes"/*.md; do
      lid=$(basename "$md" .md)
      if [[ -f "$herd_run/lanes/${lid}.json" ]]; then
        continue
      fi
      cp -a "$md" "$note_dir/${herd_id}-${lid}.md" 2>/dev/null || true
      echo "{\"at\":\"$at\",\"kind\":\"herd-lane\",\"run\":\"$herd_id\",\"lane\":\"$lid\",\"state\":\"card-only\",\"goal_met\":\"\",\"card\":1,\"slug\":\"${SLUG:-}\"}" \
        >>"$ROOT/artifacts/agents/harvest.jsonl"
      printf "  herd lane=%s state=card-only card=yes\n" "$lid"
    done
    shopt -u nullglob
  fi
fi

echo "harvest complete slug=${SLUG:-}"
