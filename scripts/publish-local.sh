#!/usr/bin/env bash
# Publish lobby contract to a local Freenet node.
# Prerequisites: `freenet local` on WS 7509 (or WS_API_PORT), fdev on PATH.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source "$HOME/.cargo/env" 2>/dev/null || true

PORT="${WS_API_PORT:-7509}"
OUT="$ROOT/target/wasm32-unknown-unknown/release"
STATE_DIR="$ROOT/target/publish"
mkdir -p "$STATE_DIR"

echo "==> build WASM"
bash "$ROOT/scripts/build-wasm.sh"

echo "==> empty lobby state"
cargo run -q -p freenet-roulette-tools -- empty-lobby -o "$STATE_DIR/lobby-state.cbor"

LOBBY_WASM="$OUT/freenet_roulette_lobby.wasm"
if [[ ! -f "$LOBBY_WASM" ]]; then
  echo "missing $LOBBY_WASM" >&2
  exit 1
fi

echo "==> publish lobby contract (port $PORT)"
set +e
PUBLISH_OUT=$(fdev -p "$PORT" publish --code "$LOBBY_WASM" --subscribe contract --state "$STATE_DIR/lobby-state.cbor" 2>&1)
STATUS=$?
set -e
echo "$PUBLISH_OUT" | tee "$STATE_DIR/lobby-publish.log"

# fdev sometimes errors on UpdateNotification even when the put succeeded.
# Extract key either from "Publishing contract KEY" or ContractKey instance.
KEY=$(echo "$PUBLISH_OUT" | sed -n 's/.*Publishing contract \([A-Za-z0-9]*\).*/\1/p' | head -1)
if [[ -z "$KEY" ]]; then
  KEY=$(echo "$PUBLISH_OUT" | sed -n 's/.*ContractInstanceId("\([^"]*\)").*/\1/p' | head -1)
fi

if [[ -n "$KEY" ]]; then
  echo "$KEY" > "$STATE_DIR/lobby-key.txt"
  echo ""
  echo "=== Lobby contract key ==="
  echo "$KEY"
  echo "Saved: $STATE_DIR/lobby-key.txt"
  echo "Paste into UI Freenet mode → Lobby contract key"
  if [[ $STATUS -ne 0 ]]; then
    echo "(fdev exit $STATUS — often a false negative after a successful put; key above is usable)"
  fi
  exit 0
fi

if [[ $STATUS -ne 0 ]]; then
  echo ""
  echo "Publish failed (is freenet local running on :$PORT?)."
  echo "  freenet local --ws-api-port $PORT"
  exit $STATUS
fi

echo "Published but could not parse contract key — see $STATE_DIR/lobby-publish.log"
