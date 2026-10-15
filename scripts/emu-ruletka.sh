#!/usr/bin/env bash
# Launch the local ruletka Android emulator (not a Pixel substitute).
#
# Default AVD: ruletka_api34  (API 34, google_apis, host webcam as front cam)
# Play Store:  ruletka_api34_play  (created after sdkmanager playstore image)
#
# Usage:
#   ./scripts/emu-ruletka.sh              # boot default
#   ./scripts/emu-ruletka.sh --play        # Play Store AVD if present
#   ./scripts/emu-ruletka.sh --swift       # software GPU
#   ./scripts/emu-ruletka.sh --no-window   # headless
#   ./scripts/emu-ruletka.sh --kill        # stop all emulators
#
# Useful: Friends / Settings / deeplink / crash.
# Not useful: product.ok, SoftBlur, same-WiFi force_relay, real faces.
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

AVD="${AVD:-ruletka_api34}"
GPU="${EMU_GPU:-host}"
WINDOW=1

usage() { sed -n '2,16p' "$0" | sed 's/^# \?//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --play) AVD="ruletka_api34_play"; shift ;;
    --swift|--swiftshader) GPU="swiftshader_indirect"; shift ;;
    --no-window) WINDOW=0; shift ;;
    --kill)
      adb emu kill >/dev/null 2>&1 || true
      pkill -f 'qemu-system.*ruletka' >/dev/null 2>&1 || true
      echo "stopped"
      exit 0
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown: $1" >&2; usage; exit 2 ;;
  esac
done

if ! emulator -list-avds 2>/dev/null | grep -qx "$AVD"; then
  echo "FAIL: AVD '$AVD' not found. Have:" >&2
  emulator -list-avds >&2 || true
  exit 1
fi

if [[ ! -e /dev/kvm ]]; then
  echo "WARN: /dev/kvm missing — emulator will be very slow" >&2
elif ! python3 -c 'import os; os.close(os.open("/dev/kvm", os.O_RDWR))' 2>/dev/null; then
  echo "WARN: cannot open /dev/kvm (need ACL or: sudo usermod -aG kvm $USER)" >&2
fi

args=(-avd "$AVD" -gpu "$GPU" -no-snapshot-load)
# Keep host audio (old launch used -no-audio — bad for ruletka).
# Front cam is webcam0 in AVD config; do not force-none.
if [[ "$WINDOW" -eq 0 ]]; then
  args+=(-no-window)
fi

echo "starting AVD=$AVD gpu=$GPU"
emulator "${args[@]}" >/tmp/ruletka-emu.log 2>&1 &
echo "pid=$! log=/tmp/ruletka-emu.log"
echo "waiting for adb…"
adb wait-for-device
# Boot may take 30–90s
for i in $(seq 1 60); do
  boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  if [[ "$boot" == "1" ]]; then
    echo "boot complete"
    adb devices -l
    exit 0
  fi
  sleep 2
done
echo "WARN: adb up but boot_completed not 1 yet — see /tmp/ruletka-emu.log" >&2
adb devices -l
exit 1
