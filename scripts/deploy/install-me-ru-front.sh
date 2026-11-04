#!/usr/bin/env bash
# Install ruletka.me HTTPS front on a Moscow VPS (Yandex/Timeweb/Selectel).
# Usage: ./scripts/deploy/install-me-ru-front.sh <IPv4>
# Copies Caddyfile + LE certs from the Hetzner front. Does NOT change DNS.
# Does NOT touch coturn / .vip. pool=0.
set -euo pipefail
IP="${1:?usage: $0 <moscow-ipv4>}"
KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
HETZ=78.47.217.35
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CADDY="$ROOT/scripts/deploy/caddy-me-ru-front.Caddyfile"
# Yandex Cloud Ubuntu: login is ruletka (not root). Override with REMOTE_USER=.
REMOTE_USER="${REMOTE_USER:-ruletka}"
SSH=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -i "$KEY")
SCP=(scp -o BatchMode=yes -o StrictHostKeyChecking=accept-new -i "$KEY")

echo "==> $REMOTE_USER@$IP (Caddy + certs from $HETZ)"
"${SSH[@]}" "$REMOTE_USER@$IP" 'sudo bash -se' <<'EOS'
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg
if ! command -v caddy >/dev/null; then
  curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi
echo "net.ipv4.tcp_mtu_probing = 1" > /etc/sysctl.d/99-ruletka-pmtu.conf
sysctl -p /etc/sysctl.d/99-ruletka-pmtu.conf >/dev/null
EOS
"${SCP[@]}" "$CADDY" "$REMOTE_USER@$IP:/tmp/Caddyfile.me-ru"
"${SSH[@]}" "root@$HETZ" 'tar -C /var/lib/caddy -czf /tmp/caddy-certs.tgz .local/share/caddy/certificates 2>/dev/null || tar -C /var/lib/caddy -czf /tmp/caddy-certs.tgz .'
"${SCP[@]}" "root@$HETZ:/tmp/caddy-certs.tgz" /tmp/caddy-certs-me.tgz
"${SCP[@]}" /tmp/caddy-certs-me.tgz "$REMOTE_USER@$IP:/tmp/caddy-certs.tgz"
"${SSH[@]}" "$REMOTE_USER@$IP" 'sudo bash -se' <<'EOS'
set -e
cp /tmp/Caddyfile.me-ru /etc/caddy/Caddyfile
mkdir -p /var/lib/caddy
tar -C /var/lib/caddy -xzf /tmp/caddy-certs.tgz
chown -R caddy:caddy /var/lib/caddy
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy
systemctl is-active caddy
curl -skI --max-time 8 --resolve ruletka.me:443:127.0.0.1 https://ruletka.me | head -8
EOS
echo "OK guest. Next: GoDaddy add A @ $IP (keep 78.47.217.35). FRA trusted_proxies += $IP/32"
echo "Then: RU phone that cannot open Hetzner → https://ruletka.me  (no VPN)"
