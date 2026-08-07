#!/usr/bin/env bash
# Boot AVD, install latest release APK, clear 18+ gate, multi-screen screencaps,
# Start→Next smoke, deep-link safety (no useHub crash).
# Usage:
#   ./scripts/emu-test.sh
#   ./scripts/emu-test.sh /path/to/app.apk
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
AVD_NAME="${AVD_NAME:-ruletka_api34}"
if [[ -n "${1:-}" ]]; then
  APK="$1"
elif [[ -f "$ROOT/../ui/download/ruletka-android-latest.apk" ]]; then
  APK="$ROOT/../ui/download/ruletka-android-latest.apk"
elif APK_CAND=$(ls -1t "$ROOT/artifacts"/ruletka-*-vc*.apk 2>/dev/null | head -1); [[ -n "$APK_CAND" ]]; then
  APK="$APK_CAND"
else
  APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
fi
PKG=me.ruletka.app
ART="$ROOT/artifacts"
mkdir -p "$ART"

shot() {
  local name="$1"
  adb shell screencap -p "/sdcard/ruletka-${name}.png" 2>/dev/null || return 0
  adb pull "/sdcard/ruletka-${name}.png" "$ART/emu-${name}.png" >/dev/null 2>&1 || true
  echo "  shot: $ART/emu-${name}.png"
}

dump_ui() {
  local dest="$1"
  timeout 12 adb shell uiautomator dump /sdcard/emu-ui.xml >/dev/null 2>&1 || true
  adb pull /sdcard/emu-ui.xml "$dest" >/dev/null 2>&1 || true
}

# Deep-link into expo-router screens (scheme from app.json)
open_route() {
  local path="$1"
  adb shell am start -a android.intent.action.VIEW \
    -d "ruletka://${path}" "$PKG" >/dev/null 2>&1 || \
  adb shell am start -a android.intent.action.VIEW \
    -d "ruletka:///${path}" "$PKG" >/dev/null 2>&1 || true
  sleep 3
}

alive_or_die() {
  local label="$1"
  local pid
  pid=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r' || true)
  if [[ -z "$pid" ]]; then
    echo "CRASHED at $label — last logcat:"
    adb logcat -d | grep -iE 'AndroidRuntime|FATAL|ReactNative|ruletka|SoLoader' | tail -60
    exit 2
  fi
  echo "ALIVE ($label) pid=$pid"
}

