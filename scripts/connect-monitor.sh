#!/usr/bin/env bash
# Live connect forensics while you smoke Play↔browser.
#
# Watches hub (SDP timing + relay_candidates) and coturn (ALLOCATE / peer_usage)
# over SSH and refreshes a single scorecard.
#
# Usage:
#   ./scripts/connect-monitor.sh              # live every 5s, last 15 min
#   ./scripts/connect-monitor.sh --once       # one snapshot then exit
#   ./scripts/connect-monitor.sh --watch 3    # refresh every 3s
#   MIN=30 ./scripts/connect-monitor.sh
#   ./scripts/connect-monitor.sh --log        # also append JSONL to artifacts/
#
# Env:
#   HOST          root@209.38.204.153
#   SSH_KEY       ~/.ssh/ruletka_ed25519
#   MIN           lookback minutes (default 15)
#   INTERVAL      seconds between refresh (default 5)
#
# Exit: 0 always (ops helper). Ctrl+C to stop.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MIN="${MIN:-15}"
INTERVAL="${INTERVAL:-5}"
ONCE=0
DO_LOG=0
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
HOST="${HOST:-root@209.38.204.153}"
LOG_DIR="$ROOT/artifacts/connect-monitor"
LOG_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=1; shift ;;
    --watch)
      INTERVAL="${2:-5}"
      shift 2
      ;;
    --log) DO_LOG=1; shift ;;
    -h|--help)
      sed -n '2,24p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$SSH_KEY" ]]; then
  echo "FAIL: no SSH key at $SSH_KEY"
  exit 1
fi

if [[ "$DO_LOG" == "1" ]]; then
  mkdir -p "$LOG_DIR"
  LOG_FILE="$LOG_DIR/$(date -u +%Y%m%dT%H%M%SZ).jsonl"
  echo "Logging → $LOG_FILE"
fi

SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o ConnectTimeout=12 -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new)

# shellcheck disable=SC2016
REMOTE_SCRIPT='
MIN="'"$MIN"'"
echo "===HUB==="
journalctl -u roulette-bridge --since "${MIN} min ago" --no-pager -o short-iso 2>/dev/null | \
  grep -E "solo matched|first offer after match|first answer after match|first ice after match|offer dropped|signal relay kind=" || true
echo "===TURN==="
journalctl -u coturn --since "${MIN} min ago" --no-pager -o short-iso 2>/dev/null | \
  grep -iE "ALLOCATE processed|CREATE_PERMISSION|peer usage|Channel bind|Forbidden IP|error 403" || true
echo "===HEALTH==="
curl -sS --max-time 3 http://127.0.0.1:8790/health 2>/dev/null || echo "{}"
'

c_red() { printf "\033[31m%s\033[0m" "$*"; }
c_yel() { printf "\033[33m%s\033[0m" "$*"; }
c_grn() { printf "\033[32m%s\033[0m" "$*"; }
c_dim() { printf "\033[2m%s\033[0m" "$*"; }
c_bold() { printf "\033[1m%s\033[0m" "$*"; }

