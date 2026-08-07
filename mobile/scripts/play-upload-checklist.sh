#!/usr/bin/env bash
# One-shot Play Internal upload checklist for the current app.json version.
# Does NOT upload (needs secrets/google-play.json or Console UI).
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(node -e "console.log(require('./app.json').expo.version||'?')")
VC=$(node -e "console.log(require('./app.json').expo.android.versionCode||'?')")
AAB="artifacts/ruletka-${VER}-vc${VC}.aab"
APK="artifacts/ruletka-${VER}-vc${VC}.apk"

echo "=== Play Internal upload checklist ==="
echo "Version: ${VER}  versionCode: ${VC}"
echo

ok=1
if [[ -f "$AAB" ]]; then
  ls -lh "$AAB"
  sha256sum "$AAB" | awk '{print "SHA256",$1}'
else
  echo "MISSING AAB: $AAB"
  ok=0
fi
[[ -f "$APK" ]] && ls -lh "$APK" || echo "(APK optional for Play)"

echo
if [[ -f secrets/google-play.json ]]; then
  echo "Auto-submit key: secrets/google-play.json present"
  echo "  npx eas-cli submit --profile production --platform android --path $AAB"
else
  echo "Auto-submit key: MISSING secrets/google-play.json"
  echo "  → Manual upload only (or add Play API service account JSON)"
fi

echo
echo "--- Console steps ---"
echo "1. https://play.google.com/console → me.ruletka.app"
echo "2. Testing → Internal testing → Create new release"
echo "3. Upload: $(pwd)/$AAB"
echo "4. Release name: ${VER} (${VC})"
echo "5. Paste notes:"
echo
./scripts/play-status.sh --notes
echo
echo "6. Review → Start rollout to Internal testing"
echo "7. Testers → add email → open opt-in link on phone"
echo
echo "Sideload same build: https://ruletka.vip/download/ruletka-android-latest.apk"
echo "Paste file: artifacts/PLAY-INTERNAL-${VER}.txt (if present)"
echo
if [[ "$ok" -ne 1 ]]; then
  exit 1
fi
echo "Ready to upload."
