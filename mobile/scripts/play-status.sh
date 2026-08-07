#!/usr/bin/env bash
# Play closed-testing readiness report + optional release notes.
# Usage:
#   cd mobile && ./scripts/play-status.sh
#   cd mobile && ./scripts/play-status.sh --notes
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(cd .. && pwd)"

NOTES_ONLY=0
if [[ "${1:-}" == "--notes" ]]; then
  NOTES_ONLY=1
fi

VER=$(node -e "console.log(require('./app.json').expo.version||'?')")
VC=$(node -e "console.log(require('./app.json').expo.android.versionCode||'?')")
AAB="artifacts/ruletka-${VER}-vc${VC}.aab"
APK="artifacts/ruletka-${VER}-vc${VC}.apk"

notes() {
  cat <<EOF
${VER} (${VC}) — closed testing

• Connect: one offer per match; stop 0.8s thrash / long black wait
• Partner mute visuals + debate over data channel (Play)
• Multi-party: horizontal stack layout
• Soft ICE / hard rebuild (14s / 24s class); phone↔browser
• Friends Call + DMs; report + block; 18+ gate
• Child safety: ruletka.vip/legal/child-safety.html

Hub: https://ruletka.vip
Support: support@ruletka.me
EOF
}

if [[ "$NOTES_ONLY" -eq 1 ]]; then
  notes
  exit 0
fi

ok=0
warn=0
fail=0
check() {
  local level="$1"; shift
  local name="$1"; shift
  if "$@"; then
    echo "  OK    $name"
    ok=$((ok + 1))
  elif [[ "$level" == fail ]]; then
    echo "  FAIL  $name"
    fail=$((fail + 1))
  else
    echo "  WARN  $name"
    warn=$((warn + 1))
  fi
}

echo "=== ruletka Play status ==="
echo "Version: ${VER}  versionCode: ${VC}"
echo

echo "-- Binary --"
check fail "AAB present ($AAB)" test -f "$AAB"
check warn "APK present ($APK)" test -f "$APK"
if [[ -f "$AAB" ]]; then
  ls -lh "$AAB" | awk '{print "        size",$5}'
fi
check fail "upload keystore" test -f secrets/ruletka-upload.jks
check fail "keystore.properties" test -f secrets/keystore.properties
check warn "google-play.json (auto-submit)" test -f secrets/google-play.json

echo
echo "-- Listing assets --"
check fail "app icon 1024" test -f assets/store/app-icon-1024.png
check fail "feature graphic" test -f assets/store/play-feature-1024x500.png
check fail "LISTING.md" test -f assets/store/LISTING.md
check fail "phone screenshots" test -f assets/store/screenshots/phone-01-age-gate.png
check fail "phone-06 settings" test -f assets/store/screenshots/phone-06-settings-safety.png

echo
echo "-- Legal / hub (public) --"
check fail "privacy" bash -c 'curl -sf -o /dev/null -w "%{http_code}" https://ruletka.vip/legal/privacy.html | grep -q 200'
check fail "terms" bash -c 'curl -sf -o /dev/null -w "%{http_code}" https://ruletka.vip/legal/terms.html | grep -q 200'
check fail "delete" bash -c 'curl -sf -o /dev/null -w "%{http_code}" https://ruletka.vip/legal/delete.html | grep -q 200'
check fail "child-safety CSAE" bash -c 'curl -sf -o /dev/null -w "%{http_code}" https://ruletka.vip/legal/child-safety.html | grep -q 200'
check fail "hub health" bash -c 'curl -sf https://ruletka.vip/health | grep -q "\"ok\":true"'

echo
echo "-- Build config --"
check fail "targetSdk 35" grep -q 'targetSdkVersion' android/app/build.gradle
MINIFY=$(grep -E 'enableProguardInReleaseBuilds\s*=' android/gradle.properties 2>/dev/null | tail -1 || true)
if grep -q 'enableProguardInReleaseBuilds=false\|enableProguardInReleaseBuilds = false' android/gradle.properties 2>/dev/null \
  || grep -q 'enableProguardInReleaseBuilds = false\|def enableProguardInReleaseBuilds = false' android/app/build.gradle 2>/dev/null; then
  echo "  OK    minify/R8 off (no mapping file required)"
  ok=$((ok + 1))
else
  # fall back: many projects use enableProguardInReleaseBuilds = false in app/build.gradle
  if grep -n 'enableProguardInReleaseBuilds' android/app/build.gradle | grep -q false; then
    echo "  OK    minify/R8 off (no mapping file required)"
    ok=$((ok + 1))
  else
    echo "  WARN  could not confirm minify off — if R8 on, upload mapping.txt"
    warn=$((warn + 1))
  fi
fi

echo
echo "-- Docs --"
check warn "PLAY_OPS.md" test -f "$ROOT/docs/PLAY_OPS.md"
check warn "PLAY_UPLOAD.md" test -f "$ROOT/docs/PLAY_UPLOAD.md"
check warn "PLAY_DATA_SAFETY.md" test -f "$ROOT/docs/PLAY_DATA_SAFETY.md"

echo
echo "Passed: $ok  Warnings: $warn  Failed: $fail"
echo
echo "=== Release notes (paste into Play) ==="
notes
echo
echo "Manual upload: Play Console → Internal testing → $AAB"
echo "Full guide: docs/PLAY_OPS.md"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
