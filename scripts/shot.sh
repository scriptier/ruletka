#!/usr/bin/env bash
# Capture lab screenshots into gitignored artifacts/shots/.
#
#   ./scripts/shot.sh              # phone + PC display
#   ./scripts/shot.sh phone        # Pixel only
#   ./scripts/shot.sh pc           # DISPLAY=:0 only
#   ./scripts/shot.sh --label foo  # suffix
set -euo pipefail
export PATH="${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools:${PATH}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/artifacts/shots"
mkdir -p "$OUT"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LABEL=""
WHAT="both"

while [[ $# -gt 0 ]]; do
  case "$1" in
    phone|pc|both) WHAT="$1"; shift ;;
    --label|-l) LABEL="-${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "unknown: $1" >&2; exit 2 ;;
  esac
done

serial() {
  adb devices | awk '/device$/{print $1}' | grep -v emulator | head -1
}

shot_phone() {
  local s png
  s="$(serial)"
  [[ -n "$s" ]] || { echo "FAIL: no physical adb device" >&2; return 1; }
  png="$OUT/${TS}${LABEL}-phone.png"
  adb -s "$s" exec-out screencap -p >"$png"
  echo "phone $png ($(wc -c <"$png") bytes) serial=$s"
}

shot_pc() {
  local png="${OUT}/${TS}${LABEL}-pc.png"
  export DISPLAY="${DISPLAY:-:0}"
  if command -v gnome-screenshot >/dev/null; then
    gnome-screenshot -f "$png" >/dev/null 2>&1
  elif command -v grim >/dev/null; then
    grim "$png"
  elif command -v ffmpeg >/dev/null; then
    ffmpeg -y -f x11grab -video_size "$(xdpyinfo | awk '/dimensions/{print $2}')" \
      -i "${DISPLAY}.0" -frames:v 1 -update 1 "$png" >/dev/null 2>&1
  else
    echo "FAIL: no gnome-screenshot/grim/ffmpeg" >&2
    return 1
  fi
  echo "pc    $png ($(wc -c <"$png") bytes) DISPLAY=$DISPLAY"
}

case "$WHAT" in
  phone) shot_phone ;;
  pc) shot_pc ;;
  both) shot_phone; shot_pc ;;
esac
echo "dir $OUT"