snapshot() {
  local raw hub turn health
  raw="$("${SSH[@]}" "$HOST" "bash -s" <<<"$REMOTE_SCRIPT" 2>/dev/null || true)"
  if [[ -z "$raw" ]]; then
    echo "FAIL: SSH/journal empty"
    return 1
  fi

  hub=$(printf "%s\n" "$raw" | sed -n "/^===HUB===/,/^===TURN===/p" | sed "1d;\$d")
  turn=$(printf "%s\n" "$raw" | sed -n "/^===TURN===/,/^===HEALTH===/p" | sed "1d;\$d")
  health=$(printf "%s\n" "$raw" | sed -n "/^===HEALTH===/,\$p" | sed "1d")

  local matches offers answers drops grace
  matches=$(printf "%s\n" "$hub" | grep -c "solo matched" || true)
  offers=$(printf "%s\n" "$hub" | grep -c "first offer after match" || true)
  answers=$(printf "%s\n" "$hub" | grep -c "first answer after match" || true)
  drops=$(printf "%s\n" "$hub" | grep -c "offer dropped" || true)
  grace=$(printf "%s\n" "$hub" | grep -c "answerer first-path grace" || true)

  local max_mto max_mta max_mti
  max_mto=$(printf "%s\n" "$hub" | grep -oE "match_to_offer_ms=[0-9]+" | cut -d= -f2 | sort -n | tail -1 || echo 0)
  max_mta=$(printf "%s\n" "$hub" | grep -oE "match_to_answer_ms=[0-9]+" | cut -d= -f2 | sort -n | tail -1 || echo 0)
  max_mti=$(printf "%s\n" "$hub" | grep -oE "match_to_ice_ms=[0-9]+" | cut -d= -f2 | sort -n | tail -1 || echo 0)
  max_mto=${max_mto:-0}
  max_mta=${max_mta:-0}
  max_mti=${max_mti:-0}

  # relay_candidates on first offer/answer lines
  local web_relay0 phone_relay0 min_relay max_relay
  web_relay0=$(printf "%s\n" "$hub" | grep "first offer after match" | grep -c "relay_candidates=0" || true)
  phone_relay0=$(printf "%s\n" "$hub" | grep "first answer after match" | grep -c "relay_candidates=0" || true)
  min_relay=$(printf "%s\n" "$hub" | grep -oE "relay_candidates=[0-9]+" | cut -d= -f2 | sort -n | head -1 || echo "")
  max_relay=$(printf "%s\n" "$hub" | grep -oE "relay_candidates=[0-9]+" | cut -d= -f2 | sort -n | tail -1 || echo "")
  min_relay=${min_relay:-n/a}
  max_relay=${max_relay:-n/a}

  local alloc_ok perm_ok perm_403 peer_zero peer_hot
  alloc_ok=$(printf "%s\n" "$turn" | grep -c "ALLOCATE processed, success" || true)
  perm_ok=$(printf "%s\n" "$turn" | grep -c "CREATE_PERMISSION processed, success" || true)
  perm_403=$(printf "%s\n" "$turn" | grep -ciE "CREATE_PERMISSION.*403|Forbidden IP" || true)
  peer_zero=$(printf "%s\n" "$turn" | grep "peer usage" | grep -c "rp=0, rb=0" || true)
  peer_hot=$(printf "%s\n" "$turn" | grep "peer usage" | grep -vc "rp=0, rb=0" || true)

  # Online from health JSON
  local online waiting ui_deploy
  online=$(printf "%s" "$health" | python3 -c "import sys,json
try:
  h=json.load(sys.stdin); print(h.get('online','?'))
except Exception:
  print('?')" 2>/dev/null || echo "?")
  waiting=$(printf "%s" "$health" | python3 -c "import sys,json
try:
  h=json.load(sys.stdin); print(h.get('waiting','?'))
except Exception:
  print('?')" 2>/dev/null || echo "?")
  ui_deploy=$(printf "%s" "$health" | python3 -c "import sys,json
try:
  h=json.load(sys.stdin); print(h.get('ui_deploy','?'))
except Exception:
  print('?')" 2>/dev/null || echo "?")

  # Verdict
  local verdict="IDLE" reason="no matches in window"
  if [[ "$matches" -gt 0 ]]; then
    verdict="OK"
    reason="SDP path looks healthy"
    if [[ "$web_relay0" -gt 0 ]] || [[ "$phone_relay0" -gt 0 ]]; then
      verdict="RED"
      reason="relay_candidates=0 on offer/answer (media will black)"
    elif [[ "$matches" -gt 0 && "$peer_hot" -eq 0 && "$alloc_ok" -gt 0 ]]; then
      verdict="YELLOW"
      reason="TURN allocates but peer_usage still 0 (no media through coturn)"
    elif [[ "$grace" -gt 0 ]] || [[ "$drops" -gt 2 ]]; then
      verdict="YELLOW"
      reason="offer thrash / answerer re-offer drops"
    elif [[ "$max_mta" -gt 3000 ]] || [[ "$max_mto" -gt 2000 ]]; then
      verdict="YELLOW"
      reason="slow SDP (MTO/MTA over budget)"
    fi
  fi

  # Recent match lines (last 8 interesting)
  local recent
  recent=$(printf "%s\n" "$hub" | grep -E "solo matched|first offer after match|first answer after match|first ice after match|offer dropped" | tail -12 || true)

  # Clear + paint (live mode)
  if [[ "$ONCE" != "1" ]] && [[ -t 1 ]]; then
    printf "\033[H\033[2J"
  fi

  local now
  now=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
  echo "$(c_bold "ruletka connect-monitor")  $(c_dim "$now")  window=${MIN}m  refresh=${INTERVAL}s"
  echo "$(c_dim "host=$HOST  ui=$ui_deploy  online=$online waiting=$waiting")"
  echo

  # Verdict banner
  case "$verdict" in
    OK) echo "  $(c_grn "● $verdict")  $reason" ;;
    YELLOW) echo "  $(c_yel "● $verdict")  $reason" ;;
    RED) echo "  $(c_red "● $verdict")  $reason" ;;
    *) echo "  $(c_dim "● $verdict")  $reason" ;;
  esac
  echo

  printf "  %-14s %6s   %-14s %6s\n" "matches" "$matches" "offers" "$offers"
  printf "  %-14s %6s   %-14s %6s\n" "answers" "$answers" "offer drops" "$drops"
  printf "  %-14s %6s   %-14s %6s\n" "ans.grace drops" "$grace" "web relay=0" "$web_relay0"
  printf "  %-14s %6s   %-14s %6s\n" "phone relay=0" "$phone_relay0" "relay min/max" "${min_relay}/${max_relay}"
  echo
  printf "  %-14s %6sms  %-14s %6sms  %-14s %6sms\n" \
    "max MTO" "$max_mto" "max MTA" "$max_mta" "max MTI" "$max_mti"
  echo
  echo "$(c_bold "coturn (${MIN}m)")"
  printf "  %-14s %6s   %-14s %6s\n" "ALLOCATE ok" "$alloc_ok" "CREATE_PERM ok" "$perm_ok"
  printf "  %-14s %6s   %-14s %6s\n" "PERM 403" "$perm_403" "peer_usage=0" "$peer_zero"
  printf "  %-14s %6s\n" "peer_usage HOT" "$peer_hot"
  echo

  echo "$(c_bold "recent hub lines")"
  if [[ -z "$recent" ]]; then
    echo "  $(c_dim "(none — Start once on phone + browser)")"
  else
    printf "%s\n" "$recent" | while IFS= read -r line; do
      # Truncate long lines for TTY
      short=$(printf "%s" "$line" | sed 's/.*roulette-bridge\[[0-9]*\]: //' | cut -c1-140)
      if echo "$short" | grep -q "relay_candidates=0"; then
        echo "  $(c_red "$short")"
      elif echo "$short" | grep -q "SLOW\|offer dropped"; then
        echo "  $(c_yel "$short")"
      elif echo "$short" | grep -q "first offer\|first answer\|first ice\|solo matched"; then
        echo "  $(c_grn "$short")"
      else
        echo "  $short"
      fi
    done
  fi

  echo
  echo "$(c_dim "Hints: RED relay=0 → hard-refresh browser + install latest APK. YELLOW peer HOT=0 → media/TURN path. OK + still black → client paint.")"
  echo "$(c_dim "Also: ./scripts/hub-match-speed.sh  ·  ./scripts/smoke-connect.sh --hub-only  ·  ./scripts/dev-smoke.sh")"
  if [[ "$ONCE" != "1" ]]; then
    echo "$(c_dim "Ctrl+C to stop")"
  fi

  if [[ -n "$LOG_FILE" ]]; then
    python3 - "$LOG_FILE" <<'PY' || true
