#!/usr/bin/env bash
# ruletka network helper (open source)
# Runs a full mini-hub + HTTPS tunnel. Independent island matchmaking on YOUR node.
# Does NOT control https://ruletka.vip or grant admin access.
set -euo pipefail

BASE_URL="${RULETKA_BASE:-https://ruletka.vip}"
DIR="${RULETKA_HELPER_DIR:-$HOME/.ruletka-helper}"
BIN="$DIR/roulette-bridge"
PORT="${RULETKA_HELPER_PORT:-8791}"
INSTANCE_ID="${ROULETTE_INSTANCE_ID:-helper-$(hostname -s 2>/dev/null || echo pc)-$$}"

echo ""
echo "  ruletka · network helper (open source)"
echo "  ─────────────────────────────────────"
echo "  Your computer runs an independent mini hub."
echo "  Chat can use YOUR public URL if the seed site is down."
echo "  You do NOT control the seed website."
echo "  Stop anytime: Ctrl+C"
echo ""

arch=$(uname -m 2>/dev/null || echo unknown)
os=$(uname -s 2>/dev/null || echo unknown)
if [[ "$os" == "Darwin" ]]; then
  echo "On macOS use: rulet-helper-mac.sh"
  echo "  curl -fsSL $BASE_URL/download/rulet-helper-mac.sh -o rulet-helper-mac.sh"
  echo "  chmod +x rulet-helper-mac.sh && ./rulet-helper-mac.sh"
  exit 1
fi
if [[ "$os" != "Linux" ]] || [[ "$arch" != "x86_64" && "$arch" != "amd64" ]]; then
  echo "This script is for Linux x86_64."
  echo "Windows: download rulet-helper.ps1 from $BASE_URL/contribute.html"
  echo "macOS:   download rulet-helper-mac.sh"
  exit 1
fi

mkdir -p "$DIR/ui/brand" "$DIR/ui/download" "$DIR/ui/legal"
cd "$DIR"

sync_ui() {
  echo "Syncing chat UI from $BASE_URL …"
  local files=(
    index.html live.html contribute.html safety.html
    home.css style.css live-stage.css
    i18n.js identity.js hubs.js webrtc.js live.js sw.js
    analytics.js pwa-install.js
    hubs.json favicon.svg manifest.webmanifest robots.txt
  )
  local f
  for f in "${files[@]}"; do
    curl -fsSL "$BASE_URL/$f" -o "$DIR/ui/$f" 2>/dev/null || true
  done
  # Brand assets (best-effort)
  for f in logo-mark.png favicon-32.png apple-touch-icon-180.png logo-hero.jpg icon-192.png; do
    curl -fsSL "$BASE_URL/brand/$f" -o "$DIR/ui/brand/$f" 2>/dev/null || true
  done
  for f in community.html privacy.html terms.html eula.html legal.css; do
    curl -fsSL "$BASE_URL/legal/$f" -o "$DIR/ui/legal/$f" 2>/dev/null || true
  done
  # i18n packs (best-effort)
  mkdir -p "$DIR/ui/i18n"
  for f in en.json ru.json uk.json es.json de.json fr.json pt.json tr.json pl.json zh.json meta.json; do
    curl -fsSL "$BASE_URL/i18n/$f" -o "$DIR/ui/i18n/$f" 2>/dev/null || true
  done
  # Fallback minimal pages if seed was unreachable
  if [[ ! -f "$DIR/ui/live.html" ]]; then
    cat >"$DIR/ui/index.html" <<'HTML'
<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>ruletka helper</title>
<style>body{font-family:system-ui;background:#0a0b0e;color:#e8eef7;padding:2rem;max-width:36rem;margin:0 auto;line-height:1.5}
a{color:#5b9dff}</style></head><body>
<h1>Helper online</h1>
<p>Could not download full UI. Build from source: see project README (LGPL-2.1).</p>
</body></html>
HTML
    cp "$DIR/ui/index.html" "$DIR/ui/live.html"
  fi
  # Local directory seed: this helper + main seed for client failover
  cat >"$DIR/ui/hubs.json" <<JSON
{
  "protocol": "ruletka-directory/1",
  "notes": "Helper island + seed hub",
  "hubs": [
    { "base": "$BASE_URL", "name": "seed", "operator": "seed" }
  ]
}
JSON
}

sync_ui

if [[ ! -x "$BIN" ]]; then
  echo "Downloading bridge binary…"
  curl -fsSL "$BASE_URL/download/roulette-bridge-linux-amd64" -o "$BIN.tmp"
  # Verify against published SHA256SUMS when available
  if curl -fsSL "$BASE_URL/download/SHA256SUMS" -o "$DIR/SHA256SUMS" 2>/dev/null; then
    expect=$(awk '/roulette-bridge-linux-amd64$/ {print $1; exit}' "$DIR/SHA256SUMS" || true)
    if [[ -n "$expect" ]] && command -v sha256sum >/dev/null 2>&1; then
      got=$(sha256sum "$BIN.tmp" | awk '{print $1}')
      if [[ "$got" != "$expect" ]]; then
        echo "ERROR: checksum mismatch for roulette-bridge-linux-amd64" >&2
        echo "  expected: $expect" >&2
        echo "  got:      $got" >&2
        rm -f "$BIN.tmp"
        exit 1
      fi
      echo "  ✓ SHA256 verified"
    fi
  fi
  chmod +x "$BIN.tmp"
  mv "$BIN.tmp" "$BIN"
fi

CF_CMD=""
if command -v cloudflared >/dev/null 2>&1; then
  CF_CMD=$(command -v cloudflared)
elif [[ -x "$DIR/cloudflared" ]]; then
  CF_CMD="$DIR/cloudflared"
else
  echo "Downloading cloudflared (free HTTPS tunnel)…"
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
    -o "$DIR/cloudflared"
  chmod +x "$DIR/cloudflared"
  CF_CMD="$DIR/cloudflared"
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
  # No federation/admin secrets — cannot take over seed hub
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
  "$BIN" \
    --mode simple \
    --listen "127.0.0.1:${PORT}" \
    --ui-dir "$DIR/ui" \
    --friends-file "$DIR/friends.json" \
    >>"$DIR/bridge.log" 2>&1 &
  BRIDGE_PID=$!
  sleep 0.6
  if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
    echo "Bridge failed to start. Last log lines:"
    tail -30 "$DIR/bridge.log" || true
    exit 1
  fi
}

echo "Starting local bridge on http://127.0.0.1:${PORT}/ …"
start_bridge ""

echo "Starting HTTPS tunnel…"
LOG="$DIR/tunnel.log"
: >"$LOG"
"$CF_CMD" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate >>"$LOG" 2>&1 &
TUNNEL_PID=$!

PUBLIC=""
for _ in $(seq 1 50); do
  PUBLIC=$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1 || true)
  [[ -n "$PUBLIC" ]] && break
  sleep 0.4
