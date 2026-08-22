#!/bin/bash
# Mux public TCP 443: HTTPS/WSS → Caddy :8443, TURNS → coturn :5349.
# Does NOT set coturn tls-listening-port=443 (that would steal the site).
set -euo pipefail

CADDY_FILE="${CADDY_FILE:-/etc/caddy/Caddyfile}"
SSLH_DEFAULT="${SSLH_DEFAULT:-/etc/default/sslh}"
TURNS_DROPIN="${TURNS_DROPIN:-/etc/systemd/system/roulette-bridge.service.d/turns.conf}"
BACKUP_DIR="${BACKUP_DIR:-/root/ruletka-443-mux-backup}"

mkdir -p "$BACKUP_DIR"
ts=$(date -u +%Y%m%dT%H%M%SZ)
cp -a "$CADDY_FILE" "$BACKUP_DIR/Caddyfile.$ts"
[[ -f $SSLH_DEFAULT ]] && cp -a "$SSLH_DEFAULT" "$BACKUP_DIR/sslh.default.$ts"
[[ -f $TURNS_DROPIN ]] && cp -a "$TURNS_DROPIN" "$BACKUP_DIR/turns.conf.$ts"

if ! grep -q 'https_port 8443' "$CADDY_FILE"; then
  python3 - <<'PY'
from pathlib import Path
p = Path("/etc/caddy/Caddyfile")
t = p.read_text()
block = """{
	https_port 8443
	servers {
		protocols h1 h2
	}
}

"""
if "https_port 8443" not in t:
    p.write_text(block + t)
print("Caddyfile: https_port 8443 inserted")
PY
fi

caddy validate --config "$CADDY_FILE"

export DEBIAN_FRONTEND=noninteractive
echo "sslh sslh/inetd_or_standalone select standalone" | debconf-set-selections
apt-get install -y sslh

cat >"$SSLH_DEFAULT" <<'EOF'
DAEMON=/usr/sbin/sslh
DAEMON_OPTS="--user sslh --listen 0.0.0.0:443 --tls 127.0.0.1:8443 --anyprot 127.0.0.1:5349 --on-timeout tls"
EOF

systemctl reload caddy
sleep 1
if ss -lnt | grep -q ':8443'; then
  echo "Caddy on 8443"
else
  echo "Caddy did not bind 8443 — abort" >&2
  exit 1
fi

systemctl enable sslh
systemctl restart sslh
sleep 1
systemctl is-active sslh
systemctl is-active caddy

if [[ -f $TURNS_DROPIN ]]; then
  python3 - <<'PY'
from pathlib import Path
p = Path("/etc/systemd/system/roulette-bridge.service.d/turns.conf")
t = p.read_text()
want = "turns:ruletka.vip:443?transport=tcp"
if want not in t:
    t = t.replace(
        "turns:ruletka.vip:5349?transport=tcp",
        "turns:ruletka.vip:443?transport=tcp,turns:ruletka.vip:5349?transport=tcp",
    )
    if want not in t:
        t = t.rstrip() + f",{want}\n" if "ROULETTE_TURN=" in t else t
    p.write_text(t)
print(p.read_text())
PY
  systemctl daemon-reload
  systemctl restart roulette-bridge
fi

echo "--- listeners ---"
ss -lntup | grep -E ':443|:8443|:5349|:80 ' || true
echo "--- curl ---"
curl -sS -o /dev/null -w "https_vip:%{http_code} time:%{time_total}\n" --max-time 10 https://ruletka.vip/health || true
curl -sS -o /dev/null -w "https_8443:%{http_code}\n" --max-time 5 -k https://127.0.0.1:8443/health || true
echo "TURNS mux live: turns:ruletka.vip:443?transport=tcp → sslh → coturn 5349"
echo "Rollback: systemctl stop sslh; restore Caddyfile from $BACKUP_DIR; systemctl reload caddy"
