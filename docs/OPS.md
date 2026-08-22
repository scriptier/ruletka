# Operator guide (ruletka.vip / roulette-bridge)

Short checklist for running a public hub without full-time moderators.

## Production paths (DigitalOcean droplet example)

| Path | Purpose |
|------|---------|
| `/opt/ruletka/bin/roulette-bridge` | Bridge binary |
| `/opt/ruletka/ui/` | Static UI |
| `/opt/ruletka/data/friends.json` | Friends, blocks, report tallies, match bans, star cache |
| `/opt/ruletka/data/star_ledger.jsonl` | **Authoritative** star balances (append-only mint/spend log) |
| `/opt/ruletka/data/metrics.jsonl` | Daily hub counters |
| `/opt/ruletka/backups/` | Rotating tarballs from `backup-ruletka-data.sh` |
| `/opt/ruletka/data/admin.env` | `ROULETTE_ADMIN_TOKEN=…` |
| `/opt/ruletka/data/turn.env` | coturn secret (`ROULETTE_TURN_SECRET`) |
| `/opt/ruletka/data/analytics.env` | optional Metrica/GA public ids |
| `/opt/ruletka/data/mod.env` | optional `ROULETTE_MOD_WEBHOOK_URL=…` |
| `/opt/ruletka/data/federation_peers.json` | live claim peers (admin UI) |
| `/opt/ruletka/data/directory_hubs.json` | client failover directory |

Admin UI: `https://your-hub/admin.html` (token from `admin.env`).

## Deploy safety (do not wipe hub data)

`scripts/deploy/push.sh` syncs **only** `bin/`, `ui/`, and `deploy/`.

| Path | On deploy |
|------|-----------|
| `/opt/ruletka/bin`, `ui`, `deploy` | Replaced (`rsync --delete` inside each) |
| `/opt/ruletka/data/*` | **Preserved** (friends, ledger, metrics, `*.env`) |
| `/opt/ruletka/backups/*` | **Preserved** |

Never `rsync --delete` the whole `/opt/ruletka` tree — that once wiped backups and recreated `admin.env` / `turn.env`. First install still seeds empty `friends.json` only if the file is missing. After deploy, admin token is the one already in `data/admin.env` (create-once in `install-on-server.sh`).

## TURN / Hide IP (coturn)

Prod coturn listens on **`turn:ruletka.vip:3478`** (UDP/TCP) with time-limited credentials from `turn.env`. Relay ports **49160–53160**. Config: `scripts/deploy/coturn.conf` + `setup-turn.sh`.

| Mode | Behavior |
|------|----------|
| Default WebRTC | STUN + TURN candidates (P2P preferred) |
| **Hide my IP** | Client `iceTransportPolicy: "relay"` — media only via TURN |

**TURNS** is TLS TURN. Coturn still listens on **5349**. Public **TCP 443** is **sslh**: HTTP ALPN (`h2` / `http/1.1`) → Caddy on **8443** (site + WSS); other TLS → coturn 5349. ICE lists **`turns:ruletka.vip:443?transport=tcp`** first, then **5349**. **RU/BY/IR/CN** `/config.json` lists TURNS before UDP (geo, 400ms cap). TCP 3478 is still advertised but dropped on the force_relay path. Certs: `ruletka-turns-certs.timer`. Mux: `scripts/deploy/setup-turns-443.sh` + `/etc/sslh.cfg`. Rollback: `systemctl stop sslh`; restore Caddyfile `https_port 8443` block; `systemctl reload caddy`. See `knowledge/specs/2026-08-21-ru-turns.md`.

Client A/V on relay uses matched higher jitter targets (see `webrtc.js` hide-IP path).

## Backups (friends + star ledger)

**Always backup and restore `friends.json` and `star_ledger.jsonl` together.**

- `star_ledger.jsonl` is the source of truth for ★ balances (hash-chained events).
- `friends.json` holds friendships, bans, edges, and a **cache** of star counts.
- Restoring an old `friends.json` alone cannot safely mint stars after the ledger exists
  (ledger wins on boot) — but you still lose audit history and risk operator confusion.
- Admin star grants must go through **Admin → Grant ★** (ledger `adjust`), not hand-edits.

### Manual backup / restore

```bash
# On the droplet
sudo bash /opt/ruletka/deploy/backup-ruletka-data.sh          # create tarball
sudo bash /opt/ruletka/deploy/backup-ruletka-data.sh list
sudo bash /opt/ruletka/deploy/backup-ruletka-data.sh restore \
  /opt/ruletka/backups/ruletka-data-YYYYMMDDTHHMMSSZ.tgz
```

Archives land in `/opt/ruletka/backups/ruletka-data-*.tgz` (default keep **14**).  
Env: `ROULETKA_DATA_DIR`, `ROULETKA_BACKUP_DIR`, `ROULETKA_KEEP`.

