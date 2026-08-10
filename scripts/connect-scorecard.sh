#!/usr/bin/env bash
# Append one hub connect scorecard line (JSONL) + print a POLISH one-liner.
#
# Usage:
#   ./scripts/connect-scorecard.sh           # last 60 min
#   ./scripts/connect-scorecard.sh 30        # last 30 min
#   SCORECARD_PATH=... ./scripts/connect-scorecard.sh
#
# Depends on: hub-match-speed.sh (SSH hub journalctl).
# Exit: 0 on PASS/WARN/IDLE; 1 on FAIL (still appends).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MIN="${1:-60}"
SCORECARD_PATH="${SCORECARD_PATH:-$ROOT/artifacts/connect-scorecard.jsonl}"
mkdir -p "$(dirname "$SCORECARD_PATH")"

OUT="$("$ROOT/scripts/hub-match-speed.sh" "$MIN" 2>&1 || true)"
echo "$OUT"

verdict=$(echo "$OUT" | sed -n 's/^\*\*Verdict: \(.*\)\*\*/\1/p' | head -1)
verdict="${verdict:-UNKNOWN}"

# Parse markdown table rows from hub-match-speed: | offers | 3 |
cell() {
  local key="$1"
  echo "$OUT" | grep -iE "^\| ${key} \| [0-9]+ \|" | head -1 \
    | sed -E 's/.*\|[[:space:]]*([0-9]+)[[:space:]]*\|.*/\1/' || echo 0
}

matches=$(cell "matches")
offers=$(cell "offers")
answers=$(cell "answers")
android_slow=$(cell "android SLOW first-offers")
max_mto=$(cell "max match_to_offer_ms")
max_mta=$(cell "max match_to_answer_ms")
max_mti=$(cell "max match_to_ice_ms")

# Numeric sanitize
num() { echo "${1:-0}" | grep -oE '^[0-9]+$' || echo 0; }
matches=$(num "$matches")
offers=$(num "$offers")
answers=$(num "$answers")
android_slow=$(num "$android_slow")
max_mto=$(num "$max_mto")
max_mta=$(num "$max_mta")
max_mti=$(num "$max_mti")

at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
line=$(python3 -c "
import json
print(json.dumps({
  'v': 'hub-scorecard',
  'at': '$at',
  'window_min': int('$MIN'),
  'verdict': '''$verdict''',
  'matches': int('$matches'),
  'offers': int('$offers'),
  'answers': int('$answers'),
  'max_mto_ms': int('$max_mto'),
  'max_mta_ms': int('$max_mta'),
  'max_mti_ms': int('$max_mti'),
  'android_slow': int('$android_slow'),
}, separators=(',', ':')))
")
echo "$line" >>"$SCORECARD_PATH"

echo ""
echo "── Scorecard one-liner (paste into POLISH_NOW) ──"
echo "Hub ${MIN}m · $verdict · m=$matches o=$offers a=$answers max_mto=${max_mto}ms max_mta=${max_mta}ms android_slow=$android_slow · $at"
echo "Appended → $SCORECARD_PATH"

case "$verdict" in
  FAIL) exit 1 ;;
  *) exit 0 ;;
esac
