#!/usr/bin/env bash
# Bootstrap Ubuntu droplet for ruletka.vip
# Run as root on the server (after upload of /opt/ruletka bundle).
set -euo pipefail

DOMAIN="${DOMAIN:-ruletka.vip}"
APP_DIR="${APP_DIR:-/opt/ruletka}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates ufw

# Caddy (official repo)
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

id -u ruletka >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin ruletka
# data/ + backups/ must outlive deploys (push.sh never rsyncs them)
mkdir -p "$APP_DIR"/{bin,ui,data,deploy,backups}
chown -R ruletka:ruletka "$APP_DIR"
# Keep secrets/root-owned files readable by bridge group after chown -R
for f in admin.env turn.env analytics.env mod.env; do
  if [[ -f "$APP_DIR/data/$f" ]]; then
    chown root:ruletka "$APP_DIR/data/$f" 2>/dev/null || true
    chmod 640 "$APP_DIR/data/$f" 2>/dev/null || true
  fi
done

if [[ ! -x "$APP_DIR/bin/roulette-bridge" ]]; then
  echo "Missing $APP_DIR/bin/roulette-bridge — upload the release bundle first"
  exit 1
fi

install -m 644 "$APP_DIR/deploy/roulette-bridge.service" /etc/systemd/system/roulette-bridge.service
install -m 644 "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
mkdir -p /var/log/caddy
chown caddy:caddy /var/log/caddy 2>/dev/null || true

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
# TURN (if setup-turn.sh already ran these are no-ops / duplicates ok)
ufw allow 3478/tcp || true
ufw allow 3478/udp || true
ufw allow 49160:49300/udp || true
ufw allow 49160:49300/tcp || true
# ufw --force enable  # enable only if you are sure SSH works
yes | ufw enable || true
ufw status || true

systemctl daemon-reload
systemctl enable --now roulette-bridge
systemctl enable --now caddy
systemctl restart roulette-bridge
systemctl restart caddy

# Optional: install/refresh self-hosted TURN when script present
if [[ -x "$APP_DIR/deploy/setup-turn.sh" ]]; then
  bash "$APP_DIR/deploy/setup-turn.sh" || echo "WARN: setup-turn.sh failed (bridge still runs)"
fi

# Admin token for /admin.html (create once if missing)
if [[ ! -f "$APP_DIR/data/admin.env" ]]; then
  TOKEN=$(openssl rand -hex 24 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
  echo "ROULETTE_ADMIN_TOKEN=${TOKEN}" >"$APP_DIR/data/admin.env"
  chmod 640 "$APP_DIR/data/admin.env"
  chown root:ruletka "$APP_DIR/data/admin.env" 2>/dev/null || true
  echo "Created $APP_DIR/data/admin.env (admin token) — open https://${DOMAIN}/admin.html"
  systemctl restart roulette-bridge || true
fi

sleep 1
echo "=== bridge ==="
systemctl --no-pager --full status roulette-bridge | head -15 || true
curl -sS -o /dev/null -w "local_bridge_live:%{http_code}\n" http://127.0.0.1:8790/live.html || true
curl -sS http://127.0.0.1:8790/health || true
echo
echo "=== caddy ==="
systemctl --no-pager --full status caddy | head -12 || true
echo
echo "Public (after TLS): https://${DOMAIN}/"
echo "Live:               https://${DOMAIN}/live.html"
