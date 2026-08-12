#!/usr/bin/env bash
# Push latest (or given) sideload APK to phone Download/ without rebuilding.
#
# Usage:
#   ./scripts/push-apk-to-phone.sh              # latest mobile/artifacts/ruletka-0*.apk
#   ./scripts/push-apk-to-phone.sh PATH.apk     # explicit APK
#   ./scripts/push-apk-to-phone.sh --install    # also adb install -r
#   ./scripts/push-apk-to-phone.sh PATH.apk --install
#
# Prefers Pixel 9 Pro when several adb devices are online.
# Soft-fails with a clear message if no device / no adb.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART="$ROOT/artifacts"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

PHONE_MODEL_PREFER="${PHONE_MODEL_PREFER:-Pixel 9 Pro}"
PHONE_DOWNLOAD_DIR="${PHONE_DOWNLOAD_DIR:-/sdcard/Download}"

INSTALL=0
APK=""

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \?//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --install) INSTALL=1; shift ;;
    --) shift; break ;;
    -*)
      echo "Unknown option: $1" >&2
      usage 1
      ;;
    *)
      if [[ -n "$APK" ]]; then
        echo "Extra argument: $1" >&2
        usage 1
      fi
      APK="$1"
      shift
      ;;
  esac
done

if [[ -z "$APK" ]]; then
  # Latest versioned artifact by mtime (ruletka-0.1.xxx…apk).
  APK="$(ls -t "$ART"/ruletka-0*.apk 2>/dev/null | head -n1 || true)"
  if [[ -z "$APK" ]]; then
    echo "No APK found under $ART/ruletka-0*.apk" >&2
    echo "Build first: cd mobile && ./scripts/build-apk-local.sh" >&2
    exit 1
  fi
fi

if [[ ! -f "$APK" ]]; then
  echo "APK not found: $APK" >&2
  exit 1
fi

adb_bin="${ANDROID_HOME}/platform-tools/adb"
if [[ ! -x "$adb_bin" ]]; then
  adb_bin="$(command -v adb 2>/dev/null || true)"
fi
if [[ -z "${adb_bin:-}" || ! -x "$adb_bin" ]]; then
  echo "Phone push: skipped (adb not found under \$ANDROID_HOME/platform-tools or PATH)."
  exit 0
fi

serials=()
mapfile -t serials < <("$adb_bin" devices 2>/dev/null | awk 'NR>1 && $2=="device"{print $1}')
if [[ ${#serials[@]} -eq 0 ]]; then
  echo "Phone push: skipped (no adb device — plug Pixel, enable USB debugging)."
  exit 0
fi

serial="" model=""
for s in "${serials[@]}"; do
  m="$("$adb_bin" -s "$s" shell getprop ro.product.model 2>/dev/null | tr -d '\r')"
  if [[ "$m" == *"$PHONE_MODEL_PREFER"* ]]; then
    serial="$s"
    model="$m"
    break
  fi
done
if [[ -z "$serial" ]]; then
  serial="${serials[0]}"
  model="$("$adb_bin" -s "$serial" shell getprop ro.product.model 2>/dev/null | tr -d '\r')"
  echo "Phone push: no '${PHONE_MODEL_PREFER}' — using first device: ${model:-?} ($serial)"
fi

base="$(basename "$APK")"
remote="${PHONE_DOWNLOAD_DIR%/}/${base}"
echo "Phone push: $base → ${model:-device} ${PHONE_DOWNLOAD_DIR}/ …"
if "$adb_bin" -s "$serial" push "$APK" "$remote" >/dev/null; then
  "$adb_bin" -s "$serial" push "$APK" \
    "${PHONE_DOWNLOAD_DIR%/}/ruletka-latest.apk" >/dev/null 2>&1 || true
  echo "Phone:    $remote"
  echo "Phone:    ${PHONE_DOWNLOAD_DIR%/}/ruletka-latest.apk"
else
  echo "Phone push: failed (USB file transfer / authorization?)." >&2
  exit 1
fi

if [[ "$INSTALL" -eq 1 ]]; then
  echo "Install:  adb -s $serial install -r …"
  if "$adb_bin" -s "$serial" install -r "$APK"; then
    echo "Installed: $base on ${model:-device} ($serial)"
  else
    echo "Install failed (signature mismatch? uninstall old app first)." >&2
    exit 1
  fi
fi
