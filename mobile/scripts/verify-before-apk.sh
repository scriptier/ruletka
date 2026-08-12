#!/usr/bin/env bash
# Pre-APK verify ladder (cheap → expensive). Fail closed before assembleRelease.
#
# Usage:
#   cd mobile && ./scripts/verify-before-apk.sh
#   SKIP_L2=1 ./scripts/verify-before-apk.sh   # skip network (hub/deploy)
#   VERIFY_STRICT_L2=1 ./scripts/verify-before-apk.sh  # L2 failures fail the run
#
# Layers:
#   L0  static match-UX invariants (seconds)
#   L1  unit tests (seconds)
#   L2  hub / UI deploy / cache-bust (seconds, soft-fail offline unless STRICT)
#
# Exit 0 = BUILD allowed · 1 = BUILD blocked
set -euo pipefail
cd "$(dirname "$0")/.."
MOBILE="$(pwd)"
REPO="$(cd .. && pwd)"

ok=0
fail=0
warn=0

check() {
  local name="$1"; shift
  if "$@"; then
    echo "  OK  $name"
    ok=$((ok + 1))
  else
    echo "  FAIL $name"
    fail=$((fail + 1))
    return 1
  fi
}

soft() {
  local name="$1"; shift
  if "$@"; then
    echo "  OK  $name"
    ok=$((ok + 1))
  else
    echo "  WARN $name (non-blocking unless VERIFY_STRICT_L2=1)"
    warn=$((warn + 1))
    if [[ "${VERIFY_STRICT_L2:-0}" == "1" ]]; then
      fail=$((fail + 1))
    fi
  fi
}

echo "=== verify-before-apk (ruletka mobile) ==="
echo "mobile: $MOBILE"
echo "repo:   $REPO"
echo

# ── L0 static ────────────────────────────────────────────────────────────
echo "── L0 static match-UX ──"
if node scripts/verify-match-ux.mjs; then
  ok=$((ok + 1))
  echo "  OK  verify-match-ux.mjs"
else
  fail=$((fail + 1))
  echo "  FAIL verify-match-ux.mjs"
fi
echo

# ── L1 units ─────────────────────────────────────────────────────────────
echo "── L1 unit tests ──"
run_node() {
  local f="$1"
  if [[ -f "$f" ]]; then
    node "$f" >/dev/null
  else
    return 1
  fi
}

check "matchPeers.test.mjs" run_node src/live/matchPeers.test.mjs
check "formatLocLine.test.mjs" run_node src/identity/formatLocLine.test.mjs
check "blurMode.test.mjs" run_node src/prefs/blurMode.test.mjs
check "stageStreams.test.mjs" run_node src/live/stageStreams.test.mjs
check "connectSteps.test.mjs" run_node src/live/connectSteps.test.mjs
check "callMetrics.test.mjs" run_node src/live/callMetrics.test.mjs
check "hubLobby.test.mjs" run_node src/live/hubLobby.test.mjs
check "matchContinuity.test.mjs" run_node src/live/matchContinuity.test.mjs
check "npm test (friend/geo/live-units)" npm test --silent
echo

# ── L2 network contract (optional) ───────────────────────────────────────
if [[ "${SKIP_L2:-0}" == "1" ]]; then
  echo "── L2 skipped (SKIP_L2=1) ──"
  echo
else
  echo "── L2 hub / UI deploy (soft) ──"
  soft "hub health" bash -c 'curl -sf --max-time 8 https://ruletka.vip/health | grep -q "\"ok\":true\|ok"'
  soft "deploy.json reachable" bash -c 'curl -sf --max-time 8 https://ruletka.vip/deploy.json | grep -q "\"v\""'
  soft "live.html has live.js?v= + webrtc.js?v=" bash -c '
    html=$(curl -sf --max-time 8 https://ruletka.vip/live.html) || exit 1
    echo "$html" | grep -qE "live\.js\?v=[0-9]+" || exit 1
    echo "$html" | grep -qE "webrtc\.js\?v=[0-9]+" || exit 1
  '
  # If local ui/live.html v=N, public live.js?v=N should contain hop9 marker when online
  if [[ -f "$REPO/ui/live.html" ]]; then
    LIVE_V=$(grep -oE 'live\.js\?v=[0-9]+' "$REPO/ui/live.html" | head -1 | grep -oE '[0-9]+' || true)
    if [[ -n "${LIVE_V:-}" ]]; then
      soft "public live.js?v=${LIVE_V} has stuck-offer fix" bash -c "
        body=\$(curl -sf --max-time 12 \"https://ruletka.vip/live.js?v=${LIVE_V}\") || exit 1
        echo \"\$body\" | grep -qE 'free stuck inflight|_inflightAt' || exit 1
      "
    fi
  fi
  # Optional av-verify if script present (does not fail build on WARN alone)
  if [[ -x "$REPO/scripts/av-verify.sh" ]]; then
    soft "av-verify --min 10 runs" bash -c "cd \"$REPO\" && ./scripts/av-verify.sh --min 10 >/tmp/av-verify-preapk.md 2>&1"
    if [[ -f /tmp/av-verify-preapk.md ]]; then
      mto=$(grep -oE 'max_mto=[0-9]+' /tmp/av-verify-preapk.md | head -1 | cut -d= -f2 || true)
      if [[ -n "${mto:-}" && "$mto" -ge 20000 ]]; then
        echo "  WARN hub max_mto=${mto}ms ≥20s — fix live.js?v= on PC / hard-refresh live.html first"
        echo "       Do NOT ship mobile HUD/blur APKs for linking lag until web stamp is current (UX-only FAIL OK)"
        warn=$((warn + 1))
        if [[ "${VERIFY_STRICT_L2:-0}" == "1" ]]; then
          fail=$((fail + 1))
        fi
      elif [[ -n "${mto:-}" ]]; then
        echo "  OK  hub max_mto=${mto}ms (from last av-verify window)"
        ok=$((ok + 1))
      fi
    fi
  fi
  echo
fi

echo "══════════════════════════════════════"
echo "Passed: $ok  Failed: $fail  Warnings: $warn"
if [[ "$fail" -gt 0 ]]; then
  echo "BUILD blocked — fix FAIL items (or SKIP_VERIFY=1 on build-apk-local.sh)"
  echo "Layers: L0 static · L1 units · L2 hub/deploy"
  exit 1
fi
echo "BUILD allowed"
exit 0
