# T8 PC prod boot live.js tip 562 — RESULT

## Status
**COMPLETE**

## OWN
- `BUDGET_MS=20000` `scripts/phone-web-pair.mjs` only
- RESULT under `tasks/grok-loop/done/`
- No phone adb, no deploy

## Goal
Short Chromium boot prod; note prod vs disk pins (disk live.js **562**, stage **386**).

## Run
```bash
BUDGET_MS=20000 CHROME=/usr/bin/chromium node scripts/phone-web-pair.mjs
```
- **When:** 2026-08-12T02:36:32Z → ~02:37:01Z (UTC)
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
| Start control | **ok** — clicked `#btn-start-match` (+ reclick) |
| live.js loads / app runs | **ok** — queue path (`Online 2→1 Waiting 1`) |
| Process exit | **0** (DONE budget elapsed) |

**BOOT: ok**

## Version table — prod vs disk

| Asset | Prod `https://ruletka.vip/live.html` (curl HTTP 200) | Disk `ui/live.html` |
|--------|------------------------------------------------------|---------------------|
| **live.js** | `?v=561` | `?v=562` (preload L397, script L3032) |
| **webrtc.js** | `?v=315` | `?v=315` (L3031) |
| **live-stage.css** | `?v=384` | `?v=386` (L395) |

### Pin lag (soft note — not boot fail)
- **live.js** prod **561** vs disk **562** — **prod lags disk by 1** (tip 562 not deployed).
- **webrtc.js** prod == disk **315** — no lag.
- **live-stage.css** prod **384** vs disk **386** — **prod lags disk by 2**.

Other pins (prod == disk): style.css 158, i18n 248, identity/hubs 156, live-brand 10, brand.js 2, analytics 4, pwa-install 12, web-push 1, geoLocalize 3.

### Body size context
| Surface | live.js | live-stage.css | live.html |
|---------|---------|----------------|-----------|
| PROD Content-Length | **647 770** B | **387 279** B | **190 499** B |
| DISK `ui/` | **1 126 268** B | **539 625** B | **190 499** B |

Prod JS/CSS bodies still older/smaller than disk (not only query stamps).

Prod shell: `last-modified: Wed, 12 Aug 2026 01:42:46 GMT` (live.html); live.js `01:43:03 GMT`.

## Soft notes (not GOAL_MET)
- 20s budget: stayed in queue (`Waiting 1`); no match hop. Boot path still complete.
- Snapshot `matched:false` / empty `pcs` expected while waiting; trust console + body.
- warmIcePool `policy=all prime=skip` logged (pool soft path; no code change).
- Screenshot: `mobile/artifacts/device-smoke/web-pair-1786502221591.png`
- Same lag pattern as T5 (stage 384 vs disk 386) plus **new live.js lag** after T6/T7 disk tip **561→562**.

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
- [x] Disk live.js **562** + stage **386** noted; prod **561** / **384** lag soft-noted
- [x] No invent GOAL_MET
- [x] RESULT COMPLETE

## COMPLETE or BLOCKED
**COMPLETE**
