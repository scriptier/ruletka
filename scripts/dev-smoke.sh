#!/usr/bin/env bash
# Fast local gate before APK / human Play↔browser smoke.
#
# Layers:
#   L0  pure unit tests (seconds)
#   L1  pair-smoke web↔web budgets + rematch (~30–90s)
#   L2  optional hub forensics (--hub) if SSH works
#
# Usage:
#   ./scripts/dev-smoke.sh              # L0 + L1
#   ./scripts/dev-smoke.sh --unit       # L0 only
#   ./scripts/dev-smoke.sh --pair       # L1 only
#   ./scripts/dev-smoke.sh --hub        # also hub-match-speed last 20m
#   ./scripts/dev-smoke.sh --strict     # fail if pair-smoke would skip
#   PAIR_SMOKE_REMATCH=0 ./scripts/dev-smoke.sh
#
# Exit: 0 all run steps pass; 1 any failure; pair skip is OK unless --strict
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

UNIT_ONLY=0
PAIR_ONLY=0
DO_HUB=0
STRICT=0
for a in "$@"; do
  case "$a" in
    --unit) UNIT_ONLY=1 ;;
    --pair) PAIR_ONLY=1 ;;
    --hub) DO_HUB=1 ;;
    --strict) STRICT=1 ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown arg: $a" >&2
      exit 1
      ;;
  esac
done

FAIL=0
RAN_PAIR=0
SKIPPED_PAIR=0

step() {
  local name="$1"
  shift
  echo ""
  echo "════════════════════════════════════════"
  echo "▶ $name"
  echo "════════════════════════════════════════"
  if "$@"; then
    echo "✓ $name"
  else
    local ec=$?
    echo "✗ $name (exit $ec)"
    FAIL=1
    return "$ec"
  fi
}

echo "=== dev-smoke ==="
echo "root: $ROOT"
echo "time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ── L0 unit ──────────────────────────────────────────────────────────────
if [[ "$PAIR_ONLY" != "1" ]]; then
  step "test-connect-ui" node "$ROOT/mobile/scripts/test-connect-ui.mjs"
  step "test-friend-invite" node "$ROOT/mobile/scripts/test-friend-invite.mjs"
  if [[ -f "$ROOT/mobile/scripts/test-geo-localize.mjs" ]]; then
    step "test-geo-localize" node "$ROOT/mobile/scripts/test-geo-localize.mjs"
  fi
  shopt -s nullglob
  for t in "$ROOT/mobile/src/live/"*.test.mjs \
           "$ROOT/mobile/src/prefs/"*.test.mjs \
           "$ROOT/mobile/src/stars/"*.test.mjs; do
    step "unit $(basename "$t")" node "$t"
  done
  shopt -u nullglob
fi

if [[ "$UNIT_ONLY" == "1" ]]; then
  echo ""
  if [[ "$FAIL" == "0" ]]; then
    echo "=== dev-smoke PASS (unit only) ==="
    exit 0
  fi
  echo "=== dev-smoke FAIL (unit only) ==="
  exit 1
fi

# ── L1 pair-smoke ────────────────────────────────────────────────────────
if [[ "$PAIR_ONLY" == "1" || "$UNIT_ONLY" != "1" ]]; then
  BRIDGE_BIN="$ROOT/target/release/roulette-bridge"
  CHROME="${CHROME:-}"
  if [[ -z "$CHROME" ]]; then
    for c in /usr/bin/chromium /usr/bin/google-chrome /usr/bin/chromium-browser; do
      [[ -x "$c" ]] && CHROME="$c" && break
    done
  fi

  can_pair=1
  reason=""
  if [[ ! -x "$BRIDGE_BIN" && ! -f "$BRIDGE_BIN" ]]; then
    can_pair=0
    reason="no bridge at $BRIDGE_BIN (cargo build -p freenet-roulette-bridge --release)"
  fi
  if [[ -z "$CHROME" ]]; then
    can_pair=0
    reason="no Chrome/Chromium (set CHROME=...)"
  fi
  if [[ ! -f /tmp/node_modules/puppeteer-core/package.json ]] && \
     [[ ! -f "$ROOT/node_modules/puppeteer-core/package.json" ]]; then
    # pair-smoke will try require paths; warn but still attempt
    echo "note: puppeteer-core not in project root — pair-smoke uses /tmp if present"
  fi

  if [[ "$can_pair" == "1" ]]; then
    RAN_PAIR=1
    echo ""
    echo "════════════════════════════════════════"
    echo "▶ pair-smoke (web↔web + rematch budgets)"
    echo "════════════════════════════════════════"
    # Prefer chromium for headless stability
    if [[ -z "${CHROME:-}" ]]; then
      for c in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome; do
        [[ -x "$c" ]] && CHROME="$c" && break
      done
    fi
    export CHROME
    export PAIR_SMOKE_ATTEMPTS="${PAIR_SMOKE_ATTEMPTS:-5}"
    export PAIR_SMOKE_REMATCH="${PAIR_SMOKE_REMATCH:-1}"
    # Rematch is advisory by default (match1 is the hard gate)
    export PAIR_SMOKE_REMATCH_STRICT="${PAIR_SMOKE_REMATCH_STRICT:-0}"
    if node "$ROOT/scripts/pair-smoke.mjs"; then
      echo "✓ pair-smoke"
    else
      ec=$?
      echo "✗ pair-smoke (exit $ec)"
      FAIL=1
    fi
  else
    SKIPPED_PAIR=1
    echo ""
    echo "SKIP pair-smoke: $reason"
    if [[ "$STRICT" == "1" ]]; then
      echo "STRICT=1 — treating skip as failure"
      FAIL=1
    fi
  fi
fi

# ── L2 optional hub ──────────────────────────────────────────────────────
if [[ "$DO_HUB" == "1" ]]; then
  echo ""
  echo "════════════════════════════════════════"
  echo "▶ hub-match-speed (last 20m)"
  echo "════════════════════════════════════════"
  if bash "$ROOT/scripts/hub-match-speed.sh" 20 2000; then
    echo "✓ hub-match-speed (ran)"
  else
    echo "WARN hub-match-speed non-zero (ops helper often exits 0 anyway)"
  fi
  echo "Deploy stamp:"
  curl -sS --max-time 6 https://ruletka.vip/deploy.json 2>/dev/null || echo "(curl failed)"
  echo ""
fi

# ── summary ──────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────"
if [[ -f "$ROOT/artifacts/connect-scorecard.jsonl" ]]; then
  echo "Latest scorecard line:"
  tail -1 "$ROOT/artifacts/connect-scorecard.jsonl" || true
fi
echo "pair ran=$RAN_PAIR skipped=$SKIPPED_PAIR"
if [[ "$FAIL" == "0" ]]; then
  echo "=== dev-smoke PASS ==="
  echo "Next: human Play↔browser once, then ./scripts/smoke-connect.sh --hub-only"
  exit 0
fi
echo "=== dev-smoke FAIL ==="
echo "Fix L0/L1 before building APK."
exit 1
