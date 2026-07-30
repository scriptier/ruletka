#!/usr/bin/env bash
# Start the multi-tab bridge in **simple** mode (no Freenet required).
# Default bind: 0.0.0.0:8790 so LAN clients and tunnels can reach it.
# Matchmaking + WebRTC signaling over WebSocket; media is P2P (STUN/TURN).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source "$HOME/.cargo/env" 2>/dev/null || true

export RUST_LOG="${RUST_LOG:-info}"
# Bind all interfaces for LAN / tunnel. Override: LISTEN=127.0.0.1:8790
LISTEN="${LISTEN:-${ROULETTE_LISTEN:-0.0.0.0:8790}}"
export ROULETTE_LISTEN="$LISTEN"

# TURN for hard NATs / mobile carriers:
#   Default: free Open Relay (demo). Override with your coturn:
#     export ROULETTE_TURN=turn:turn.example.com:3478
#     export ROULETTE_TURN_USER=user
#     export ROULETTE_TURN_PASS=secret
#   Disable: export ROULETTE_TURN=off
#   Or: export ROULETTE_OPEN_TURN=false
# Optional STUN override:
#   export ROULETTE_STUN=stun:stun.l.google.com:19302
# Friends / blocks persist under data/friends.json
#
# Federation (share stranger pool with other bridges) — see docs/INTEROP.md:
#   export ROULETTE_INSTANCE_ID=hub-a
#   export ROULETTE_FEDERATION_TOKEN=shared-secret
#   export ROULETTE_PUBLIC_BASE=https://your-public-host
#   export ROULETTE_FEDERATION_PEERS=https://other-hub.example.com

BIN="$ROOT/target/release/roulette-bridge"
if [[ ! -x "$BIN" ]]; then
  echo "Building roulette-bridge (release)…"
  cargo build -p freenet-roulette-bridge --release
fi

echo "Starting simple match bridge on ${LISTEN}"
echo "  home:   /  (CTA → live chat)"
echo "  UI:     /live.html"
echo "  config: /config.json"
echo "  health: /health"
echo "  friends: data/friends.json (persisted)"
echo "  fed:     /v1/federation/info  (docs/INTEROP.md)"
echo "  tunnel: ./scripts/run-tunnel.sh   # HTTPS URL for remote friends"
if [[ -n "${ROULETTE_TURN:-}" ]]; then
  echo "  TURN:   ${ROULETTE_TURN}"
else
  echo "  TURN:   Open Relay demo (default) — set ROULETTE_TURN for production"
fi

OPEN_TURN_ARGS=()
case "${ROULETTE_OPEN_TURN:-}" in
  0|false|FALSE|no|NO|off|OFF) OPEN_TURN_ARGS+=(--open-turn=false) ;;
  1|true|TRUE|yes|YES|on|ON) OPEN_TURN_ARGS+=(--open-turn=true) ;;
esac

FED_ARGS=()
[[ -n "${ROULETTE_INSTANCE_ID:-}" ]] && FED_ARGS+=(--instance-id "$ROULETTE_INSTANCE_ID")
[[ -n "${ROULETTE_FEDERATION_TOKEN:-}" ]] && FED_ARGS+=(--federation-token "$ROULETTE_FEDERATION_TOKEN")
[[ -n "${ROULETTE_FEDERATION_PEERS:-}" ]] && FED_ARGS+=(--federation-peers "$ROULETTE_FEDERATION_PEERS")
[[ -n "${ROULETTE_PUBLIC_BASE:-}" ]] && FED_ARGS+=(--public-base "$ROULETTE_PUBLIC_BASE")

exec "$BIN" \
  --mode simple \
  --listen "$LISTEN" \
  --ui-dir "$ROOT/ui" \
  --friends-file "$ROOT/data/friends.json" \
  ${ROULETTE_STUN:+--stun "$ROULETTE_STUN"} \
  ${ROULETTE_TURN:+--turn "$ROULETTE_TURN"} \
  ${ROULETTE_TURN_USER:+--turn-user "$ROULETTE_TURN_USER"} \
  ${ROULETTE_TURN_PASS:+--turn-pass "$ROULETTE_TURN_PASS"} \
  "${OPEN_TURN_ARGS[@]}" \
  "${FED_ARGS[@]}"
