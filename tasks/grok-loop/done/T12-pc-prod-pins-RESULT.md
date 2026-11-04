# T12 PC prod pins curl+boot soft — RESULT

## Status
**COMPLETE**

## OWN
- PC only: curl prod + disk `ui/live.html` pin compare
- Optional `BUDGET_MS=15000` `scripts/phone-web-pair.mjs`
- RESULT under `tasks/grok-loop/done/`
- No phone adb, no deploy, no product code edits

## Goal
curl prod live.html pins vs disk; optional BUDGET 15s web-pair boot.
Expect disk: live.js **562**, stage **386**.

## When
2026-08-12T02:46:56Z → ~02:47:33Z (UTC)

## 1) Prod curl pins

```bash
curl -sS https://ruletka.vip/live.html | grep -E 'live\.js\?v=|webrtc|live-stage'
```

| Line (prod HTML) | Pin |
|------------------|-----|
| L395 | `live-stage.css?v=384` |
| L397 | `live.js?v=561` (preload) |
| L3031 | `webrtc.js?v=315` |
| L3032 | `live.js?v=561` (script) |

Also comment L98: live-stage.css + live.js (no version).

## 2) Disk `ui/live.html` pins

```bash
grep -nE 'live\.js\?v=|webrtc|live-stage' ui/live.html
```

| Line | Pin |
|------|-----|
| L395 | `live-stage.css?v=386` |
| L397 | `live.js?v=562` (preload) |
| L3031 | `webrtc.js?v=315` |
| L3032 | `live.js?v=562` (script) |

**Disk matches expected tip:** live.js **562**, stage **386**.

## Version table — prod vs disk

| Asset | Prod `https://ruletka.vip/live.html` | Disk `ui/live.html` | Match |
|--------|--------------------------------------|---------------------|-------|
| **live.js** | `?v=561` | `?v=562` | **NO — prod lags by 1** |
| **webrtc.js** | `?v=315` | `?v=315` | yes |
| **live-stage.css** | `?v=384` | `?v=386` | **NO — prod lags by 2** |

### Body size context

| Surface | live.js | live-stage.css | live.html |
|---------|---------|----------------|-----------|
| PROD download size | **647 770** B | **387 279** B | **190 499** B |
| DISK `ui/` | **1 126 268** B | **539 625** B | **190 499** B |

Prod JS/CSS bodies still older/smaller than disk (not only query stamps). live.html size matches (190 499).

### Prod headers (context)
- `live.html` last-modified: **Wed, 12 Aug 2026 01:42:46 GMT**; content-length 190499
- `live.js` last-modified: **Wed, 12 Aug 2026 01:43:03 GMT**
- `live-stage.css` last-modified: **Wed, 12 Aug 2026 01:43:07 GMT**

## 3) Optional web-pair boot (15s)

```bash
BUDGET_MS=15000 CHROME=/usr/bin/chromium node scripts/phone-web-pair.mjs
```

- **URL:** `https://ruletka.vip/live.html`
- **Chrome:** `/usr/bin/chromium`
- **Budget:** 15000 ms
- **Exit:** **0**
- **When:** 02:47:04 → 02:47:33 UTC

### Boot verdict

| Check | Result |
|--------|--------|
| Chromium launch | **ok** |
| Page load | **ok** |
| Fake media / devices | **ok** — `1 cam · 3 mic · 3 out`, preview `fake_device_0` |
| ICE groups / TURN | **ok** — `ICE: 3 group(s) · TURN on` |
| Start control | **ok** — clicked `#btn-start-match` (+ reclick) |
| live.js loads / app runs | **ok** — queue + match path on prod tip **561** |
| Process exit | **0** (DONE budget elapsed) |

**BOOT: ok**

### Soft runtime notes (not scorecard / not GOAL_MET)
- First hop: matched WebPair · solo; kickSolo; ice connected; first frame +3968ms; `av_path` fin/fout >0 wave_2000/5000 — **soft A/V progress only**, not invent PASS/GOAL_MET.
- Later reclick / second match attempt mid-budget; snapshot ages often `matched:false` / empty `pcs` (body trust).
- warmIcePool `policy=all prime=skip` and relay path logged.
- nsfw `Failed to fetch` noise (non-blocking for boot).
- Screenshot: `mobile/artifacts/device-smoke/web-pair-1786502852947.png`

## Soft notes (not GOAL_MET)
- Pin lag unchanged vs T8 (~02:36Z): prod **live.js 561** / **stage 384** vs disk **562** / **386**.
- webrtc **315** prod == disk.
- Human deploy still required to ship tip **562** + stage **386** (and full disk JS/CSS bodies). This task did **not** deploy.
- **No invent GOAL_MET.** Task is curl pin compare + optional boot only.

## Explicit non-claims / must-not
- No deploy, no APK, no phone adb
- No force-push
- No product code edits
- No invent GOAL_MET / A/V PASS scorecard
- Budget 15s only (optional boot)

## Connect risk
**None for this hop** — read-only prod curl + disk compare + short PC Chromium boot.

## Done criteria
- [x] curl prod live.html pins (live.js / webrtc / live-stage)
- [x] grep same on disk `ui/live.html` (live.js **562**, stage **386**)
- [x] Version table prod vs disk; lag soft-noted
- [x] Optional 15s web-pair boot (exit 0, **BOOT: ok**)
- [x] No invent GOAL_MET
- [x] RESULT COMPLETE

## COMPLETE or BLOCKED
**COMPLETE**
