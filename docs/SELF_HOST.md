# Self-host a ruletka hub

Anyone can run a **match + signaling** hub. Media stays **WebRTC peer-to-peer** between browsers (STUN/TURN only when needed).

**Seed site** [ruletka.vip](https://ruletka.vip) is one public hub, not the only network. Software: [github.com/scriptier/ruletka](https://github.com/scriptier/ruletka) · **LGPL-2.1-only**.

## 15-minute path (Docker)

Requirements: Docker + Compose v2.

```bash
git clone https://github.com/scriptier/ruletka.git
cd ruletka
docker compose up --build
```

Open:

| URL | Purpose |
|-----|---------|
| http://127.0.0.1:8790/ | Homepage |
| http://127.0.0.1:8790/live.html | Live chat (open **two tabs** to match) |
| http://127.0.0.1:8790/health | JSON health |
| http://127.0.0.1:8790/config.json | ICE / TURN flags |

Friends + star ledger data: Docker volume `hub-data` → `/opt/ruletka/data`.

Stop: `Ctrl+C` or `docker compose down` (volume kept unless `-v`).

## Without Docker

```bash
# Rust toolchain: https://rustup.rs
./scripts/run-bridge.sh
# → http://127.0.0.1:8790/live.html
```

Env knobs: [`.env.example`](../.env.example).

## Put it on the public internet

Browsers need **HTTPS** for camera/mic (except `localhost`).

1. Point DNS A/AAAA at your VPS.
2. Terminate TLS with **Caddy** or nginx (example Caddyfile in `scripts/deploy/Caddyfile` — adapt domain).
3. Proxy to `127.0.0.1:8790` (or publish the container on an internal network only).
4. Set:

```bash
export ROULETTE_PUBLIC_BASE=https://your-hub.example.com
export ROULETTE_INSTANCE_ID=my-hub
# optional admin UI:
export ROULETTE_ADMIN_TOKEN=$(openssl rand -hex 24)
```

Restart the bridge / compose after env changes.

## TURN (mobile / hard NATs)

Default demo uses a free open relay when `ROULETTE_TURN` is unset — fine for LAN and quick tests.

For production:

- Run **coturn** (`scripts/deploy/setup-turn.sh` / `coturn.conf` as a starting point).
- Prefer time-limited credentials (`ROULETTE_TURN_SECRET`).
- Set `ROULETTE_OPEN_TURN=false` once your TURN works.
- **TURNS on 443** is optional and conflicts with HTTPS on the same port unless you use a second IP or stream mux — see `docs/OPS.md`.

## Multi-hub directory

Clients can fail over using a public hub list:

- Seed file: `ui/hubs.json`
- Live merge: `GET /v1/directory`
- Env: `ROULETTE_DIRECTORY_HUBS=https://ruletka.vip,https://your-hub.example.com`

To list a community hub in the seed directory, see [`HUB_DIRECTORY.md`](HUB_DIRECTORY.md).

## Federation (optional)

Trusted operators can share a **stranger queue** (`nextface-fed/1`). Stars and friends stay **per hub**. Setup: [`INTEROP.md`](INTEROP.md).

## What you operate vs what users keep

| On the hub | On the device |
|------------|----------------|
| Matchmaking, signaling, chat text | Camera/mic tracks (P2P) |
| Friends graph, blocks, reports | Profile export (identity + friends backup) |
| Star **ledger** (balances / trust) | Prefs, local history |

Never commit `data/*.env`, admin tokens, or TURN secrets.

## Security baseline

See [`SECURITY.md`](../SECURITY.md) and [`OPS.md`](OPS.md):

- HTTPS everywhere public
- Self-hosted TURN when possible
- Strong `ROULETTE_ADMIN_TOKEN` if admin is exposed
- Federation peers are an **allowlist**, not open mesh trust

## Protocol for other clients

WebSocket JSON match + signal: [`PROTOCOL.md`](PROTOCOL.md).

## Brand

You may run any domain. Do **not** imply you operate **ruletka.vip** without permission. Software license ≠ trademark.
