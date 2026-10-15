# T5 PC prod live.html boot + stage version — RESULT

## Status
**COMPLETE**

## OWN
- `scripts/phone-web-pair.mjs` short BUDGET only
- RESULT under `tasks/grok-loop/done/`
- No phone adb, no deploy

## Goal
Short Chromium boot prod live.html; note live.js / webrtc / stage `?v=` vs disk (disk stage **386**).

## Run
```bash
BUDGET_MS=20000 CHROME=/usr/bin/chromium node scripts/phone-web-pair.mjs
```
- **When:** 2026-08-12T02:27:29Z → ~02:27:59Z (UTC)
- **URL:** `https://ruletka.vip/live.html` (default)
- **Chrome:** `/usr/bin/chromium`
- **Budget:** 20000 ms
- **Exit:** **0**

## Boot verdict
| Check | Result |
|--------|--------|
| Chromium launch | **ok** |
| Page load | **ok** |
| Fake media / devices | **ok** — `1 cam · 3 mic · 3 out`, preview `fake_device_0` |
| ICE groups / TURN | **ok** — `ICE: 3 group(s) · TURN on` |
| Start control | **ok** — clicked `#btn-start-match` |
| live.js loads / app runs | **ok** — queue path exercised (`Online 2 Waiting 1`) |
| Process exit | **0** (DONE budget elapsed) |

**BOOT: ok**

## Version table — prod vs disk

| Asset | Prod `https://ruletka.vip/live.html` (curl HTTP 200) | Disk `ui/live.html` |
|--------|------------------------------------------------------|---------------------|
| **live.js** | `?v=561` | `?v=561` |
| **webrtc.js** | `?v=315` | `?v=315` |
| **live-stage.css** | `?v=384` | `?v=386` |

- **live.js** prod == disk **561** — no lag.
- **webrtc.js** prod == disk **315** — no lag.
- **live-stage.css** prod **384** vs disk **386** — **prod lags disk by 2** on stage CSS (soft note; not a boot fail).

Other pins (prod == disk): style.css 158, i18n 248, identity/hubs 156, live-brand 10, brand.js 2, analytics 4, pwa-install 12, web-push 1, geoLocalize 3, live-themes 2, brand assets v=9/10.

## Soft notes (not GOAL_MET)
- 20s budget: stayed in queue (`Waiting 1`); no match hop this run. Boot path still complete.
- Snapshot `matched:false` / empty `pcs` expected while waiting; trust console + body.
- warmIcePool `policy=all prime=skip` logged twice at start (pool soft path; no code change).
- Screenshot: `mobile/artifacts/device-smoke/web-pair-1786501679095.png`

**No invent GOAL_MET.** Task is boot + version pin note only.

## Explicit non-claims / must-not
- No deploy, no APK, no phone adb
- No force-push
- No product code edits
- No long thrash; budget 20s only
- No invent GOAL_MET / A/V PASS scorecard
- pool=0 soft (no ICE/pool policy change)

## Connect risk
**None for this hop** — read-only prod boot + curl version compare.

## Done criteria
- [x] Short web-pair boot run (exit 0)
- [x] Boot ok/fail stated (**ok**)
- [x] Version table prod vs disk (live.js / webrtc / stage)
- [x] Disk stage noted as **386**; prod stage **384** lag soft-noted
- [x] No invent GOAL_MET
- [x] RESULT COMPLETE

## COMPLETE or BLOCKED
**COMPLETE**
