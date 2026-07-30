#!/usr/bin/env bash
# Full local Freenet packaging for Atlas / discovery readiness:
#   1) lobby + session WASM
#   2) lobby contract publish
#   3) website (UI) publish
#   4) write target/publish/ATLAS_MANIFEST.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${PATH}"
source "$HOME/.cargo/env" 2>/dev/null || true

PORT="${WS_API_PORT:-7509}"
STATE_DIR="$ROOT/target/publish"
mkdir -p "$STATE_DIR"

echo "=========================================="
echo " Freenet Chat Roulette — full publish"
echo " Node WS port: $PORT"
echo "=========================================="

if ! curl -sf --max-time 2 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  echo "ERROR: no HTTP response on :$PORT — start a node first:"
  echo "  ./scripts/run-local-node.sh"
  exit 1
fi

echo ""
echo "==> [1/3] Lobby contract"
bash "$ROOT/scripts/publish-local.sh"

echo ""
echo "==> [2/3] Website (UI web container)"
bash "$ROOT/scripts/publish-website.sh"

LOBBY_KEY=$(cat "$STATE_DIR/lobby-key.txt" 2>/dev/null || echo "unknown")
WEB_KEY=$(cat "$STATE_DIR/website-key.txt" 2>/dev/null || echo "unknown")
WEB_URL=$(cat "$STATE_DIR/website-url.txt" 2>/dev/null || echo "http://127.0.0.1:${PORT}/v1/contract/web/${WEB_KEY}/")

# Session WASM path (published per-match by agent, not a single global key)
SESSION_WASM="$ROOT/target/wasm32-unknown-unknown/release/freenet_roulette_session.wasm"
LOBBY_WASM="$ROOT/target/wasm32-unknown-unknown/release/freenet_roulette_lobby.wasm"

cat > "$STATE_DIR/ATLAS_MANIFEST.md" <<EOF
# Freenet Chat Roulette — publish manifest

Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Local Freenet URLs (this machine)

| Resource | Value |
|----------|--------|
| **Website (UI)** | ${WEB_URL} |
| Website contract key | \`${WEB_KEY}\` |
| Lobby contract key | \`${LOBBY_KEY}\` |
| Session WASM | \`${SESSION_WASM}\` (PUT per match by agent) |
| Lobby WASM | \`${LOBBY_WASM}\` |
| Node HTTP / WS | \`http://127.0.0.1:${PORT}/\` · \`ws://127.0.0.1:${PORT}/v1/contract/command\` |

## Atlas / discovery

1. Open Atlas (local node):  
   http://127.0.0.1:7509/v1/contract/web/771DvtPMwt2PumPyrFvsz7fpvU1gogcmb5qtS1yYEEH9/
2. Search for **Chat Roulette** / **webrtc** after the crawler indexes network content.
3. Machine descriptor served at: \`${WEB_URL}freenet-app.json\`
4. Design notes: \`docs/ATLAS.md\`

## Demo paths

\`\`\`bash
# On-network match (CLI)
cargo run -p freenet-roulette-agent -- dual

# Bridge demo (not Freenet-indexed)
./scripts/run-bridge.sh
\`\`\`

## Re-publish

\`\`\`bash
./scripts/publish-freenet-all.sh
\`\`\`

Website key name: \`\${FREENET_SITE_KEY:-freenet-roulette}\` (\`fdev website list\`)
EOF

echo ""
echo "=========================================="
echo " DONE — open the Freenet UI:"
echo "  $WEB_URL"
echo " Manifest: $STATE_DIR/ATLAS_MANIFEST.md"
echo "=========================================="
