#!/usr/bin/env bash
# Grep production hub for match→offer / answer latency + thrash (read-only).
# Usage: ./scripts/hub-match-speed.sh [minutes] [slow_offer_ms]
#
# Env:
#   SLOW_OFFER_MS=2000   SLOW_ANSWER_MS=2000
#   HOST  SSH_KEY
#
# Exit: 0 always (ops helper). Prints PASS/FAIL/WARN/IDLE for human/admin-agent.
set -euo pipefail
MIN="${1:-30}"
SLOW_MS="${2:-${SLOW_OFFER_MS:-2000}}"
SLOW_ANSWER_MS="${SLOW_ANSWER_MS:-2000}"
SLOW_ICE_MS="${SLOW_ICE_MS:-5000}"
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
grace=$(grep -c 'answerer first-path grace' "$tmp" || true)
android_slow=$(grep -cE 'first offer after match SLOW.*platform=android' "$tmp" || true)

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
  mto_source="timestamp delta"
  read -r max_mto slow <<EOF
$(awk -v lim="$SLOW_MS" '
  /solo matched/ {
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

max_mta=0
slow_mta=0
mta_source="none"
if grep -q 'match_to_answer_ms' "$tmp"; then
  mta_source="hub field"
  max_mta=$(
    grep -oE 'match_to_answer_ms=[0-9]+' "$tmp" \
      | cut -d= -f2 \
      | sort -n \
      | tail -1 || echo 0
  )
  slow_mta=$(
    grep -oE 'match_to_answer_ms=[0-9]+' "$tmp" \
      | cut -d= -f2 \
      | awk -v lim="$SLOW_ANSWER_MS" '$1+0 > lim+0 {c++} END{print c+0}'
  )
fi

max_mti=0
slow_mti=0
mti_source="none"
if grep -q 'match_to_ice_ms' "$tmp"; then
  mti_source="hub field"
  max_mti=$(
    grep -oE 'match_to_ice_ms=[0-9]+' "$tmp" \
      | cut -d= -f2 \
      | sort -n \
      | tail -1 || echo 0
  )
  slow_mti=$(
    grep -oE 'match_to_ice_ms=[0-9]+' "$tmp" \
      | cut -d= -f2 \
      | awk -v lim="$SLOW_ICE_MS" '$1+0 > lim+0 {c++} END{print c+0}'
  )
fi

echo "=== hub-match-speed last ${MIN}m (offer < ${SLOW_MS}ms · answer < ${SLOW_ANSWER_MS}ms · ice < ${SLOW_ICE_MS}ms) ==="
echo ""
echo "Recent signal lines:"
grep -E 'solo matched|first offer after match|first answer after match|first ice after match|kind=offer|kind=answer|offer dropped|match_to_offer|match_to_answer|match_to_ice|answerer first-path grace|platform_' "$tmp" \
  | tail -40 || echo "(none)"
echo ""
echo "| metric | count |"
echo "|--------|------:|"
echo "| matches | $matches |"
echo "| offers | $offers |"
echo "| answers | $answers |"
echo "| offer drops | $drops |"
echo "| answerer first-path grace drops | $grace |"
echo "| android SLOW first-offers | $android_slow |"
echo "| slow offers (>${SLOW_MS}ms) | $slow |"
echo "| max match_to_offer_ms | $max_mto |"
echo "| mto source | $mto_source |"
echo "| slow answers (>${SLOW_ANSWER_MS}ms) | $slow_mta |"
echo "| max match_to_answer_ms | $max_mta |"
echo "| mta source | $mta_source |"
echo "| slow ice (>${SLOW_ICE_MS}ms) | $slow_mti |"
echo "| max match_to_ice_ms | $max_mti |"
echo "| mti source | $mti_source |"
echo ""

verdict="PASS"
reasons=()

if (( matches == 0 )); then
  verdict="IDLE"
  reasons+=("no matches in window — smoke a Play↔PC pair first")
elif (( android_slow > 0 )); then
  verdict="FAIL"
  reasons+=("android SLOW first-offers=${android_slow} (dual-offer thrash risk)")
elif (( offers == 0 && matches > 0 )); then
  verdict="FAIL"
  reasons+=("matches without offers (startCall / kickSolo / offerer)")
elif (( offers > 0 && answers == 0 )); then
  verdict="FAIL"
  reasons+=("offers without answers")
elif (( slow > 0 || max_mto > SLOW_MS )); then
  verdict="FAIL"
  reasons+=("match_to_offer_ms over budget (max=${max_mto})")
elif (( slow_mta > 0 || (max_mta > 0 && max_mta > SLOW_ANSWER_MS) )); then
  verdict="WARN"
  reasons+=("match_to_answer_ms over budget (max=${max_mta})")
elif (( slow_mti > 0 || (max_mti > 0 && max_mti > SLOW_ICE_MS) )); then
  verdict="WARN"
  reasons+=("match_to_ice_ms over budget (max=${max_mti}) — TURN/media path lag")
elif (( drops > offers && offers > 0 )); then
  verdict="WARN"
  reasons+=("offer drops exceed offers (debounce thrash?)")
elif (( offers != answers && offers > 0 )); then
  verdict="WARN"
  reasons+=("offers ($offers) != answers ($answers) — expect 1:1 per successful match")
elif (( grace > 3 )); then
  verdict="WARN"
  reasons+=("many answerer first-path grace drops ($grace)")
else
  reasons+=("offers≈answers, no slow flag, no android SLOW offers")
fi

echo "**Verdict: $verdict**"
for r in "${reasons[@]}"; do
  echo "- $r"
done
echo ""
echo "Assert after manual Play↔PC smoke:"
echo "  • Exactly 1 offer + 1 answer per successful match"
echo "  • match_to_offer_ms < ${SLOW_MS}"
echo "  • match_to_answer_ms < ${SLOW_ANSWER_MS} (when field present)"
echo "  • match_to_ice_ms < ${SLOW_ICE_MS} (when field present — media path)"
echo "  • android SLOW first-offers = 0"
echo "  • No Next spam for 15s after match"
echo ""
echo "Also: ./scripts/dev-smoke.sh · ./scripts/smoke-connect.sh --hub-only"
