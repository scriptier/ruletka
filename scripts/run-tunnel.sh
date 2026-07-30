#!/usr/bin/env bash
# Expose the local bridge with a public HTTPS URL so remote friends can join.
# Requires the bridge already running (./scripts/run-bridge.sh).
#
# Prefers cloudflared, then ngrok. Install one of:
#   cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
#   ngrok:       https://ngrok.com/download
#
# Outputs (repo root):
#   phone-url.txt   — full live.html URL
#   phone-qr.png    — QR to scan from phone
#
# Named Cloudflare tunnel (stable hostname), optional:
#   export TUNNEL_NAME=my-nextface
#   cloudflared tunnel run "$TUNNEL_NAME"   # if already configured
#   or set CLOUDFLARED_EXTRA args
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8790}"
TARGET="${TARGET:-http://127.0.0.1:${PORT}}"
URL_FILE="${URL_FILE:-$ROOT/phone-url.txt}"
QR_FILE="${QR_FILE:-$ROOT/phone-qr.png}"
LOG_FILE="${LOG_FILE:-/tmp/cf-tunnel.log}"

echo "Tunnel target: ${TARGET}"
echo "Make sure the bridge is up: ./scripts/run-bridge.sh"
echo

if ! curl -sf "${TARGET}/health" >/dev/null 2>&1; then
  echo "WARNING: ${TARGET}/health not reachable — start the bridge first."
  echo
else
  echo "Bridge health:"
  curl -sf "${TARGET}/health" | python3 -m json.tool 2>/dev/null || curl -sf "${TARGET}/health"
  echo
fi

export PATH="${HOME}/.local/bin:${PATH}"

write_url_artifacts() {
  local base="$1"
  base="${base%/}"
  # Homepage (CTA → live.html). Use /live.html for deep link if preferred.
  local page="${base}/"
  printf '%s\n' "$page" > "$URL_FILE"
  echo "Wrote $URL_FILE"
  echo "  → $page"
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<PY || true
import sys
page = """$page"""
try:
    import qrcode
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "-q", "qrcode[pil]"], stdout=subprocess.DEVNULL)
    import qrcode
img = qrcode.make(page)
img.save("""$QR_FILE""")
print("Wrote $QR_FILE (scan with phone)")
PY
  fi
}

if command -v cloudflared >/dev/null 2>&1; then
  # Named tunnel if TUNNEL_NAME set and configured
  if [[ -n "${TUNNEL_NAME:-}" ]]; then
    echo "Using named cloudflared tunnel: ${TUNNEL_NAME}"
    echo "Map hostname → ${TARGET} in Cloudflare Zero Trust dashboard if needed."
    exec cloudflared tunnel --no-autoupdate run "$TUNNEL_NAME"
  fi

  echo "Using cloudflared quick tunnel…"
  echo "Share the https://….trycloudflare.com URL + /live.html"
  echo "URL + QR written to phone-url.txt / phone-qr.png when ready."
  echo "Keep this process running while friends are connected."
  echo

  : > "$LOG_FILE"
  # Run cloudflared, tee log, and watch for URL
  (
    cloudflared tunnel --url "$TARGET" --no-autoupdate 2>&1 | tee "$LOG_FILE"
  ) &
  CF_PID=$!
  trap 'kill $CF_PID 2>/dev/null || true' EXIT INT TERM

  for _ in $(seq 1 60); do
    if grep -qoE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null; then
      BASE=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_FILE" | tail -1)
      write_url_artifacts "$BASE"
      # verify
      if curl -sf -o /dev/null -w '' --connect-timeout 15 "${BASE}/live.html"; then
        echo "Tunnel OK: ${BASE}/live.html"
      fi
      break
    fi
    sleep 0.5
  done

  wait "$CF_PID"
  exit $?
fi

if command -v ngrok >/dev/null 2>&1; then
  echo "Using ngrok…"
  echo "Open the https forwarding URL → /live.html"
  echo
  exec ngrok http "$PORT"
fi

cat <<EOF
No tunnel client found.

Install one of:
  • cloudflared  (recommended free quick tunnels)
  • ngrok

Then re-run:  ./scripts/run-tunnel.sh

LAN-only (same Wi‑Fi, no tunnel):
  1. ./scripts/run-bridge.sh
  2. Friends open http://YOUR_LAN_IP:${PORT}/live.html
  3. Note: Chrome often blocks camera on plain http://LAN_IP
     → prefer this tunnel for real cam/mic, or use localhost on this machine.

TURN (video across NATs):
  Default: free Open Relay TURN (demo).
  Own server:
    export ROULETTE_TURN=turn:your-turn-host:3478
    export ROULETTE_TURN_USER=…
    export ROULETTE_TURN_PASS=…
  Disable TURN:
    export ROULETTE_TURN=off
  ./scripts/run-bridge.sh
EOF
exit 1
