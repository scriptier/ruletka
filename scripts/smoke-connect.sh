#!/usr/bin/env bash
# Fast Play↔browser connect smoke helper.
#
# Usage:
#   ./scripts/smoke-connect.sh              # install APK if adb, then hub forensics
#   ./scripts/smoke-connect.sh --install    # force adb install latest APK
#   ./scripts/smoke-connect.sh --hub-only   # only hub-match-speed (after you smoke)
#   ./scripts/smoke-connect.sh --pair       # local web↔web pair-smoke (hard fail)
#   ./scripts/smoke-connect.sh --dev        # run scripts/dev-smoke.sh (unit+pair)
#   MIN=10 ./scripts/smoke-connect.sh
#
# Prefer before APK: ./scripts/dev-smoke.sh
#
# Budgets (override with env):
#   SLOW_OFFER_MS=2000  SLOW_ANSWER_MS=2000
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DO_INSTALL=0
HUB_ONLY=0
PAIR=0
DEV=0
for a in "$@"; do
  case "$a" in
    --install|-i) DO_INSTALL=1 ;;
    --hub-only) HUB_ONLY=1 ;;
    --pair) PAIR=1 ;;
    --dev) DEV=1 ;;
    -h|--help)
      sed -n '2,18p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

if [[ "$DEV" == "1" ]]; then
  exec bash "$ROOT/scripts/dev-smoke.sh"
fi

MIN="${MIN:-15}"
SLOW_OFFER_MS="${SLOW_OFFER_MS:-2000}"
SLOW_ANSWER_MS="${SLOW_ANSWER_MS:-2000}"
APK_LATEST="$ROOT/mobile/artifacts/ruletka-android-latest.apk"

echo "=== smoke-connect ==="
echo "APK:     $APK_LATEST"
if [[ -L "$APK_LATEST" || -f "$APK_LATEST" ]]; then
  ls -la "$APK_LATEST" 2>/dev/null || true
  if command -v readlink >/dev/null 2>&1; then
    echo "Target:  $(readlink -f "$APK_LATEST" 2>/dev/null || readlink "$APK_LATEST" 2>/dev/null || true)"
  fi
else
  echo "WARN: no latest APK — build with: cd mobile && ./scripts/build-apk-local.sh"
fi
echo ""

if [[ "$PAIR" == "1" ]]; then
  echo "--- local pair-smoke (web↔web, hard fail) ---"
  CHROME="${CHROME:-}"
  if [[ -z "$CHROME" ]]; then
    for c in /usr/bin/chromium /usr/bin/google-chrome /usr/bin/chromium-browser; do
      [[ -x "$c" ]] && CHROME="$c" && break
    done
  fi
  if [[ -z "$CHROME" ]]; then
    echo "SKIP pair-smoke: no Chrome"
  else
    # Hard fail — do not swallow exit codes (was || true, hid dual-offer)
    CHROME="$CHROME" PAIR_SMOKE_ATTEMPTS="${PAIR_SMOKE_ATTEMPTS:-5}" \
      PAIR_SMOKE_REMATCH="${PAIR_SMOKE_REMATCH:-1}" \
      node "$ROOT/scripts/pair-smoke.mjs"
  fi
  echo ""
fi

if [[ "$HUB_ONLY" != "1" ]]; then
  if command -v adb >/dev/null 2>&1; then
    devices="$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device"{print $1}')"
    if [[ -n "$devices" && -f "$APK_LATEST" ]]; then
      if [[ "$DO_INSTALL" == "1" ]] || [[ "${SMOKE_INSTALL:-0}" == "1" ]]; then
        echo "--- adb install ---"
        while read -r d; do
          [[ -z "$d" ]] && continue
          echo "install → $d"
          adb -s "$d" install -r "$APK_LATEST" || echo "WARN: install failed on $d"
        done <<<"$devices"
      else
        echo "adb device(s): $devices"
        echo "  (pass --install to sideload $APK_LATEST)"
      fi
    else
      echo "adb: no device or no APK (skip install)"
    fi
  else
    echo "adb: not in PATH (skip install)"
  fi
  echo ""
  echo "Manual smoke (do this once):"
  echo "  1. Settings on phone shows latest version (if just installed)"
  echo "  2. Hard-refresh https://ruletka.vip/live.html"
  echo "  3. Phone + browser Start ONCE — wait 15s — no Next spam"
  echo "  4. Re-run: ./scripts/smoke-connect.sh --hub-only"
  echo ""
fi

echo "--- hub forensics last ${MIN}m ---"
bash "$ROOT/scripts/hub-match-speed.sh" "$MIN" "$SLOW_OFFER_MS" || true

# Answer latency summary (hub field from 0.1.186+)
echo ""
echo "--- match_to_answer_ms (if present) ---"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
HOST="${HOST:-root@209.38.204.153}"
if [[ -f "$SSH_KEY" ]]; then
  ans_tmp="$(mktemp)"
  if ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o ConnectTimeout=12 -o BatchMode=yes \
    "$HOST" \
    "journalctl -u roulette-bridge --since '${MIN} min ago' --no-pager -o short-iso" \
    >"$ans_tmp" 2>/dev/null; then
    if grep -q 'match_to_answer_ms=' "$ans_tmp"; then
      max_mta=$(grep -oE 'match_to_answer_ms=[0-9]+' "$ans_tmp" | cut -d= -f2 | sort -n | tail -1)
      slow_mta=$(grep -oE 'match_to_answer_ms=[0-9]+' "$ans_tmp" | cut -d= -f2 \
        | awk -v lim="$SLOW_ANSWER_MS" '$1+0 > lim+0 {c++} END{print c+0}')
      echo "max match_to_answer_ms=$max_mta  slow(>$SLOW_ANSWER_MS)=${slow_mta}"
      grep -E 'first answer after match' "$ans_tmp" | tail -8 || true
      thrash=$(grep -c 'answerer first-path grace' "$ans_tmp" || true)
      android_slow=$(grep -c 'first offer after match SLOW.*platform=android' "$ans_tmp" || true)
      echo "answerer-offer drops (grace)=$thrash  android SLOW first-offers=$android_slow"
      if [[ "${android_slow:-0}" -gt 0 ]]; then
        echo "WARN: android still emitted SLOW offers (dual-offer thrash risk)"
      fi
    else
      echo "(no match_to_answer_ms in window — need a smoke after hub deploy)"
    fi
  else
    echo "hub SSH failed for answer summary"
  fi
  rm -f "$ans_tmp"
fi

echo ""
echo "Deploy stamp:"
curl -sS --max-time 6 https://ruletka.vip/deploy.json 2>/dev/null || echo "(curl failed)"
echo ""
echo "Done."
