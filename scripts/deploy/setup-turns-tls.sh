#!/bin/bash
# Enable coturn TLS on 5349 (TURNS) using Caddy's Let's Encrypt certs.
# Does NOT bind 443. Restart coturn only if certs copy OK.
set -euo pipefail
DOMAIN="${DOMAIN:-ruletka.vip}"
CERT_DIR="/etc/turnserver"
CADDY_CERT_ROOT="/var/lib/caddy/.local/share/caddy/certificates"
CONF="${CONF:-/etc/turnserver.conf}"

crt=$(find "$CADDY_CERT_ROOT" -name "${DOMAIN}.crt" 2>/dev/null | head -1)
key=$(find "$CADDY_CERT_ROOT" -name "${DOMAIN}.key" 2>/dev/null | head -1)
if [[ -z "$crt" || -z "$key" ]]; then
  echo "no Caddy cert for $DOMAIN under $CADDY_CERT_ROOT" >&2
  exit 1
fi
mkdir -p "$CERT_DIR"
new_hash=$(sha256sum "$crt" "$key" | sha256sum | awk '{print $1}')
old_hash=""
if [[ -f "$CERT_DIR/fullchain.pem" && -f "$CERT_DIR/privkey.pem" ]]; then
  old_hash=$(sha256sum "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem" | sha256sum | awk '{print $1}')
fi
if [[ "$new_hash" == "$old_hash" ]] && grep -q '^tls-listening-port=5349' "$CONF"; then
  echo "TURNS certs unchanged — skip coturn restart"
  exit 0
fi
cp -f "$crt" "$CERT_DIR/fullchain.pem"
cp -f "$key" "$CERT_DIR/privkey.pem"
chown turnserver:turnserver "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem" 2>/dev/null || \
  chown debian-turnserver:debian-turnserver "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem"
chmod 640 "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem"

if ! grep -q '^tls-listening-port=5349' "$CONF"; then
  python3 - <<'PY'
from pathlib import Path
p = Path("/etc/turnserver.conf")
t = p.read_text()
if "tls-listening-port=5349" in t and not t.split("tls-listening-port=5349")[0].rstrip().endswith("#"):
    pass
else:
    block = """
tls-listening-port=5349
cert=/etc/turnserver/fullchain.pem
pkey=/etc/turnserver/privkey.pem
"""
    if "listening-port=3478" in t:
        t = t.replace("listening-port=3478", "listening-port=3478\n" + block.strip(), 1)
    else:
        t += block
    p.write_text(t)
print("coturn TLS 5349 enabled in", p)
PY
fi
ufw allow 5349/tcp comment 'TURNS' || true
systemctl restart coturn
sleep 1
systemctl is-active coturn
ss -lntup | grep -E '3478|5349' || true
echo "TURNS: turns:${DOMAIN}:5349?transport=tcp"
echo "Then append that URL to ROULETTE_TURN and restart roulette-bridge"
