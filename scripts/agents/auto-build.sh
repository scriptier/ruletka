#!/usr/bin/env bash
# Auto-build mobile APK when harvest touched mobile/ (sideload path only).
# Never deploys to Play or public site.
#
# Usage:
#   ./scripts/agents/auto-build.sh              # build if mobile dirty vs stamp
#   ./scripts/agents/auto-build.sh --force       # always bump+build
#   AUTO_BUILD_BUMP=0 ./scripts/agents/auto-build.sh  # build without version bump
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
STAMP="$ROOT/artifacts/agents/last-apk-build.stamp"
LOG="$ROOT/scripts/claude-logs/auto-build.log"
mkdir -p "$(dirname "$STAMP")" "$ROOT/scripts/claude-logs" "$ROOT/mobile/artifacts"

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1
BUMP="${AUTO_BUILD_BUMP:-1}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG"; }

# Detect mobile changes since last successful auto-build
need=0
if [[ "$FORCE" == "1" ]]; then
  need=1
elif [[ ! -f "$STAMP" ]]; then
  need=1
  log "no stamp — will build"
else
  # any mobile source newer than stamp?
  if find mobile/app mobile/src mobile/app.json \
      -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.json' -o -name '*.mjs' \) \
      -newer "$STAMP" 2>/dev/null | head -1 | grep -q .; then
    need=1
    log "mobile sources newer than stamp — will build"
  fi
fi

if [[ "$need" != "1" ]]; then
  log "skip build (no mobile changes)"
  exit 0
fi

# Gate: unit smoke must pass
if ! bash "$ROOT/scripts/dev-smoke.sh" --unit >>"$LOG" 2>&1; then
  log "FAIL: unit smoke — skip APK"
  exit 1
fi

cd "$ROOT/mobile"
if [[ "$BUMP" == "1" ]]; then
  log "bump version + assembleRelease"
  if [[ -x ./scripts/build-apk-local.sh ]]; then
    ./scripts/build-apk-local.sh --bump >>"$LOG" 2>&1
  else
    log "FAIL: build-apk-local.sh missing"
    exit 1
  fi
else
  log "assembleRelease (no bump)"
  ./scripts/build-apk-local.sh >>"$LOG" 2>&1
fi

# Record stamp + version
ver=$(python3 -c "import json;e=json.load(open('app.json'))['expo'];print(e['version'], e['android']['versionCode'])")
date -u +%Y-%m-%dT%H:%M:%SZ >"$STAMP"
echo "$ver" >>"$STAMP"
log "APK OK $ver → mobile/artifacts/ruletka-android-latest.apk"

# One-liner for POLISH
echo "auto-build $ver $(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$ROOT/artifacts/agents/build.jsonl"
exit 0
