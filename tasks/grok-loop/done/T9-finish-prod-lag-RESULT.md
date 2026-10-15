# T9-finish-prod-lag — RESULT

## Status
**COMPLETE** (read-only curl + FINISH residual honesty — **no deploy**)

## OWN
- `knowledge/specs/FINISH-PLAY-MULTI.md` residual only
- RESULT under `tasks/grok-loop/done/`
- No product code edits
- No deploy / APK / phone adb
- **No invent multi PASS / GOAL_MET**

## Goal
FINISH residual: prod **live.js 561** + stage **384** lag disk **562 / 386**. Human deploy open. Document honesty only.

## Measured (2026-08-12T02:39Z UTC)

### Commands

```bash
grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=' ui/live.html
curl -sS -m 20 -D /tmp/prod-live.hdr -o /tmp/prod-live.html 'https://ruletka.vip/live.html'
grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=' /tmp/prod-live.html
curl -sS -m 20 -o /tmp/prod-live.js 'https://ruletka.vip/live.js'
curl -sS -m 20 -o /tmp/prod-live.js_v_561 'https://ruletka.vip/live.js?v=561'
curl -sS -m 20 -o /tmp/prod-live.js_v_562 'https://ruletka.vip/live.js?v=562'
md5sum /tmp/prod-live.js /tmp/prod-live.js_v_561 /tmp/prod-live.js_v_562 ui/live.js
grep -c partyCap ui/live.js /tmp/prod-live.js
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

- Prod `Last-Modified: Wed, 12 Aug 2026 01:42:46 GMT` (live.html)
- live.html same byte length (190 499) but **different md5** (`30f1d183…` prod vs `ebb13ddf…` disk)

### live.js body — prod vs disk

| Source | Size (bytes) | md5 | Notes |
|--------|--------------|-----|-------|
| Disk `ui/live.js` | **1 126 268** | `e1bc4208eaf0500d1c8825e0b0aeec6b` | unminified; **partyCap count = 4** |
| Prod bare / `?v=561` / `?v=562` | **647 770** each | `62926cd4a5c292fd1f59a9873825ce4b` (all three identical) | minified; **partyCap count = 0** |

- Prod serves **one** minified body for any `?v=` (cache-bust query only).
- Prod `?v=562` URL does **not** deliver disk 562 content until human deploy.
- Matches T8-prod-livejs-check (same lag; re-confirmed this hop).

## What changed in FINISH-PLAY-MULTI.md

1. **Progress stamp** → Grok T9-finish-prod-lag — disk **562/386**; prod lag **561/384** called out; human deploy open; multi still **human-smoke-open**.
2. **Residual honesty #4** — rewritten with measured prod pins (T8 + T9 re-curl): prod `live.js?v=561` + stage `?v=384` vs disk `562` / `386`; partyCap absent on prod; deploy still human.
3. **Evidence** — T8 prod curl row + this T9 residual RESULT.

Ship tip table / A* progress rows **unchanged** (disk tip still **562 / 386**; still **code-shipped · human-smoke-open**). No product GOAL_MET.

## Verdict

| Check | Result |
|-------|--------|
| Disk HTML pins | **live.js?v=562** · **live-stage.css?v=386** · webrtc **315** |
| Prod HTML pins | **live.js?v=561** · **live-stage.css?v=384** · webrtc **315** |
| Prod pin == disk tip? | **NO** — live.js lags **1**; stage lags **2** |
| Prod body == disk 562? | **NO** — minified 647 770 ≠ source 1 126 268; no `partyCap` on prod |
| Deploy needed? | **YES (human)** — not done this task |
| Multi / Friends / Settings / Play Console | **not claimed** — no invent PASS |

**Summary:** Residual confirmed. **Prod lags disk: live.js 561 vs 562, stage 384 vs 386.** Human deploy remains open. Disk tip ≠ browser pickup.

## Explicit non-claims (no invent PASS)

- Did **not** deploy / run `push.sh` / claim browser tip live
- Did **not** mark multi A1–A5 GOAL_MET / human smoke PASS
- Did **not** invent Friends / Settings full Play PASS
- Did **not** invent AAB / Play Console complete
- Did **not** edit product / UI / mobile code
- Did **not** treat prod `?v=562` URL as disk 562 content

## Not done (by design)

- No product / UI / mobile edits
- No deploy / APK / AAB / git push
- No invent multi PASS / GOAL_MET
- No close human-smoke-open gates

## Connect risk

**None** — read-only HTTP + disk compare + FINISH residual honesty. No ICE / pool / MediaSession / live.js body / webrtc / Android media touch.

## Files

- `/home/drakosik/freenet-roulette/knowledge/specs/FINISH-PLAY-MULTI.md`
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/T9-finish-prod-lag-RESULT.md` (this RESULT)
- Card: `tasks/grok-loop/running/T9-finish-prod-lag.md` → done

## Upstream

- `tasks/grok-loop/done/T8-prod-livejs-check-RESULT.md` — first curl proof of prod **561** vs disk **562**
- `tasks/grok-loop/done/T7-finish-stamp-562-RESULT.md` — FINISH disk tip restamp **562 / 386**

## COMPLETE

**COMPLETE.** Prod **live.js?v=561** + stage **?v=384** still lag disk **562 / 386**. Human deploy open. No invent multi PASS.
