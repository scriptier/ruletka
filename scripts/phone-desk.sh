#!/usr/bin/env bash
# Phone desk — treat a plugged Pixel as a lab bench (plan A+D).
# Refuses SoftBlur / unlock spam if keyguard. Does not install APK.
#
# Usage:
#   ./scripts/phone-desk.sh status
#   ./scripts/phone-desk.sh stay          # keep screen on while USB
#   ./scripts/phone-desk.sh guard         # exit 2 if keyguard (callers must stop)
#   ./scripts/phone-desk.sh logcat        # follow [media]|[match]|startCall|answer_
#   ./scripts/phone-desk.sh dump          # write artifacts/phone-desk/status.txt
#
# Env: SERIAL / ANDROID_SERIAL, PHONE_MODEL_PREFER (default Pixel 9 Pro)
set -euo pipefail
export PATH="${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools:${PATH}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/artifacts/phone-desk"
PKG="${PKG:-me.ruletka.app}"
CMD="${1:-status}"

pick_serial() {
  if [[ -n "${SERIAL:-${ANDROID_SERIAL:-}}" ]]; then
    echo "${SERIAL:-$ANDROID_SERIAL}"
    return
  fi
  local prefer="${PHONE_MODEL_PREFER:-Pixel 9 Pro}"
  local line
  line=$(adb devices -l | awk -v p="$prefer" '
    /device usb:|device product:/{
      if ($0 ~ p) { print $1; found=1; exit }
      if (!first) first=$1
    }
    END { if (!found && first) print first }
  ')
  echo "$line"
}

SERIAL="$(pick_serial)"
if [[ -z "$SERIAL" ]]; then
  echo "phone-desk: FAIL — no physical adb device" >&2
  exit 1
fi

keyguard_on() {
  adb -s "$SERIAL" shell dumpsys window 2>/dev/null |
    grep -E 'isKeyguardShowing=true|mDreamingLockscreen=true' >/dev/null
}

status() {
  echo "serial=$SERIAL"
  adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r'
  echo -n "keyguard="
  if keyguard_on; then echo ON; else echo off; fi
  adb -s "$SERIAL" shell dumpsys battery 2>/dev/null | grep -E 'level:|USB powered' | sed 's/^ *//'
  echo -n "stay_on_while_plugged_in="
  adb -s "$SERIAL" shell settings get global stay_on_while_plugged_in | tr -d '\r'
  echo -n "ruletka="
  adb -s "$SERIAL" shell pidof "$PKG" | tr -d '\r' || echo not-running
  adb -s "$SERIAL" shell dumpsys package "$PKG" 2>/dev/null |
    grep -E 'versionName=|versionCode=' | head -2 | sed 's/^ *//'
}

case "$CMD" in
  status) status ;;
  stay)
    # 7 = USB+AC+wireless (bitmask). Device already had 15 (all). Keep ≥7.
    adb -s "$SERIAL" shell settings put global stay_on_while_plugged_in 7
    adb -s "$SERIAL" shell svc power stayon true >/dev/null 2>&1 || true
    echo "stay-awake set (USB). serial=$SERIAL"
    status
    ;;
  guard)
    if keyguard_on; then
      echo "phone-desk: BLOCKED keyguard serial=$SERIAL — no SoftBlur / unlock spam" >&2
      exit 2
    fi
    echo "phone-desk: keyguard off — ok"
    ;;
  dump)
    mkdir -p "$OUT"
    status | tee "$OUT/status.txt"
    adb -s "$SERIAL" shell dumpsys window 2>/dev/null |
      grep -E 'mCurrentFocus|isKeyguardShowing|mDreamingLockscreen' |
      tee -a "$OUT/status.txt" >/dev/null
    echo "wrote $OUT/status.txt"
    ;;
  logcat)
    mkdir -p "$OUT"
    echo "logcat → $OUT/logcat.follow (ctrl-c to stop)"
    adb -s "$SERIAL" logcat -v time \
      -s '*:S' ReactNativeJS:V ruletka:V \
      2>/dev/null |
      grep --line-buffered -E '\[media\]|\[match\]|startCall|answer_|force_relay|bind_answer|EARLY|CONNECT ' |
      tee "$OUT/logcat.follow"
    ;;
  *)
    echo "usage: $0 status|stay|guard|dump|logcat" >&2
    exit 2
    ;;
esac
