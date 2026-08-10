#!/usr/bin/env bash
# Regression lock: coturn must allow CreatePermission/ChannelBind to own public IP
# (force_relay web↔android = relay-to-relay on the same server).
# Usage: ./scripts/test-coturn-relay.sh
# Exit 0 = pass, 1 = fail. Safe to run from CI or after any coturn conf change.
set -euo pipefail

HOST="${HOST:-root@209.38.204.153}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=12)

echo "== coturn relay self-peer lock =="
out=$("${SSH[@]}" "$HOST" 'set -e
SECRET=$(grep ROULETTE_TURN_SECRET /opt/ruletka/data/turn.env | cut -d= -f2)
PUBLIC=$(grep -E "^external-ip=" /etc/turnserver.conf | head -1 | sed "s|.*=||;s|/.*||")
EXP=$(($(date +%s)+3600))
U="${EXP}:web"
P=$(printf %s "$U" | openssl dgst -sha1 -hmac "$SECRET" -binary | base64)
echo "external-ip line: $(grep ^external-ip= /etc/turnserver.conf)"
echo "public=$PUBLIC"
echo -n "self-peer: "
timeout 6 turnutils_uclient -v -u "$U" -w "$P" -e "$PUBLIC" -n 1 -m 1 127.0.0.1 2>&1 | tee /tmp/coturn-self.log | grep -E "channel bind: error|success: 0x" | head -1
echo -n "public-peer: "
timeout 6 turnutils_uclient -v -u "$U" -w "$P" -e 8.8.8.8 -n 1 -m 1 127.0.0.1 2>&1 | grep -E "channel bind: error|success: 0x" | head -1
if grep -q "channel bind: error" /tmp/coturn-self.log; then
  echo "FAIL: self-peer CreatePermission/ChannelBind rejected"
  exit 1
fi
if ! grep -q "success: 0x" /tmp/coturn-self.log; then
  echo "FAIL: no success bind for self-peer"
  exit 1
fi
echo "PASS: self-peer + public peer ChannelBind OK"
')
echo "$out"
echo "$out" | grep -q "^PASS:" 
echo "OK — coturn video path lock holds"
