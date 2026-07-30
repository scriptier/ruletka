#!/usr/bin/env bash
# Publish the staged UI as a Freenet static website (web container).
# Prerequisites: freenet node on WS 7509, fdev on PATH.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.local/bin:${PATH}"
source "$HOME/.cargo/env" 2>/dev/null || true

PORT="${WS_API_PORT:-7509}"
KEY_NAME="${FREENET_SITE_KEY:-freenet-roulette}"
STAGE="$ROOT/target/webapp"
STATE_DIR="$ROOT/target/publish"
mkdir -p "$STATE_DIR"

echo "==> package webapp"
bash "$ROOT/scripts/package-webapp.sh" "$STAGE"

# Signing key (stable website contract address per key name)
if ! fdev website list 2>/dev/null | grep -q "$KEY_NAME"; then
  echo "==> fdev website init $KEY_NAME"
  fdev website init "$KEY_NAME"
fi

echo "==> fdev website publish (port $PORT, key $KEY_NAME)"
set +e
OUT=$(fdev -p "$PORT" website publish --key "$KEY_NAME" "$STAGE" 2>&1)
STATUS=$?
set -e
echo "$OUT" | tee "$STATE_DIR/website-publish.log"

# Parse contract / website key from output (best-effort)
KEY=$(echo "$OUT" | sed -n 's/.*Publishing contract \([A-Za-z0-9]*\).*/\1/p' | head -1)
if [[ -z "$KEY" ]]; then
  KEY=$(echo "$OUT" | sed -n 's/.*ContractInstanceId("\([^"]*\)").*/\1/p' | head -1)
fi
if [[ -z "$KEY" ]]; then
  KEY=$(echo "$OUT" | grep -oE '[A-HJ-NP-Za-km-z1-9]{32,}' | head -1)
fi

if [[ -n "$KEY" ]]; then
  echo "$KEY" > "$STATE_DIR/website-key.txt"
  URL="http://127.0.0.1:${PORT}/v1/contract/web/${KEY}/"
  echo "$URL" > "$STATE_DIR/website-url.txt"
  echo ""
  echo "=== Website contract key ==="
  echo "$KEY"
  echo "=== Open (local node) ==="
  echo "$URL"
  echo "Saved: $STATE_DIR/website-key.txt"
fi

# Always write a short manifest snippet
{
  echo "key_name=$KEY_NAME"
  echo "published_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "website_key=${KEY:-unknown}"
  echo "local_url=http://127.0.0.1:${PORT}/v1/contract/web/${KEY:-KEY}/"
} > "$STATE_DIR/website-manifest.txt"

if [[ $STATUS -ne 0 && -z "${KEY:-}" ]]; then
  echo "Website publish failed (is freenet running on :$PORT?)."
  exit "$STATUS"
fi
if [[ $STATUS -ne 0 ]]; then
  echo "(fdev exit $STATUS — check log; key may still be valid)"
fi
echo "OK publish-website"
