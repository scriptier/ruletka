#!/usr/bin/env bash
# Local demo: two bridges that federate stranger matches.
# Terminal UX: starts hub A in background, hub B in foreground (Ctrl+C stops B; kill A via pid file).
#
# Usage:
#   ./scripts/run-federated-pair.sh
# Then open:
#   http://127.0.0.1:8790/live.html   (hub A)
#   http://127.0.0.1:8791/live.html   (hub B)
# Spin/Next on both — they should match across hubs when alone on each side.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source "$HOME/.cargo/env" 2>/dev/null || true

TOKEN="${ROULETTE_FEDERATION_TOKEN:-dev-fed-secret}"
BIN="$ROOT/target/release/roulette-bridge"
if [[ ! -x "$BIN" ]]; then
  echo "Building roulette-bridge…"
  cargo build -p freenet-roulette-bridge --release
fi

# Stop previous demo hubs if any
for p in /tmp/roulette-fed-a.pid /tmp/roulette-fed-b.pid; do
  if [[ -f "$p" ]]; then
    kill "$(cat "$p")" 2>/dev/null || true
    rm -f "$p"
  fi
done
sleep 0.3

echo "Token: $TOKEN"
echo "Hub A → :8790   Hub B → :8791"
echo

ROULETTE_OPEN_TURN="${ROULETTE_OPEN_TURN:-true}"

nohup env \
  ROULETTE_INSTANCE_ID=hub-a \
  ROULETTE_FEDERATION_TOKEN="$TOKEN" \
  ROULETTE_PUBLIC_BASE=http://127.0.0.1:8790 \
  ROULETTE_FEDERATION_PEERS=http://127.0.0.1:8791 \
  "$BIN" --mode simple --listen 127.0.0.1:8790 --ui-dir "$ROOT/ui" \
    --friends-file "$ROOT/data/friends-fed-a.json" \
    --instance-id hub-a \
    --federation-token "$TOKEN" \
    --public-base http://127.0.0.1:8790 \
    --federation-peers http://127.0.0.1:8791 \
  > /tmp/roulette-fed-a.log 2>&1 &
echo $! > /tmp/roulette-fed-a.pid
sleep 0.8

curl -sf http://127.0.0.1:8790/v1/federation/info | python3 -m json.tool || {
  echo "Hub A failed to start — see /tmp/roulette-fed-a.log"
  exit 1
}

echo
echo "Starting hub B (foreground). Open both live.html URLs and Spin."
echo "  A: http://127.0.0.1:8790/live.html"
echo "  B: http://127.0.0.1:8791/live.html"
echo

exec env \
  ROULETTE_INSTANCE_ID=hub-b \
  ROULETTE_FEDERATION_TOKEN="$TOKEN" \
  ROULETTE_PUBLIC_BASE=http://127.0.0.1:8791 \
  ROULETTE_FEDERATION_PEERS=http://127.0.0.1:8790 \
  "$BIN" --mode simple --listen 127.0.0.1:8791 --ui-dir "$ROOT/ui" \
    --friends-file "$ROOT/data/friends-fed-b.json" \
    --instance-id hub-b \
    --federation-token "$TOKEN" \
    --public-base http://127.0.0.1:8791 \
    --federation-peers http://127.0.0.1:8790
