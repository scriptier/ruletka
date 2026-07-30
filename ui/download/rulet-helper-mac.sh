#!/usr/bin/env bash
# ruletka network helper (macOS, open source)
# Full mini-hub + tunnel. Island chat on YOUR URL. No control of seed site.
set -euo pipefail

BASE_URL="${RULETKA_BASE:-https://ruletka.vip}"
DIR="${RULETKA_HELPER_DIR:-$HOME/.ruletka-helper}"
PORT="${RULETKA_HELPER_PORT:-8791}"
INSTANCE_ID="${ROULETTE_INSTANCE_ID:-helper-mac-$(hostname -s 2>/dev/null || echo mac)-$$}"

echo ""
echo "  ruletka · network helper (macOS)"
echo "  ────────────────────────────────"
echo "  Independent mini hub on your Mac."
echo "  Chat can use YOUR public URL if the seed site is down."
echo "  Stop anytime: Ctrl+C"
echo ""

os=$(uname -s 2>/dev/null || echo unknown)
arch=$(uname -m 2>/dev/null || echo unknown)
if [[ "$os" != "Darwin" ]]; then
  echo "This script is for macOS. Use rulet-helper.sh on Linux or rulet-helper.ps1 on Windows."
  exit 1
fi

case "$arch" in
  arm64|aarch64) BRIDGE_NAME="roulette-bridge-macos-arm64"; CF_NAME="cloudflared-darwin-arm64.tgz" ;;
  x86_64)        BRIDGE_NAME="roulette-bridge-macos-amd64"; CF_NAME="cloudflared-darwin-amd64.tgz" ;;
  *)
    echo "Unsupported Mac architecture: $arch"
    exit 1
    ;;
esac

BIN="$DIR/roulette-bridge"
CF="$DIR/cloudflared"
mkdir -p "$DIR/ui/brand" "$DIR/ui/legal"
cd "$DIR"

echo "Syncing chat UI from $BASE_URL …"
for f in index.html live.html contribute.html home.css style.css live-stage.css \
  i18n.js identity.js hubs.js webrtc.js live.js sw.js hubs.json favicon.svg manifest.webmanifest; do
  curl -fsSL "$BASE_URL/$f" -o "$DIR/ui/$f" 2>/dev/null || true
done
for f in logo-mark.png favicon-32.png apple-touch-icon-180.png; do
  curl -fsSL "$BASE_URL/brand/$f" -o "$DIR/ui/brand/$f" 2>/dev/null || true
done
if [[ ! -f "$DIR/ui/live.html" ]]; then
  echo "<!doctype html><title>helper</title><p>UI download failed — build from source.</p>" >"$DIR/ui/live.html"
  cp "$DIR/ui/live.html" "$DIR/ui/index.html"
fi

if [[ ! -x "$BIN" ]]; then
  echo "Downloading bridge ($BRIDGE_NAME)…"
  curl -fsSL "$BASE_URL/download/$BRIDGE_NAME" -o "$BIN.tmp"
  if curl -fsSL "$BASE_URL/download/SHA256SUMS" -o "$DIR/SHA256SUMS" 2>/dev/null; then
    expect=$(awk -v n="$BRIDGE_NAME" '$2==n {print $1; exit}' "$DIR/SHA256SUMS" || true)
    if [[ -n "$expect" ]]; then
      if command -v shasum >/dev/null 2>&1; then
        got=$(shasum -a 256 "$BIN.tmp" | awk '{print $1}')
      elif command -v sha256sum >/dev/null 2>&1; then
        got=$(sha256sum "$BIN.tmp" | awk '{print $1}')
      else
        got=""
      fi
      if [[ -n "$got" && "$got" != "$expect" ]]; then
        echo "ERROR: checksum mismatch for $BRIDGE_NAME" >&2
        rm -f "$BIN.tmp"
        exit 1
      fi
      [[ -n "$got" ]] && echo "  ✓ SHA256 verified"
    fi
  fi
  chmod +x "$BIN.tmp"
  mv "$BIN.tmp" "$BIN"
  xattr -dr com.apple.quarantine "$BIN" 2>/dev/null || true
