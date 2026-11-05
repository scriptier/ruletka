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

`coturn.conf` sets `alt-listening-port=443` so clients can use
`turn:ruletka.vip:443?transport=udp` when UDP 3478 is blocked.

**Deploy-time steps (not done by `scripts/deploy.sh` alone):**

1. Confirm Caddy has `protocols h1 h2` only (no HTTP/3 / QUIC on UDP 443).
2. Install updated `coturn.conf` → `/etc/turnserver.conf` via
   `bash /opt/ruletka/deploy/setup-turn.sh` (or careful manual merge).
3. `systemctl restart coturn` and check `ss -ulnp | grep 443` shows coturn.
4. Confirm `ufw allow 443/udp` (install-on-server.sh already has it).
5. Ensure bridge `ROULETTE_TURN` includes `turn:ruletka.vip:443?transport=udp`
   (unit file / turn.env), then `systemctl restart roulette-bridge`.
6. Verify `/config.json` lists the udp 443 URL.

`deploy.sh` rsyncs `deploy/coturn.conf` to `/opt/ruletka/deploy/` and reloads
Caddy when the Caddyfile changes; it does **not** rewrite `/etc/turnserver.conf`
or restart coturn. UDP 443 is a deliberate extra step.
