#!/usr/bin/env bash
# Local demo: two bridges that federate stranger matches.
#
# Usage:
#   ./scripts/run-federated-pair.sh
# Then open (two browsers or profiles recommended):
#   http://127.0.0.1:8790/live.html   (hub A)
#   http://127.0.0.1:8791/live.html   (hub B)
# Spin alone on each side → you should match across hubs.
# Live UI shows a "Mesh match" chip when the partner is federated (fed/…).
#
# Stop: Ctrl+C (stops hub B and hub A).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source "$HOME/.cargo/env" 2>/dev/null || true

TOKEN="${ROULETTE_FEDERATION_TOKEN:-dev-fed-secret}"
# Default away from :8790 so a local run-bridge.sh does not collide
PORT_A="${FED_PORT_A:-8792}"
PORT_B="${FED_PORT_B:-8793}"
BASE_A="http://127.0.0.1:${PORT_A}"
BASE_B="http://127.0.0.1:${PORT_B}"
BIN="$ROOT/target/release/roulette-bridge"
if [[ ! -x "$BIN" ]]; then
  echo "Building roulette-bridge…"
  cargo build -p freenet-roulette-bridge --release
fi

port_busy() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$p )" 2>/dev/null | grep -q ":$p"
  else
    (echo >/dev/tcp/127.0.0.1/"$p") >/dev/null 2>&1
  fi
}

cleanup() {
  for p in /tmp/roulette-fed-a.pid /tmp/roulette-fed-b.pid; do
    if [[ -f "$p" ]]; then
      kill "$(cat "$p")" 2>/dev/null || true
      rm -f "$p"
    fi
  done
}
trap cleanup EXIT INT TERM

cleanup
sleep 0.3

if port_busy "$PORT_A" || port_busy "$PORT_B"; then
  echo "Port $PORT_A or $PORT_B is already in use."
  echo "Stop the other process, or set FED_PORT_A / FED_PORT_B."
  exit 1
fi

echo "════════════════════════════════════════"
echo "  Federation pair demo (nextface-fed/1)"
echo "════════════════════════════════════════"
echo "Token: $TOKEN"
echo "Hub A → ${BASE_A}/live.html"
echo "Hub B → ${BASE_B}/live.html"
echo
echo "Tip: use two browser windows (or normal + private)."
echo "     Spin on A only, then Spin on B only → mesh match."
echo

export ROULETTE_OPEN_TURN="${ROULETTE_OPEN_TURN:-true}"
mkdir -p "$ROOT/data"

nohup env \
  ROULETTE_INSTANCE_ID=hub-a \
  ROULETTE_FEDERATION_TOKEN="$TOKEN" \
  ROULETTE_PUBLIC_BASE="$BASE_A" \
  ROULETTE_FEDERATION_PEERS="$BASE_B" \
  "$BIN" --mode simple --listen "127.0.0.1:${PORT_A}" --ui-dir "$ROOT/ui" \
    --friends-file "$ROOT/data/friends-fed-a.json" \
    --instance-id hub-a \
    --federation-token "$TOKEN" \
    --public-base "$BASE_A" \
    --federation-peers "$BASE_B" \
  > /tmp/roulette-fed-a.log 2>&1 &
echo $! > /tmp/roulette-fed-a.pid

nohup env \
  ROULETTE_INSTANCE_ID=hub-b \
  ROULETTE_FEDERATION_TOKEN="$TOKEN" \
  ROULETTE_PUBLIC_BASE="$BASE_B" \
  ROULETTE_FEDERATION_PEERS="$BASE_A" \
  "$BIN" --mode simple --listen "127.0.0.1:${PORT_B}" --ui-dir "$ROOT/ui" \
    --friends-file "$ROOT/data/friends-fed-b.json" \
    --instance-id hub-b \
    --federation-token "$TOKEN" \
    --public-base "$BASE_B" \
    --federation-peers "$BASE_A" \
  > /tmp/roulette-fed-b.log 2>&1 &
echo $! > /tmp/roulette-fed-b.pid

sleep 0.9

verify_hub() {
  local name="$1" base="$2" expect_id="$3" log="$4"
  local json
  json=$(curl -sf "${base}/v1/federation/info") || {
    echo "$name failed to answer — $log"
    tail -30 "$log" || true
    exit 1
  }
  echo "── $name federation/info ──"
  echo "$json" | python3 -m json.tool
  echo "$json" | python3 -c "
import json,sys
j=json.load(sys.stdin)
assert j.get('accepts_claims') is True, 'accepts_claims must be true (token set?)'
assert j.get('instance_id')==sys.argv[1], j.get('instance_id')
assert j.get('public_base'), 'public_base empty'
print('OK', j['instance_id'], 'claims=on')
" "$expect_id" || {
    echo "$name is not a federated demo instance (port collision?)."
    tail -20 "$log" || true
    exit 1
  }
}

verify_hub "Hub A" "$BASE_A" hub-a /tmp/roulette-fed-a.log
verify_hub "Hub B" "$BASE_B" hub-b /tmp/roulette-fed-b.log

echo
echo "Both hubs up. Logs: /tmp/roulette-fed-a.log  /tmp/roulette-fed-b.log"
echo "Press Ctrl+C to stop both."
echo

# Keep process alive until interrupt
while true; do
  if ! kill -0 "$(cat /tmp/roulette-fed-a.pid)" 2>/dev/null; then
    echo "Hub A exited"
    exit 1
  fi
  if ! kill -0 "$(cat /tmp/roulette-fed-b.pid)" 2>/dev/null; then
    echo "Hub B exited"
    exit 1
  fi
  sleep 2
done
