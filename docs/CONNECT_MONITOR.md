# Connect monitor (live automation)

While you pair **Play ↔ browser**, run a live scorecard of hub + coturn instead of guessing.

## Quick start

### A) CLI (hub + coturn via SSH)

```bash
# Terminal A — watch production while you smoke
./scripts/connect-monitor.sh

# Optional: refresh every 3s, last 30 minutes, log JSONL
MIN=30 ./scripts/connect-monitor.sh --watch 3 --log

# One snapshot (for scripts / Claude / Grok)
./scripts/connect-monitor.sh --once
```

Requires SSH key: `~/.ssh/ruletka_ed25519` (same as `hub-match-speed.sh`).

### B) Browser connect monitor (no SSH)

1. Open **https://ruletka.vip/admin-connect.html** (HTTP Basic + admin token).
2. Paste `ROULETTE_ADMIN_TOKEN` → **Start**.
3. Auto-refreshes every 5s while you pair phone + browser.
4. Full admin (reports/stars): **https://ruletka.vip/admin.html**

API: `GET /v1/admin/connect_live` with `Authorization: Bearer <token>` or `X-Admin-Token`.

In-memory since hub process start — pair once after deploy to fill.

## What it shows

| Block | Meaning |
|--------|---------|
| **Verdict** | `IDLE` / `OK` / `YELLOW` / `RED` |
| **MTO / MTA / MTI** | match→offer / answer / first ICE (ms) |
| **relay_candidates** | from hub logs (0 = black media path) |
| **web relay=0 / phone relay=0** | counts of bad first SDPs |
| **coturn** | ALLOCATE ok, CREATE_PERMISSION, peer_usage HOT vs zero |
| **recent lines** | last hub match/offer/answer/ice/drop |

### Verdict guide

| Color | Cause | What you do |
|-------|--------|-------------|
| **RED** | `relay_candidates=0` on offer or answer | Hard-refresh browser + install latest APK (`0.1.209+`) |
| **YELLOW** | TURN allocates but `peer_usage HOT=0` | Media not through coturn — often **CREATE_PERMISSION 403 Forbidden IP** when peer is our own external-ip (relay-to-relay). Fix: `allowed-peer-ip=<PUBLIC>` + `external-ip=PUBLIC/PRIVATE` in coturn (see `scripts/deploy/coturn.conf`). |
| **YELLOW** | answerer grace drops / offer thrash | Phone re-offering after answer — install latest APK |
| **OK** | SDP healthy | If UI still black → client paint / SurfaceView |
| **IDLE** | no matches | Start once on phone + PC |

## Related automation

| Tool | Role |
|------|------|
| `./scripts/connect-monitor.sh` | **Live** hub + coturn while you smoke |
| `./scripts/hub-match-speed.sh [min]` | One-shot hub scorecard |
| `./scripts/smoke-connect.sh --hub-only` | After human pair |
| `./scripts/dev-smoke.sh` | Local unit + pair-smoke before APK |
| `./scripts/pair-smoke.mjs` | Headless web↔web budgets |
| Settings → Connection last connect | Phone-side offer/answer/ice/frame ms |

## Smoke workflow (recommended)

```text
Terminal A:  ./scripts/connect-monitor.sh --log
Phone:       adb install -r mobile/artifacts/ruletka-android-latest.apk
Browser:     hard-refresh https://ruletka.vip/live.html
Both:        Start once, wait 15s, no Next spam
Watch A:     want OK + relay min≥1 + peer_usage HOT rising
```

JSONL logs land in `artifacts/connect-monitor/*.jsonl` when using `--log`.

## Browser console (optional)

After hard-refresh, DevTools → Console:

```text
[webrtc] offer first-relay count=N   ← want N ≥ 1 under force_relay
```

## Future upgrades (not built yet)

- Admin web page on hub (`/admin` connect live panel) — needs auth
- Push notify when RED (webhook)
- Phone logcat stream into the same scorecard