### Daily cron (recommended)

Prefer `/etc/cron.d` (survives empty root crontabs):

```bash
# /etc/cron.d/ruletka-backup — 03:15 UTC
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
15 3 * * * root /opt/ruletka/deploy/backup-ruletka-data.sh backup >>/var/log/ruletka-backup.log 2>&1
```

Or root crontab:

```bash
15 3 * * * /opt/ruletka/deploy/backup-ruletka-data.sh backup >>/var/log/ruletka-backup.log 2>&1
```

**Do not enable both** (would double-run at 03:15). Prod uses `cron.d`.

After restore the script stops `roulette-bridge`, writes files, then starts it again.

### Service worker / UI cache

`ui/sw.js` uses a small offline shell (`rulet-shell-vN`). **Live stack**
(`live.html`, `live.js`, `webrtc.js`, …) is **network-only** so deploys are not
stuck on old gift/star logic. Clients poll for SW updates ~15 min and show an
**Update available → Reload** banner (no mid-call forced reload).

When changing the SW shell list, bump `CACHE` in `sw.js`.

### Performance (deploy)

- Caddy: `encode gzip zstd` + long `Cache-Control` for `*.js` / `*.css` / images
  (`?v=` query busts). HTML: 60s. See `scripts/deploy/Caddyfile`.
- Minify on ship: `scripts/deploy/optimize-ui.sh` (run from `push.sh` staging).
- Live fonts: Inter + Noto only on first paint; saloon/pixel fonts load on demand.
- Empty brand video: `preload="none"` + `data-src` (loads when empty UI plays).

## Auto-moderation (no admin required)

| Reason | Weight needed | Match ban |
|--------|---------------|-----------|
| underage | 1 | 30 days |
| explicit / harassment / hate | 2 | 7 days |
| spam / other | 3 | 3 days |
| explicit_ai (on-device NSFW) | threshold + 1 | 7 days |

**Trusted reporters:** based on **effective trust** (peer post-chat ★ gifts only), not spendable balance. **≥100 effective trust** → report weight **2**; **≥250** → weight **3**. Hour bonuses and admin grants raise balance only (unless `admin:trust…`). Still unique per reporter — no spam stacking.

**Gifter floors (Phase D):** trusted needs **≥5** distinct gifters; senior needs **≥12**. Raw trust can sit high, but report tier / public badge use the capped effective score until diversity is met.

**Soft decay:** after **45 days** without trust activity, effective trust decays up to **50%** by day **180** idle (raw ledger trust is kept).

**Ban clawback:** auto match-ban appends a ledger `clawback` event burning ~**25%** balance (cap 100) and ~**35%** trust (cap 80) so banned accounts do not keep Senior power.

**Balance vs trust:** ledger balance spends on cosmetic gifts; trust is rebuilt from `mint:rate_partner` events (and optional `admin:trust`). Partner badges / friends list show **effective trust**.

**Star rate window:** first **3** unique partners can open the post-chat ★ gift after **5 minutes**; after that, **15 minutes** (unchanged). Hour mutual mint stays at 60 minutes. Client shows mid-chat progress toward the unlock.

**Matchmaking (soft trust rank):** among gender/tag-compatible candidates, the hub prefers mixed (new+known) over new↔new, and lightly boosts trusted/senior when **≥3 solos** are waiting. Never blocks a match when the pool is empty — FIFO rematch still works.

**Admin graph:** metrics `stars_ledger.graph` includes mutual gift pairs and **low_diversity** users (high trust, few gifters).

Reports are append-logged (JSONL under the friends data dir / reports path).  
Clients always **block + skip** locally after Report.

Public explanation: `/safety.html`.

## Donations (BTC / ETH)

Homepage footer links to `/donate.html` (beside Terms only).

Edit addresses on the droplet (or in the repo UI) then redeploy / rsync:

```bash
# /opt/ruletka/ui/donate-addresses.json
{
  "btc": "bc1q…your-bech32…",
  "eth": "0x…your-ethereum…",
  "eth_note": "Ethereum mainnet",
  "updated": "2026-07-31",
  "contact": "support@ruletka.me"
}
```

Empty `btc` / `eth` fields show “Address not published yet” (safe default).  
Never put seed phrases or private keys in this file — public receive addresses only.

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

## Deploys vs live calls

- **Video is P2P** — restarting the bridge does not relay media.
- Clients **keep WebRTC up** if media is live when the hub WebSocket drops, then re-hello.
- **UI refresh** is deferred until the user is idle (Next/Stop/leave). `/health` exposes `boot_id` + `ui_deploy` (from `ui/deploy.json` written by `push.sh`).
- Mid-call: soft banner “Update ready”; auto soft-reload after the call ends.

