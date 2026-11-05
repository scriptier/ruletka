# Deploy the seed hub (operators)

For **community self-host**, prefer [`docs/SELF_HOST.md`](../../docs/SELF_HOST.md) (Docker / any VPS). This folder is the **seed-site** automation used for ruletka.vip-style deploys.

## What `push.sh` does

1. `cargo build -p freenet-roulette-bridge --release`
2. Stage `bin/`, `ui/` (minified), `deploy/` scripts
3. rsync **only** those trees to the server (never wipes `data/` or `backups/`)
4. Runs `install-on-server.sh` (Caddy, systemd, coturn setup if present)

```bash
./scripts/deploy/push.sh
# optional:
# HOST=root@your.server SSH_KEY=~/.ssh/your_key ./scripts/deploy/push.sh
```

## Server layout

| Path | Purpose |
|------|---------|
| `/opt/ruletka/bin/roulette-bridge` | Bridge binary |
| `/opt/ruletka/ui/` | Static UI |
| `/opt/ruletka/data/` | friends, star ledger, `*.env` secrets |
| `/opt/ruletka/backups/` | Rotating data tarballs |
| `/opt/ruletka/deploy/` | Install scripts copied from this repo |

See [`docs/OPS.md`](../../docs/OPS.md) for backups, TURN, stars, admin.

## First-time server

1. Provision a Linux VPS with Docker **or** bare metal + SSH as root/sudo.
2. Install your **own** SSH public key on the host (`~/.ssh/authorized_keys`). Do not commit private keys.
3. Point DNS A/AAAA at the host; use the sample `Caddyfile` (edit domain).
4. Run `push.sh` from a machine with Rust + SSH access.
5. Create secrets once on the server (`admin.env`, `turn.env`) — install scripts create them if missing; later deploys preserve them.

## TURN

`setup-turn.sh` + `coturn.conf` install coturn on **3478** (UDP/TCP). TURNS/443 is optional and conflicts with Caddy HTTPS on the same port unless you plan multi-IP or stream mux.

## Safety

- Never put production tokens in git.
- `push.sh` must **not** rsync-delete the whole `/opt/ruletka` tree (data + backups).
- After deploy: hard-refresh live once; check `/health` and `/config.json`.


## UDP TURN on 443 (connectivity 2026-11)

Clients can use `turn:ruletka.vip:443?transport=udp` when UDP 3478 is blocked.
Live since deploy `deployed-2026-11-04.6` (2026-11-05 UTC).

**How:** `ruletka-turn-udp443.service` (oneshot) adds
`iptables -t nat -I PREROUTING -d 209.38.204.153 -p udp --dport 443 -j REDIRECT --to-ports 3478`.
coturn itself is unchanged (still 3478 udp/tcp + 5349 TLS/DTLS).
We do **not** use coturn `alt-listening-port=443`: coturn 4.6.1 also binds TCP
on the alt port, HAProxy owns TCP/443, and coturn exits after ~60 s of retries.

**Install / verify (not done by `scripts/deploy.sh`):**

1. Caddy must keep `protocols h1 h2` (no HTTP/3 / QUIC on UDP 443).
2. `cp /opt/ruletka/deploy/ruletka-turn-udp443.service /etc/systemd/system/ &&
   systemctl daemon-reload && systemctl enable --now ruletka-turn-udp443`
3. `iptables -t nat -S PREROUTING | grep 'dport 443'` shows the REDIRECT.
   ufw needs no new rule: INPUT sees the redirected port (3478/udp, allowed).
4. Bridge drop-in `/etc/systemd/system/roulette-bridge.service.d/turns.conf`:
   `ROULETTE_TURN` includes `turn:ruletka.vip:443?transport=udp`
   (`setup-turns-443.sh` adds it), then `systemctl restart roulette-bridge`.
5. `/config.json` lists the udp 443 URL; `turn-alloc-test.py` passes on it.

Rollback: `systemctl disable --now ruletka-turn-udp443`, remove the udp 443 URL
from the bridge drop-in, `systemctl daemon-reload && systemctl restart roulette-bridge`.