done

if [[ -n "$PUBLIC" ]]; then
  # Re-bind with public base so /v1/directory advertises this island
  start_bridge "$PUBLIC"
  # Update local hubs.json to include self
  cat >"$DIR/ui/hubs.json" <<JSON
{
  "protocol": "ruletka-directory/1",
  "hubs": [
    { "base": "$PUBLIC", "name": "this helper", "operator": "helper" },
    { "base": "$BASE_URL", "name": "seed", "operator": "seed" }
  ]
}
JSON
fi

LOCAL_LIVE="http://127.0.0.1:${PORT}/live.html"
echo ""
echo "  ✓ Helper hub is running (independent match pool)"
echo "  Local:  $LOCAL_LIVE"
if [[ -n "$PUBLIC" ]]; then
  echo "  Public: $PUBLIC/live.html"
  echo ""
  echo "  Share that Public URL — friends can chat on YOUR hub"
  echo "  even if the seed site is offline."
  if command -v xclip >/dev/null 2>&1; then
    printf '%s' "$PUBLIC/live.html" | xclip -selection clipboard 2>/dev/null && echo "  (Public URL copied to clipboard)"
  elif command -v wl-copy >/dev/null 2>&1; then
    printf '%s' "$PUBLIC/live.html" | wl-copy 2>/dev/null && echo "  (Public URL copied to clipboard)"
  fi
  echo ""
  echo "  Optional: ask operators to federate your node into a shared pool"
  echo "  (shared token + allowlist). You still won't control the seed site."
  curl -fsS -X POST "$BASE_URL/v1/seeder/request" \
    -H 'Content-Type: application/json' \
    -d "{\"public_base\":\"$PUBLIC\",\"instance_id\":\"$INSTANCE_ID\",\"note\":\"helper-island\"}" \
    >/dev/null 2>&1 || true
else
  echo "  Public tunnel not ready yet — see $LOG"
fi
echo ""
echo "  Open source · LGPL-2.1 · docs/DECENTRALIZATION.md"
echo "  Press Ctrl+C to stop."
echo ""

if [[ "${RULETKA_NO_BROWSER:-0}" != "1" ]]; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$LOCAL_LIVE" >/dev/null 2>&1 || true
    echo "  Opened browser → local live chat"
  fi
fi

wait "$BRIDGE_PID" 2>/dev/null || true
