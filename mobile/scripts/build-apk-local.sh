#!/usr/bin/env bash
# Build a sideloadable release APK on this machine (no EAS).
# Same toolchain as build-aab-local.sh; output → mobile/artifacts/.
#
# Prerequisites (one-time):
#   - Android SDK at ~/Android/Sdk (platform 35+)
#   - JDK 17 at ~/.local/jdk-17 (Temurin)
#   - Optional: release keystore in mobile/secrets/ (else debug signing)
#
# Usage:
#   ./scripts/build-apk-local.sh              # build current app.json version
#   ./scripts/build-apk-local.sh --bump       # patch +1 versionCode & 0.0.x, then build
#   ./scripts/build-apk-local.sh --version 0.1.130 --code 138
#   ./scripts/build-apk-local.sh 138          # pin versionCode only (AAB-style)
#
# Does NOT: production deploy, Play upload, bulk APK on public site.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-17}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

BUMP=0
PIN_VER=""
PIN_CODE=""

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \?//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bump) BUMP=1; shift ;;
    --no-bump) BUMP=0; shift ;;
    --version)
      PIN_VER="${2:-}"
      shift 2
      [[ -n "$PIN_VER" ]] || { echo "--version needs a value" >&2; exit 1; }
      ;;
    --code)
      PIN_CODE="${2:-}"
      shift 2
      [[ -n "$PIN_CODE" ]] || { echo "--code needs a value" >&2; exit 1; }
      ;;
    -h|--help) usage 0 ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        PIN_CODE="$1"
        shift
      else
        echo "Unknown arg: $1" >&2
        usage 1
      fi
      ;;
  esac
done

if [[ ! -x "$JAVA_HOME/bin/javac" ]]; then
  echo "Missing JDK 17 at $JAVA_HOME (need javac)." >&2
  exit 1
fi
if [[ ! -d "$ANDROID_HOME/platforms/android-35" ]]; then
  echo "Missing Android SDK platform 35 under $ANDROID_HOME" >&2
  exit 1
fi
if [[ ! -d android/app ]]; then
  echo "No android/ app dir — run expo prebuild first." >&2
  exit 1
fi

# Serialize all assembleRelease callers (manual + post-commit hook).
# Dual builds race lintVital return-value file and fail intermittently.
mkdir -p "$ROOT/artifacts"
LOCK="$ROOT/artifacts/.apk-build.lock"
exec 200>"$LOCK"
if ! flock -n 200; then
  echo "Another APK build is running (lock: $LOCK) — waiting…" >&2
  if ! flock -w 1800 200; then
    echo "Timed out after 30m waiting for the other build to finish." >&2
    exit 1
  fi
fi

printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties

# ── Version: app.json is source of truth ────────────────────────────────────
export PIN_VER PIN_CODE BUMP
node <<'NODE'
const fs = require("fs");
const path = "app.json";
const j = JSON.parse(fs.readFileSync(path, "utf8"));
let ver = j.expo.version || "0.1.0";
let code = Number(j.expo.android?.versionCode || 1);
const pinVer = process.env.PIN_VER || "";
const pinCode = process.env.PIN_CODE || "";
const bump = process.env.BUMP === "1";
let changed = false;

if (pinVer) {
  ver = pinVer;
  changed = true;
} else if (bump) {
  const parts = String(ver).split(".").map((x) => parseInt(x, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  ver = parts.join(".");
  changed = true;
}
if (pinCode) {
  code = Number(pinCode);
  changed = true;
} else if (bump) {
  code += 1;
  changed = true;
}

if (changed) {
  j.expo.version = ver;
  j.expo.android = j.expo.android || {};
  j.expo.android.versionCode = code;
  fs.writeFileSync(path, JSON.stringify(j, null, 2) + "\n");
  console.log("app.json → " + ver + " vc" + code);
} else {
  console.log("app.json (unchanged) " + ver + " vc" + code);
}
NODE

VER="$(node -e "console.log(require('./app.json').expo.version)")"
CODE="$(node -e "console.log(require('./app.json').expo.android.versionCode)")"
if [[ -f android/app/build.gradle ]]; then
  sed -i -E "s/versionCode [0-9]+/versionCode ${CODE}/" android/app/build.gradle
  sed -i -E "s/versionName \"[^\"]*\"/versionName \"${VER}\"/" android/app/build.gradle
  echo "gradle → versionName ${VER} versionCode ${CODE}"
fi

# ── Build ───────────────────────────────────────────────────────────────────
echo "Building release APK…"
(
  cd android
  ./gradlew :app:assembleRelease --no-daemon -Dorg.gradle.java.home="$JAVA_HOME"
)

OUT="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$OUT" ]]; then
  echo "APK not found at $OUT" >&2
  exit 1
fi

mkdir -p "$ROOT/artifacts"
DEST="$ROOT/artifacts/ruletka-${VER}-vc${CODE}.apk"
cp -a "$OUT" "$DEST"
cp -a "$DEST" "$ROOT/artifacts/ruletka-latest.apk"
ln -sfn "ruletka-${VER}-vc${CODE}.apk" "$ROOT/artifacts/ruletka-android-latest.apk"

ls -lh "$DEST"
echo ""
echo "APK:     $DEST"
echo "Latest:  $ROOT/artifacts/ruletka-latest.apk"
echo "Symlink: artifacts/ruletka-android-latest.apk → ruletka-${VER}-vc${CODE}.apk"
echo "Install: adb install -r \"$DEST\""
echo "(Local only — not uploaded to site or Play.)"