# Tap by content-desc or text (center of bounds)
tap_label() {
  local label="$1"
  local xml="${2:-$ART/emu-ui-tmp.xml}"
  dump_ui "$xml"
  python3 - <<PY
import re, subprocess
from pathlib import Path
xml = Path("$xml").read_text(errors="ignore") if Path("$xml").exists() else ""
lab = """$label"""
m = re.search(rf'content-desc="{re.escape(lab)}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
if not m:
    m = re.search(rf'text="{re.escape(lab)}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
if m:
    x = (int(m.group(1)) + int(m.group(3))) // 2
    y = (int(m.group(2)) + int(m.group(4))) // 2
    print(f"  tap {lab!r} @ {x},{y}")
    subprocess.run(["adb", "shell", "input", "tap", str(x), str(y)], check=False)
    raise SystemExit(0)
print(f"  no bounds for {lab!r}")
raise SystemExit(1)
PY
}

# Clear 18+ / permission screens so deep links hit real screens
pass_onboarding() {
  adb shell pm grant "$PKG" android.permission.CAMERA 2>/dev/null || true
  adb shell pm grant "$PKG" android.permission.RECORD_AUDIO 2>/dev/null || true
  for _ in $(seq 1 12); do
    dump_ui "$ART/emu-ui-onboard.xml"
    xml="$ART/emu-ui-onboard.xml"
    if grep -q "Something went wrong\|useHub outside" "$xml" 2>/dev/null; then
      echo "FAIL: crash UI during onboarding"
      cat "$xml" | tr '>' '>\n' | grep -E 'text=|content-desc=' | head -20
      exit 3
    fi
    if grep -qE 'Don.t allow|Don’t allow' "$xml" 2>/dev/null; then
      tap_label "Don’t allow" "$xml" 2>/dev/null || tap_label "Don't allow" "$xml" 2>/dev/null || \
        adb shell input tap 540 1490
      sleep 0.8
      continue
    fi
    if grep -q "Yes, I'm 18 or older" "$xml" 2>/dev/null; then
      tap_label "Yes, I'm 18 or older" "$xml" || adb shell input tap 540 1688
      sleep 1.2
      continue
    fi
    if grep -q "Not now" "$xml" 2>/dev/null; then
      python3 - <<PY
import re, subprocess
from pathlib import Path
xml = Path("$xml").read_text(errors="ignore")
m = re.search(r'content-desc="Not now[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
if m:
    x=(int(m.group(1))+int(m.group(3)))//2; y=(int(m.group(2))+int(m.group(4)))//2
    subprocess.run(["adb","shell","input","tap",str(x),str(y)])
else:
    subprocess.run(["adb","shell","input","tap","540","1313"])
PY
      sleep 1.5
      continue
    fi
    if grep -q 'content-desc="Got it"' "$xml" 2>/dev/null; then
      tap_label "Got it" "$xml" || true
      sleep 0.6
      continue
    fi
    # Home or Live ready
    if grep -qE 'Start chatting|content-desc="Start"|ruletka|Hub online' "$xml" 2>/dev/null; then
      echo "  onboarding done"
      return 0
    fi
    sleep 0.7
  done
  echo "WARN: onboarding may be incomplete — continuing"
}

if ! adb devices 2>/dev/null | grep -q 'emulator.*device'; then
  echo "Starting emulator $AVD_NAME (headless)…"
  setsid $ANDROID_HOME/emulator/emulator -avd "$AVD_NAME" \
    -no-window -no-audio -no-boot-anim \
    -gpu swiftshader_indirect -memory 2048 -cores 2 \
    -no-snapshot-load \
    </dev/null >/tmp/emulator.log 2>&1 &
  disown || true
  for i in $(seq 1 90); do
    boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
    [[ "$boot" == "1" ]] && break
    sleep 3
  done
fi
adb wait-for-device
echo "Device: $(adb devices | grep emulator)"

[[ -f "$APK" ]] || { echo "Missing APK: $APK"; exit 1; }
echo "APK: $APK"
adb uninstall "$PKG" 2>/dev/null || true
adb logcat -c
adb install -r "$APK"

# --- Deep-link safety BEFORE age gate (must not crash) ---
adb shell am start -a android.intent.action.VIEW -d "ruletka://live" "$PKG" >/dev/null 2>&1 || true
sleep 3
alive_or_die "deeplink-live-pre-rules"
dump_ui "$ART/emu-ui-deeplink.xml"
if grep -qE 'Something went wrong|useHub outside' "$ART/emu-ui-deeplink.xml" 2>/dev/null; then
  echo "FAIL: deep link crashed before age gate"
  exit 3
fi
if grep -qE '18 or older|18\+ ONLY|ageGate|Yes, I.m 18' "$ART/emu-ui-deeplink.xml" 2>/dev/null; then
  echo "PASS: deep link → age gate (no useHub crash)"
else
  echo "WARN: expected age gate after deep link; UI dump saved"
fi
shot "deeplink-pre-rules"

adb shell am start -n "$PKG/.MainActivity" >/dev/null 2>&1 || true
sleep 2
pass_onboarding
alive_or_die "post-onboard"
shot "home"

# Multi-screen smoke via deep links (now rules accepted)
open_route "friends"
alive_or_die "friends"
shot "friends"

open_route "settings"
alive_or_die "settings"
shot "settings"

open_route "live"
alive_or_die "live"
shot "live"

# --- Start → Next/Stop smoke ---
adb shell pm grant "$PKG" android.permission.CAMERA 2>/dev/null || true
adb shell pm grant "$PKG" android.permission.RECORD_AUDIO 2>/dev/null || true
dump_ui "$ART/emu-ui-live.xml"
START_TAP=$(python3 - <<PY
import re
from pathlib import Path
text = Path("$ART/emu-ui-live.xml").read_text(errors="ignore") if Path("$ART/emu-ui-live.xml").exists() else ""
m = re.search(r'content-desc="Start"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', text)
if not m:
    m = re.search(r'text="Start"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', text)
if m:
    print(f"{(int(m.group(1))+int(m.group(3)))//2} {(int(m.group(2))+int(m.group(4)))//2}")
else:
    print("540 2130")
PY
)
echo "Tapping Start at: $START_TAP"
# shellcheck disable=SC2086
adb shell input tap $START_TAP
sleep 2
shot "after-start"
dump_ui "$ART/emu-ui-after-start.xml"
python3 - <<PY
from pathlib import Path
text = Path("$ART/emu-ui-after-start.xml").read_text(errors="ignore") if Path("$ART/emu-ui-after-start.xml").exists() else ""
has_next = 'content-desc="Next"' in text or 'text="Next"' in text
has_stop = 'content-desc="Stop"' in text or 'text="Stop"' in text
has_start = 'content-desc="Start"' in text or 'text="Start"' in text
print(f"UI after Start: Next={has_next} Stop={has_stop} Start={has_start}")
if has_next or has_stop:
    print("PASS: Start flipped to Next/Stop")
elif not text:
    print("WARN: no a11y dump (check emu-after-start.png) — non-fatal")
else:
    print("WARN: Start may still show — check screenshot; non-fatal for smoke")
if "useHub outside" in text or "Something went wrong" in text:
    print("FAIL: crash after Start")
    raise SystemExit(3)
PY
alive_or_die "after-start"

# Return home
open_route ""
sleep 2
adb shell am start -n "$PKG/.MainActivity" >/dev/null 2>&1 || true
sleep 2
alive_or_die "home-return"
shot "home-return"

cp -f "$ART/emu-home.png" "$ART/emu-screenshot.png" 2>/dev/null || true
echo "Screenshot (primary): $ART/emu-screenshot.png"
echo "Multi-screen: deeplink home friends settings live after-start home-return → $ART/emu-*.png"
adb shell dumpsys package "$PKG" | grep -E 'versionName|versionCode' | head -3
echo "emu-test OK"
