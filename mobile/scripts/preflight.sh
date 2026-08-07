#!/usr/bin/env bash
# Local checks before EAS build / store submit.
# Usage: cd mobile && ./scripts/preflight.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(cd .. && pwd)"

ok=0
fail=0
check() {
  local name="$1"; shift
  if "$@"; then
    echo "  OK  $name"
    ok=$((ok + 1))
  else
    echo "  FAIL $name"
    fail=$((fail + 1))
  fi
}

echo "=== ruletka mobile preflight ==="
echo "Node: $(node -v 2>/dev/null || echo missing)"
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo 0)
if [[ "${NODE_MAJOR:-0}" -lt 20 ]]; then
  echo "  WARN Node < 20 — EAS CLI wants ≥20 (nvm use 20)"
fi

check "package.json present" test -f package.json
check "app.config.js present" test -f app.config.js
check "eas.json present" test -f eas.json
check "icon ≥512" python3 - <<'PY'
import struct
from pathlib import Path
d = Path("assets/icon.png").read_bytes()
assert d[:8] == b"\x89PNG\r\n\x1a\n"
w, h = struct.unpack(">II", d[16:24])
assert w >= 512 and h >= 512, (w, h)
PY
check "play feature graphic" test -f assets/store/play-feature-1024x500.png
check "i18n packs" test -f src/i18n/packs/en.json -a -f src/i18n/packs/ru.json
check "friend invite unit tests" npm test --silent
check "TypeScript" npx tsc --noEmit
check "hub AASA public" bash -c 'curl -sf -o /dev/null -w "%{http_code}" https://ruletka.vip/.well-known/apple-app-site-association | grep -q 200'
check "hub health" bash -c 'curl -sf https://ruletka.vip/health | grep -q "\"ok\":true"'

PROJECT=$(node -e "try{const j=require('./app.json');console.log(j.expo?.extra?.eas?.projectId||'')}catch{console.log('')}")
if [[ -z "$PROJECT" || "$PROJECT" == replace-with-eas-project-id* ]]; then
  echo "  WARN eas projectId not set — run: npx eas-cli login && npx eas init"
else
  echo "  OK  eas projectId=$PROJECT"
  ok=$((ok + 1))
fi

if npx eas-cli whoami >/dev/null 2>&1; then
  echo "  OK  eas logged in as $(npx eas-cli whoami 2>/dev/null)"
  ok=$((ok + 1))
else
  echo "  WARN eas not logged in — interactive: npx eas-cli login"
fi

echo
echo "Passed: $ok  Failed: $fail"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
echo "Ready for: npx eas build --profile development --platform android"
echo "Play closed-test: ./scripts/play-status.sh  (see docs/PLAY_OPS.md)"
echo "See: docs/OPERATOR_NEXT.md  docs/DEVICE_SMOKE.md  docs/PLAY_OPS.md"
