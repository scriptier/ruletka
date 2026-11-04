# T12-finish-partyCap-prod — RESULT

## Status
**COMPLETE** (read-only curl + disk grep + FINISH residual honesty — **no deploy**)

## OWN
- `knowledge/specs/FINISH-PLAY-MULTI.md` residual only (partyCap disk vs prod)
- RESULT under `tasks/grok-loop/done/`
- No product code edits
- No deploy / APK / phone adb
- **No invent multi PASS / GOAL_MET**

## Goal
FINISH residual: **partyCap on disk (4) not prod (0) until deploy**. Honesty only.

## Measured (2026-08-12T02:44:54Z UTC)

### Commands

```bash
grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=' ui/live.html
grep -c partyCap ui/live.js
grep -n partyCap ui/live.js
curl -sS -m 25 -D /tmp/t12-prod-live.hdr -o /tmp/t12-prod-live.html 'https://ruletka.vip/live.html'
curl -sS -m 30 -o /tmp/t12-prod-live.js 'https://ruletka.vip/live.js'
curl -sS -m 30 -o /tmp/t12-prod-live.js_v_561 'https://ruletka.vip/live.js?v=561'
curl -sS -m 30 -o /tmp/t12-prod-live.js_v_562 'https://ruletka.vip/live.js?v=562'
grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=' /tmp/t12-prod-live.html
grep -c partyCap /tmp/t12-prod-live.js /tmp/t12-prod-live.js_v_561 /tmp/t12-prod-live.js_v_562
md5sum /tmp/t12-prod-live.js /tmp/t12-prod-live.js_v_561 /tmp/t12-prod-live.js_v_562 ui/live.js
```

### HTML pins — prod vs disk

| Asset | Prod `https://ruletka.vip/live.html` (HTTP **200**) | Disk `ui/live.html` | Gap |
|-------|------------------------------------------------------|---------------------|-----|
| **live.js** | **`?v=561`** (preload + script) | **`?v=562`** | **prod lags by 1** |
| **live-stage.css** | **`?v=384`** | **`?v=386`** | **prod lags by 2** |
| **webrtc.js** | `?v=315` | `?v=315` | none |

Confirm:

```text
# disk
live-stage.css?v=386
live.js?v=562
webrtc.js?v=315
live.js?v=562

# prod
live-stage.css?v=384
live.js?v=561
webrtc.js?v=315
live.js?v=561
```

- Prod live.html `Last-Modified: Wed, 12 Aug 2026 01:42:46 GMT`
- live.html same byte length (190 499); disk md5 `ebb13ddf…`

### partyCap — disk vs prod (core residual)

| Source | Size (bytes) | `grep -c partyCap` | md5 / sha256 prefix | Notes |
|--------|--------------|--------------------|---------------------|-------|
| Disk `ui/live.js` | **1 126 268** | **4** | md5 `e1bc4208…` · sha256 `c0c8ccc18216bcd7…` | unminified; `_t("log.partyCap")` at L26899, L26992, L27182, L27189 |
| Prod bare `live.js` | **647 770** | **0** | md5 `62926cd4…` · sha256 `fee7bd44bd2583f0…` | minified older ship |
| Prod `live.js?v=561` | **647 770** | **0** | same as bare | identical body |
| Prod `live.js?v=562` | **647 770** | **0** | same as bare | CDN ignores tip; **not** disk 562 |

- Prod serves **one** minified body for any `?v=` (cache-bust query only).
- Prod `?v=562` URL does **not** deliver disk 562 / partyCap content until human deploy.
- Matches T8 / T9 / T11 measurements (lag unchanged this hop).

## What changed in FINISH-PLAY-MULTI.md

1. **Progress stamp** → Grok T12-finish-partyCap-prod — disk **562/386**; **partyCap disk 4 / prod 0** called out; human deploy open; multi still **human-smoke-open**.
2. **Residual honesty #4** — re-curl stamp **T12 @ 02:44Z**; explicit partyCap **4 vs 0** residual until deploy.
3. **Evidence** — T11 partyCap-grep + this T12 residual RESULT.

Ship tip table / A* progress rows **unchanged** (disk tip still **562 / 386**; A6 partyCap still **code-shipped** on disk only). No product GOAL_MET.

## Verdict

| Check | Result |
|-------|--------|
| Disk partyCap count | **4** (`_t("log.partyCap")` ×4 joinPeers) |
| Prod live.js partyCap count | **0** (bare + v=561 + v=562) |
| Disk HTML pins | **live.js?v=562** · **live-stage.css?v=386** · webrtc **315** |
| Prod HTML pins | **live.js?v=561** · **live-stage.css?v=384** · webrtc **315** |
| disk partyCap == prod? | **NO** — **4 ≠ 0** until human deploy |
| Deploy needed? | **YES (human)** — not done this task |
| Multi / Friends / Settings / Play Console | **not claimed** — no invent PASS |

**Summary:** Residual confirmed. **partyCap on disk (4); prod still 0.** Prod live.js **561** / stage **384** lag disk **562** / **386**. Human deploy remains open.

## Explicit non-claims (no invent PASS)

- Did **not** deploy / run `push.sh` / claim browser tip live
- Did **not** mark multi A1–A5 / A6 human smoke GOAL_MET
- Did **not** invent Friends / Settings full Play PASS
- Did **not** invent AAB / Play Console complete
- Did **not** edit product / UI / mobile code (FINISH residual stamp only)
- Did **not** treat prod `?v=562` URL as disk 562 / partyCap content

## Not done (by design)

- No product / UI / mobile edits (except FINISH residual honesty)
- No deploy / APK / AAB / git push
- No invent multi PASS / GOAL_MET
- No close human-smoke-open gates

## Connect risk

**None** — read-only HTTP + disk compare + FINISH residual honesty. No ICE / pool / MediaSession / live.js body / webrtc / Android media touch.

## Files

- `/home/drakosik/freenet-roulette/knowledge/specs/FINISH-PLAY-MULTI.md`
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/T12-finish-partyCap-prod-RESULT.md` (this RESULT)
- Card: `tasks/grok-loop/running/T12-finish-partyCap-prod.md` → done

## Upstream

- `tasks/grok-loop/done/T11-partyCap-grep-RESULT.md` — partyCap disk **4** / prod **0** grep
- `tasks/grok-loop/done/T9-finish-prod-lag-RESULT.md` — prod pin lag residual
- `tasks/grok-loop/done/T8-prod-livejs-check-RESULT.md` — first curl proof prod **561** vs disk **562**

## COMPLETE

**COMPLETE.** partyCap **disk 4 / prod 0**. Human deploy open. No invent multi PASS.