import json, sys, os, time
path = sys.argv[1]
# parent exports via env
row = {
  "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "matches": int(os.environ.get("CM_MATCHES", "0")),
  "offers": int(os.environ.get("CM_OFFERS", "0")),
  "answers": int(os.environ.get("CM_ANSWERS", "0")),
  "drops": int(os.environ.get("CM_DROPS", "0")),
  "grace": int(os.environ.get("CM_GRACE", "0")),
  "web_relay0": int(os.environ.get("CM_WEB0", "0")),
  "phone_relay0": int(os.environ.get("CM_PHONE0", "0")),
  "max_mto": int(os.environ.get("CM_MTO", "0")),
  "max_mta": int(os.environ.get("CM_MTA", "0")),
  "max_mti": int(os.environ.get("CM_MTI", "0")),
  "alloc_ok": int(os.environ.get("CM_ALLOC", "0")),
  "perm_ok": int(os.environ.get("CM_PERM", "0")),
  "perm_403": int(os.environ.get("CM_403", "0")),
  "peer_zero": int(os.environ.get("CM_P0", "0")),
  "peer_hot": int(os.environ.get("CM_PHOT", "0")),
  "verdict": os.environ.get("CM_VERDICT", "IDLE"),
  "reason": os.environ.get("CM_REASON", ""),
}
with open(path, "a") as f:
  f.write(json.dumps(row) + "\n")
