#!/usr/bin/env bash
# TURNS (TLS TURN on 5349, reached via the 443 mux) self-heal + cert sync.
# Installed as /usr/local/sbin/ruletka-turns-tls.sh (outside /opt/ruletka/bin,
# which push.sh rsyncs with --delete). Run by ruletka-turns-certs.timer.
# 1) copy Caddy's ruletka.vip cert/key into /etc/turnserver/ if they changed;
# 2) make sure /etc/turnserver.conf has the TLS listener lines;
# 3) restart coturn if the config changed, else SIGUSR2 (cert reload) if certs changed.
set -euo pipefail
DOMAIN="${TURN_DOMAIN:-ruletka.vip}"
CONF=/etc/turnserver.conf
DST=/etc/turnserver
SRC=$(ls -d /var/lib/caddy/.local/share/caddy/certificates/*/"$DOMAIN" 2>/dev/null | head -1 || true)
certs_changed=0; conf_changed=0
install -d -m 0750 -o turnserver -g turnserver "$DST"
if [[ -n "$SRC" && -s "$SRC/$DOMAIN.crt" && -s "$SRC/$DOMAIN.key" ]]; then
  if ! cmp -s "$SRC/$DOMAIN.crt" "$DST/fullchain.pem" || ! cmp -s "$SRC/$DOMAIN.key" "$DST/privkey.pem"; then
    install -m 0644 -o turnserver -g turnserver "$SRC/$DOMAIN.crt" "$DST/fullchain.pem"
    install -m 0600 -o turnserver -g turnserver "$SRC/$DOMAIN.key" "$DST/privkey.pem"
    certs_changed=1
  fi
else
  echo "WARN: no Caddy cert for $DOMAIN; keeping existing $DST/*.pem" >&2
fi
if [[ -s "$DST/fullchain.pem" && -s "$DST/privkey.pem" ]]; then
  for kv in "tls-listening-port=5349" "cert=$DST/fullchain.pem" "pkey=$DST/privkey.pem"; do
    k="${kv%%=*}"
    if ! grep -qE "^[[:space:]]*$k=" "$CONF"; then
      cp -a "$CONF" "$CONF.bak.$(date -u +%Y%m%dT%H%M%SZ)"
      echo "$kv" >>"$CONF"; conf_changed=1
    fi
  done
fi
if (( conf_changed )); then
  systemctl restart coturn; echo "coturn restarted (TLS config restored)"
elif (( certs_changed )); then
  systemctl kill -s USR2 coturn || systemctl restart coturn; echo "coturn certs reloaded"
else
  echo "TURNS ok: certs and config unchanged"
fi
