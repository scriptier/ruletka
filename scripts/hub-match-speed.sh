#!/usr/bin/env bash
# Grep production hub for match→offer latency (read-only) + pass/fail summary.
# Usage: ./scripts/hub-match-speed.sh [minutes] [slow_ms]
#
# Exit: 0 always (ops helper). Prints PASS/FAIL for human/admin-agent.
set -euo pipefail
MIN="${1:-30}"
SLOW_MS="${2:-${SLOW_OFFER_MS:-2000}}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
HOST="${HOST:-root@209.38.204.153}"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "FAIL: no SSH key at $SSH_KEY"
  exit 0
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

if ! ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o ConnectTimeout=12 -o BatchMode=yes \
  "$HOST" \
  "journalctl -u roulette-bridge --since '${MIN} min ago' --no-pager -o short-iso" \
  >"$tmp" 2>/dev/null; then
  echo "FAIL: hub SSH failed"
  exit 0
fi

matches=$(grep -c 'solo matched' "$tmp" || true)
offers=$(grep -c 'kind=offer' "$tmp" || true)
answers=$(grep -c 'kind=answer' "$tmp" || true)
drops=$(grep -c 'offer dropped' "$tmp" || true)

max_mto=0
slow=0
mto_source="none"
if grep -q 'match_to_offer_ms' "$tmp"; then
  mto_source="hub field"
  max_mto=$(
    grep -oE 'match_to_offer_ms=[0-9]+' "$tmp" \
      | cut -d= -f2 \
      | sort -n \
      | tail -1 || echo 0
  )
  slow=$(
    grep -oE 'match_to_offer_ms=[0-9]+' "$tmp" \
      | cut -d= -f2 \
      | awk -v lim="$SLOW_MS" '$1+0 > lim+0 {c++} END{print c+0}'
  )
else
  # Fallback: rough MTO from ISO timestamps of "solo matched" → next "kind=offer"
  # (journalctl short-iso first field). Not perfect across restarts but useful.
  mto_source="timestamp delta"
  read -r max_mto slow <<EOF
$(awk -v lim="$SLOW_MS" '
  /solo matched/ {
    # short-iso: 2026-08-07T08:51:40+00:00
    ts=$1
    gsub(/T/," ",ts); sub(/\+.*/,"",ts); sub(/Z/,"",ts)
    cmd="date -d \"" ts "\" +%s 2>/dev/null"
    cmd | getline t; close(cmd)
    if (t+0>0) last_match=t+0
  }
  /kind=offer/ && last_match>0 {
    ts=$1
    gsub(/T/," ",ts); sub(/\+.*/,"",ts); sub(/Z/,"",ts)
    cmd="date -d \"" ts "\" +%s 2>/dev/null"
    cmd | getline t; close(cmd)
    if (t+0>0) {
      d=(t-last_match)*1000
      if (d>=0 && d<120000) {
        if (d>max) max=d
        if (d>lim) slow++
      }
      last_match=0
    }
  }
  END { print max+0, slow+0 }
' "$tmp")
EOF
fi

echo "=== hub-match-speed last ${MIN}m (threshold match_to_offer_ms < ${SLOW_MS}) ==="
echo ""
echo "Recent signal lines:"
grep -E 'solo matched|first offer after match|kind=offer|kind=answer|offer dropped|match_to_offer|platform_' "$tmp" \
  | tail -40 || echo "(none)"
echo ""
echo "| metric | count |"
echo "|--------|------:|"
echo "| matches | $matches |"
echo "| offers | $offers |"
echo "| answers | $answers |"
echo "| offer drops | $drops |"
echo "| slow offers (>${SLOW_MS}ms) | $slow |"
echo "| max match_to_offer_ms | $max_mto |"
echo "| mto source | $mto_source |"
echo ""

verdict="PASS"
reasons=()

if (( matches == 0 )); then
  verdict="IDLE"
  reasons+=("no matches in window — smoke a Play↔PC pair first")
elif (( offers == 0 && matches > 0 )); then
  verdict="FAIL"
  reasons+=("matches without offers (startCall / kickSolo / offerer)")
elif (( offers > 0 && answers == 0 )); then
  verdict="FAIL"
  reasons+=("offers without answers")
elif (( slow > 0 || max_mto > SLOW_MS )); then
  verdict="FAIL"
  reasons+=("match_to_offer_ms over budget (max=${max_mto})")
elif (( drops > offers && offers > 0 )); then
  verdict="WARN"
  reasons+=("offer drops exceed offers (debounce thrash?)")
elif (( offers != answers && offers > 0 )); then
  verdict="WARN"
  reasons+=("offers ($offers) != answers ($answers) — expect 1:1 per successful match")
else
  reasons+=("offers≈answers, no slow flag")
fi

echo "**Verdict: $verdict**"
for r in "${reasons[@]}"; do
  echo "- $r"
done
echo ""
echo "Assert after manual Play↔PC smoke:"
echo "  • Exactly 1 offer + 1 answer per successful match"
echo "  • match_to_offer_ms < ${SLOW_MS}"
echo "  • No Next spam for 15s after match"
echo ""
echo "Also: ./scripts/admin-agent/run-once.sh --forensics-only"
