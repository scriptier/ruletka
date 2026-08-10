#!/usr/bin/env bash
# Build a Play-uploadable AAB on this machine (no EAS free-tier queue).
#
# Prerequisites (one-time):
#   - Android SDK at ~/Android/Sdk (platform 35, build-tools 35, NDK 26.1)
#   - JDK 17 at ~/.local/jdk-17 (Temurin)
#   - Play upload keystore in mobile/secrets/ (see secrets/README.md)
#
# Usage:
#   ./scripts/build-aab-local.sh
#   ./scripts/build-aab-local.sh 10          # optional versionCode override
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-17}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

if [[ ! -x "$JAVA_HOME/bin/javac" ]]; then
  echo "Missing JDK 17 at $JAVA_HOME (need javac). Install Temurin 17 or set JAVA_HOME." >&2
  exit 1
fi
if [[ ! -d "$ANDROID_HOME/platforms/android-35" ]]; then
  echo "Missing Android SDK platform 35 under $ANDROID_HOME" >&2
  exit 1
fi
if [[ ! -f secrets/keystore.properties || ! -f secrets/ruletka-upload.jks ]]; then
  echo "Missing Play upload keystore. See secrets/README.md" >&2
  exit 1
fi

printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties

VC="${1:-}"
if [[ -n "$VC" ]]; then
  # Patch versionCode in app/build.gradle for this build only
  sed -i -E "s/versionCode [0-9]+/versionCode ${VC}/" android/app/build.gradle
  echo "versionCode → $VC"
fi

cd android
./gradlew :app:bundleRelease --no-daemon -Dorg.gradle.java.home="$JAVA_HOME"

OUT="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
mkdir -p "$ROOT/artifacts"
# Read version from gradle defaultConfig if possible
VER=$(grep -E 'versionName "' "$ROOT/android/app/build.gradle" | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
CODE=$(grep -E 'versionCode ' "$ROOT/android/app/build.gradle" | head -1 | sed -E 's/.*versionCode ([0-9]+).*/\1/')
DEST="$ROOT/artifacts/ruletka-${VER}-vc${CODE}.aab"
cp -a "$OUT" "$DEST"
ls -lh "$DEST"
echo ""
echo "Upload: $DEST"
echo "Check targetSdk: java -jar bundletool.jar dump manifest --bundle=$DEST | grep targetSdk"
