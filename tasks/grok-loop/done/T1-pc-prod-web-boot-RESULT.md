# T1 PC prod live.html boot (headless) — RESULT

## Status
**COMPLETE**

## OWN
- `node scripts/phone-web-pair.mjs` short budget only (boot path)
- RESULT under `tasks/grok-loop/done/`
- No phone adb, no deploy

## Goal
Short Chromium boot against production live.html; note live.js version; soft note if prod lags disk **561**.

## Run
```bash
BUDGET_MS=20000 CHROME=/usr/bin/chromium node scripts/phone-web-pair.mjs
```
- **When:** 2026-08-12T02:11:44Z → ~02:12:21Z (UTC)
- **URL:** `https://ruletka.vip/live.html` (default)
- **Chrome:** `/usr/bin/chromium`
- **Budget:** 20000 ms
- **Exit:** **0**

## Boot verdict
| Check | Result |
|--------|--------|
| Chromium launch | **ok** |
| Page load (networkidle2) | **ok** |
| Fake media / devices | **ok** — `1 cam · 3 mic · 3 out`, preview `fake_device_0` |
| ICE groups / TURN | **ok** — `ICE: 3 group(s) · TURN on` |
| Start control | **ok** — clicked `#btn-start-match` |
| live.js loads / app runs | **ok** — queue + match path exercised |
| Process exit | **0** (DONE budget elapsed) |

**BOOT: ok**

## live.js version (prod vs disk)

| Source | live.js | webrtc.js | live-stage.css |
|--------|---------|-----------|----------------|
| **Prod** `https://ruletka.vip/live.html` (curl 200) | **`?v=561`** | `?v=315` | `?v=384` |
| **Disk** `ui/live.html` | **`?v=561`** | `?v=315` | `?v=385` |

- **live.js prod == disk 561** — **no lag** on the job tip stamp.
- Soft lag only on **stage CSS**: prod **384** vs disk **385** (not a live.js fail).

## Match note (soft — not claimed product GOAL)
Console during short budget (not exclusive phone agent; incidental live queue traffic):

1. First hop: `matched with Драконов · solo` → Force Relay → ICE connected ~4s → `first frame +4365ms` → `match connected (frames)`.
2. Reclick Start mid-budget (script n=2/5) briefly returned to lobby (`Online 6 Waiting 0`), then rematched same peer; second hop ICE ~2.7s, first frame ~3.1s.
3. Snapshot helper reported `matched:false` / empty `pcs` (page globals not exposed to evaluate the way the helper expects) while bodyHint showed **"In a call"** / **"Linking cameras…"** — trust **console + body**, not the snapshot `matched` flag.
4. Non-blocking noise: `[nsfw] TypeError: Failed to fetch`; `setParameters InvalidStateError` (getParameters never called). Not boot blockers.

**No GOAL_MET invent.** Match was incidental queue hit during boot stay; task is boot-only.

## Artifacts
- Log: `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/T1-pc-prod-web-boot-20260812T021143Z.log`
- Screenshot: `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/web-pair-1786500740328.png`
- RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/T1-pc-prod-web-boot-RESULT.md`

## Explicit non-claims / must-not
- No deploy, no APK/adb phone smoke
- No long thrash / exclusive phone-agent queue fight (budget 20s only)
- No invent GOAL_MET / product A/V PASS scorecard
- No product code edits

## Connect risk
**Low / none for this hop** — read-only prod boot; no ICE/pool policy code change.

## Done criteria
- [x] Short web-pair boot run + log captured
- [x] Boot ok/fail stated (**ok**)
- [x] live.js version noted (prod **561** = disk **561**)
- [x] Soft prod lag note (stage 384 vs disk 385 only)
- [x] Match note soft, no GOAL_MET invent
- [x] RESULT COMPLETE

## COMPLETE or BLOCKED
**COMPLETE**