PY
  fi

  # Export for logger (set after python would need env — set before next loop)
  export CM_MATCHES="$matches" CM_OFFERS="$offers" CM_ANSWERS="$answers"
  export CM_DROPS="$drops" CM_GRACE="$grace" CM_WEB0="$web_relay0" CM_PHONE0="$phone_relay0"
  export CM_MTO="$max_mto" CM_MTA="$max_mta" CM_MTI="$max_mti"
  export CM_ALLOC="$alloc_ok" CM_PERM="$perm_ok" CM_403="$perm_403"
  export CM_P0="$peer_zero" CM_PHOT="$peer_hot" CM_VERDICT="$verdict" CM_REASON="$reason"

  # Re-run logger after env set when --log
  if [[ -n "$LOG_FILE" ]]; then
    python3 -c "
import json, os, time
row = {
  'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
  'matches': int(os.environ.get('CM_MATCHES','0')),
  'offers': int(os.environ.get('CM_OFFERS','0')),
  'answers': int(os.environ.get('CM_ANSWERS','0')),
  'drops': int(os.environ.get('CM_DROPS','0')),
  'grace': int(os.environ.get('CM_GRACE','0')),
  'web_relay0': int(os.environ.get('CM_WEB0','0')),
  'phone_relay0': int(os.environ.get('CM_PHONE0','0')),
  'max_mto': int(os.environ.get('CM_MTO','0')),
  'max_mta': int(os.environ.get('CM_MTA','0')),
  'max_mti': int(os.environ.get('CM_MTI','0')),
  'alloc_ok': int(os.environ.get('CM_ALLOC','0')),
  'perm_ok': int(os.environ.get('CM_PERM','0')),
  'perm_403': int(os.environ.get('CM_403','0')),
  'peer_zero': int(os.environ.get('CM_P0','0')),
  'peer_hot': int(os.environ.get('CM_PHOT','0')),
  'verdict': os.environ.get('CM_VERDICT','IDLE'),
  'reason': os.environ.get('CM_REASON',''),
}
open('$LOG_FILE','a').write(json.dumps(row)+'\n')
" 2>/dev/null || true
  fi
}

if [[ "$ONCE" == "1" ]]; then
  snapshot
  exit 0
fi

trap 'echo; echo "stopped."; exit 0' INT TERM
while true; do
  snapshot || true
  sleep "$INTERVAL"
done
