# Operator guide (ruletka.vip / roulette-bridge)

Short checklist for running a public hub without full-time moderators.

## Production paths (DigitalOcean droplet example)

| Path | Purpose |
|------|---------|
| `/opt/ruletka/bin/roulette-bridge` | Bridge binary |
| `/opt/ruletka/ui/` | Static UI |
| `/opt/ruletka/data/friends.json` | Friends, blocks, report tallies, match bans |
| `/opt/ruletka/data/admin.env` | `ROULETTE_ADMIN_TOKEN=…` |
| `/opt/ruletka/data/turn.env` | coturn secret |
| `/opt/ruletka/data/analytics.env` | optional Metrica/GA public ids |
| `/opt/ruletka/data/mod.env` | optional `ROULETTE_MOD_WEBHOOK_URL=…` |
| `/opt/ruletka/data/federation_peers.json` | live claim peers (admin UI) |
| `/opt/ruletka/data/directory_hubs.json` | client failover directory |

Admin UI: `https://your-hub/admin.html` (token from `admin.env`).

## Auto-moderation (no admin required)

| Reason | Unique reporters | Match ban |
|--------|------------------|-----------|
| underage | 1 | 30 days |
| explicit / harassment / hate | 2 | 7 days |
| spam / other | 3 | 3 days |
| explicit_ai (on-device NSFW) | threshold + 1 | 7 days |

Reports are append-logged (JSONL under the friends data dir / reports path).  
Clients always **block + skip** locally after Report.

Public explanation: `/safety.html`.

## Moderation webhook (Telegram / Slack / Discord)

Set HTTPS URL only:

```bash
# /opt/ruletka/data/mod.env
ROULETTE_MOD_WEBHOOK_URL=https://api.telegram.org/bot<BOT_TOKEN>/sendMessage?chat_id=<CHAT_ID>
```

Then:

```bash
systemctl restart roulette-bridge
```

| Provider | URL shape | Body we send |
|----------|-----------|--------------|
| **Telegram** | `https://api.telegram.org/botTOKEN/sendMessage?chat_id=…` | `{chat_id, text}` |
| **Discord** | `https://discord.com/api/webhooks/…` | `{content}` |
| **Slack** | `https://hooks.slack.com/services/…` | `{text}` |
| **Generic** | any HTTPS | `{text, content, ruletka: …}` |

Fires only on **new auto-ban** (not every report).

## Federation (shared stranger pool)

Requires cooperating operators + shared secret. **Not** for scraping closed commercial sites.

### Local two-hub demo

```bash
./scripts/run-federated-pair.sh
# Hub A: http://127.0.0.1:8790/live.html
# Hub B: http://127.0.0.1:8791/live.html
# Spin alone on each → mesh match chip when federated
```

### Production mesh (two HTTPS hubs)

On **both** hubs:

```bash
# shared secret (keep private)
export ROULETTE_FEDERATION_TOKEN='long-random-shared-secret'
export ROULETTE_PUBLIC_BASE=https://hub-a.example.com   # each hub its own public URL
# restart once after setting token + public_base
```

Then either:

1. **Admin → Mesh → Add claim peer** → peer’s `https://…` (live, no restart), or  
2. `ROULETTE_FEDERATION_PEERS=https://other-hub.example.com` (restart to change).

Directory hubs (failover discovery) are separate from claim peers — discovery ≠ trust.

Protocol: [`INTEROP.md`](INTEROP.md). Decentralization model: [`DECENTRALIZATION.md`](DECENTRALIZATION.md).

## Analytics (optional)

```bash
# /opt/ruletka/data/analytics.env
ROULETTE_YANDEX_METRICA_ID=12345678
ROULETTE_GA_ID=G-XXXXXXXX
systemctl restart roulette-bridge
```

Ids are public by design; published only via `/config.json` when set.

## Deploy

From a build machine with SSH key:

```bash
./scripts/deploy/push.sh
# HOST=root@… SSH_KEY=~/.ssh/ruletka_ed25519
```

## Health checks

```bash
curl -sS https://your-hub/health | jq .
curl -sS https://your-hub/v1/directory | jq .
curl -sS https://your-hub/v1/federation/info | jq .
```
