# T8-prod-livejs-check — RESULT

## Status
**COMPLETE** (read-only curl + disk compare — **no deploy**)

## OWN
- RESULT under `tasks/grok-loop/done/` only
- No product code edits
- No deploy / APK / phone adb
- No invent multi PASS / GOAL_MET

## Goal
curl prod `live.js?v=` vs disk **562**. Soft rules.

## Measured (2026-08-12T02:35–02:36Z UTC)

### Commands

```bash
grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=' ui/live.html
curl -sS -m 20 'https://ruletka.vip/live.html' -o /tmp/prod-live.html
grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=' /tmp/prod-live.html
curl -sS -m 20 'https://ruletka.vip/live.js' -o /tmp/prod-live.js
curl -sS -m 20 'https://ruletka.vip/live.js?v=561' -o /tmp/prod-live.js_v_561
curl -sS -m 20 'https://ruletka.vip/live.js?v=562' -o /tmp/prod-live.js_v_562
md5sum /tmp/prod-live.js /tmp/prod-live.js_v_561 /tmp/prod-live.js_v_562 ui/live.js
wc -c /tmp/prod-live.js ui/live.js
```

### HTML version table — prod vs disk

| Asset | Prod `https://ruletka.vip/live.html` (HTTP **200**) | Disk `ui/live.html` | Gap |
|-------|------------------------------------------------------|---------------------|-----|
| **live.js** | **`?v=561`** (preload L397 + script L3032) | **`?v=562`** (L397 + L3032) | **prod lags disk by 1** |
| **live-stage.css** | `?v=384` | `?v=386` | prod lags by 2 (side note) |
| **webrtc.js** | `?v=315` | `?v=315` | none |

Confirm lines:

```text
# disk
395:  <link rel="stylesheet" href="live-stage.css?v=386" />
397:  <link rel="preload" href="live.js?v=562" as="script" />
3031:  <script src="webrtc.js?v=315" defer></script>
3032:  <script src="live.js?v=562" defer></script>

# prod
395:  <link rel="stylesheet" href="live-stage.css?v=384" />
397:  <link rel="preload" href="live.js?v=561" as="script" />
3031:  <script src="webrtc.js?v=315" defer></script>
3032:  <script src="live.js?v=561" defer></script>
```

HTML same byte length (190 499) but **different md5** (`30f1d183…` prod vs `ebb13ddf…` disk) — pins differ as above. Prod `Last-Modified: Wed, 12 Aug 2026 01:42:46 GMT`.

### live.js body — prod vs disk

| Source | HTTP | Size (bytes) | md5 | Form |
|--------|------|--------------|-----|------|
| Disk `ui/live.js` | n/a | **1 126 268** | `e1bc4208eaf0500d1c8825e0b0aeec6b` | unminified source (~34 532 lines) |
| Prod `live.js` | 200 | **647 770** | `62926cd4a5c292fd1f59a9873825ce4b` | minified ship (0 newlines) |
| Prod `live.js?v=561` | 200 | **647 770** | `62926cd4…` (same body) | minified |
| Prod `live.js?v=562` | 200 | **647 770** | `62926cd4…` (same body) | minified |

- Prod serves **one** minified body for bare + any `?v=` (cache-bust query only; Caddy does not map v= to a different file).
- Prod `?v=562` URL **does not** deliver disk 562 content — same bytes as 561 ship until human deploy.
- Prod `Last-Modified: Wed, 12 Aug 2026 01:43:03 GMT`; `Cache-Control: no-store` on bare `live.js`, `public, max-age=31536000, immutable` on `?v=` URLs.

### Content markers (soft honesty)

| Marker | Disk `ui/live.js` | Prod minified body |
|--------|-------------------|--------------------|
| `_t("log.partyCap")` / `partyCap` | **4** | **0** (absent) |
| `joinPeers` occurrences | 15 | 7 (minified names differ) |

Disk has partyCap i18n from T5/T6; prod minified ship does **not** contain the string `partyCap` — consistent with pre-562 / pre-partyCap deploy lag.

## Verdict

| Check | Result |
|-------|--------|
| Disk HTML pin | **`live.js?v=562`** |
| Prod HTML pin | **`live.js?v=561`** |
| Prod pin == disk 562? | **NO** — prod **lags by 1** |
| Prod body == disk body? | **NO** — minified 647 770 ≠ source 1 126 268; different md5 |
| Deploy needed for browser pickup of 562? | **YES (human)** — not done this task |
| Multi smoke | **not claimed** — no invent PASS |

**Summary:** Prod `https://ruletka.vip/live.html` still stamps **`live.js?v=561`**. Disk stamps **`live.js?v=562`**. Prod JS body is older minified ship (no `partyCap`); disk 562 source not on prod. **disk ≠ prod until human deploy.**

## Not done (by design)

- No product / UI / mobile edits
- No deploy / `push.sh` / APK / AAB
- No git push
- No invent multi PASS / GOAL_MET
- No skill / FINISH restamp (OWN is prod check RESULT only)

## Connect risk

**None** — read-only HTTP + disk compare. No ICE / pool / MediaSession / live.js body / webrtc / Android media touch.

## Files

- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/T8-prod-livejs-check.md` (task card)
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/T8-prod-livejs-check-RESULT.md` (this RESULT)

## COMPLETE

Prod **`live.js?v=561`** vs disk **`562`** — **MISMATCH / prod lag**. Body also not disk 562. No deploy. No invent multi PASS.