fi

if [[ ! -x "$CF" ]]; then
  if command -v cloudflared >/dev/null 2>&1; then
    CF=$(command -v cloudflared)
  else
    echo "Downloading cloudflared…"
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/$CF_NAME" -o "$DIR/cf.tgz"
    tar -xzf "$DIR/cf.tgz" -C "$DIR"
    rm -f "$DIR/cf.tgz"
    if [[ -f "$DIR/cloudflared" ]]; then
      chmod +x "$DIR/cloudflared"
      xattr -dr com.apple.quarantine "$DIR/cloudflared" 2>/dev/null || true
      CF="$DIR/cloudflared"
    else
      echo "Could not find cloudflared in archive"
      exit 1
    fi
  fi
fi

BRIDGE_PID=""
TUNNEL_PID=""
cleanup() {
  echo ""
  echo "Stopping helper…"
  [[ -n "${TUNNEL_PID:-}" ]] && kill "$TUNNEL_PID" 2>/dev/null || true
  [[ -n "${BRIDGE_PID:-}" ]] && kill "$BRIDGE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

start_bridge() {
  local public_base="${1:-}"
  unset ROULETTE_FEDERATION_TOKEN ROULETTE_FEDERATION_PEERS ROULETTE_ADMIN_TOKEN || true
  export ROULETTE_OPEN_TURN=true
  export ROULETTE_INSTANCE_ID="$INSTANCE_ID"
  export ROULETTE_DIRECTORY_HUBS="$BASE_URL"
  if [[ -n "$public_base" ]]; then
    export ROULETTE_PUBLIC_BASE="$public_base"
  else
    unset ROULETTE_PUBLIC_BASE || true
  fi
  if [[ -n "${BRIDGE_PID:-}" ]] && kill -0 "$BRIDGE_PID" 2>/dev/null; then
    kill "$BRIDGE_PID" 2>/dev/null || true
    wait "$BRIDGE_PID" 2>/dev/null || true
  fi
  "$BIN" --mode simple --listen "127.0.0.1:${PORT}" --ui-dir "$DIR/ui" \
    --friends-file "$DIR/friends.json" >>"$DIR/bridge.log" 2>&1 &
  BRIDGE_PID=$!
  sleep 0.7
  if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
    echo "Bridge failed. System Settings → Privacy & Security → Allow."
    tail -30 "$DIR/bridge.log" || true
    exit 1
  fi
}

echo "Starting local bridge on http://127.0.0.1:${PORT}/ …"
start_bridge ""

echo "Starting HTTPS tunnel…"
LOG="$DIR/tunnel.log"
: >"$LOG"
"$CF" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate >>"$LOG" 2>&1 &
TUNNEL_PID=$!

PUBLIC=""
for _ in $(seq 1 50); do
  PUBLIC=$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1 || true)
  [[ -n "$PUBLIC" ]] && break
  sleep 0.4
done

if [[ -n "$PUBLIC" ]]; then
  start_bridge "$PUBLIC"
  cat >"$DIR/ui/hubs.json" <<JSON
{
  "protocol": "ruletka-directory/1",
  "hubs": [
    { "base": "$PUBLIC", "name": "this helper" },
    { "base": "$BASE_URL", "name": "seed" }
  ]
}
JSON
fi

echo ""
echo "  ✓ Helper hub is running"
echo "  Local:  http://127.0.0.1:${PORT}/live.html"
if [[ -n "$PUBLIC" ]]; then
  echo "  Public: $PUBLIC/live.html"
  echo "  Share that URL for island chat on your hub."
  curl -fsS -X POST "$BASE_URL/v1/seeder/request" \
    -H 'Content-Type: application/json' \
    -d "{\"public_base\":\"$PUBLIC\",\"instance_id\":\"$INSTANCE_ID\",\"note\":\"helper-mac\"}" \
    >/dev/null 2>&1 || true
else
  echo "  Public tunnel not ready yet — see $LOG"
fi
echo ""
echo "  Open source · LGPL-2.1 · Press Ctrl+C to stop."
echo ""

wait "$BRIDGE_PID" 2>/dev/null || true
