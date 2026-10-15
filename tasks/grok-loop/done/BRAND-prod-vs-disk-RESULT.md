# BRAND prod vs disk — RESULT

## Status
**COMPLETE** (read-only curl + disk compare — **no deploy**)

## OWN
- RESULT under `tasks/grok-loop/done/` only
- No product code edits
- No deploy / push / APK

## Goal
Compare prod `ruletka.vip` / `ruletka.me` `live.html` + `live-brand.css` body vs disk `ui/live-brand.css`; note whether `stage-brand-spin-360-loop` is present; note deploy lag.

## Measured (2026-08-12T02:50Z UTC)

### Commands

```bash
curl -sS -m 25 -D /tmp/brand-prod-vs-disk/vip-live.hdr \
  -o /tmp/brand-prod-vs-disk/vip-live.html 'https://ruletka.vip/live.html'
curl -sS -m 25 -D /tmp/brand-prod-vs-disk/me-live.hdr \
  -o /tmp/brand-prod-vs-disk/me-live.html 'https://ruletka.me/live.html'
curl -sS -m 25 -D /tmp/brand-prod-vs-disk/vip-brand.hdr \
  -o /tmp/brand-prod-vs-disk/vip-live-brand.css 'https://ruletka.vip/live-brand.css?v=10'
curl -sS -m 25 -D /tmp/brand-prod-vs-disk/me-brand.hdr \
  -o /tmp/brand-prod-vs-disk/me-live-brand.css 'https://ruletka.me/live-brand.css?v=10'
# also bare (no ?v=) — same body
curl -sS -m 25 -o /tmp/brand-prod-vs-disk/vip-live-brand-nov.css 'https://ruletka.vip/live-brand.css'
curl -sS -m 25 -o /tmp/brand-prod-vs-disk/me-live-brand-nov.css 'https://ruletka.me/live-brand.css'

grep -nE 'live-brand\.css\?v=|live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=' \
  /tmp/brand-prod-vs-disk/vip-live.html \
  /tmp/brand-prod-vs-disk/me-live.html \
  ui/live.html
grep -n 'stage-brand-spin-360-loop' \
  /tmp/brand-prod-vs-disk/vip-live-brand.css \
  /tmp/brand-prod-vs-disk/me-live-brand.css \
  ui/live-brand.css
md5sum /tmp/brand-prod-vs-disk/*live-brand*.css ui/live-brand.css
cmp -s /tmp/brand-prod-vs-disk/vip-live-brand.css ui/live-brand.css
```

### live.html version pins

| Asset | `ruletka.vip` live.html | `ruletka.me` live.html | Disk `ui/live.html` | Gap |
|-------|-------------------------|------------------------|---------------------|-----|
| **live-brand.css** | **`?v=10`** (L396) | **`?v=10`** (L396) | **`?v=10`** (L396) | **none** — pin match |
| live-stage.css | `?v=384` | `?v=384` | `?v=386` | prod lags disk by 2 (side) |
| live.js | `?v=561` | `?v=561` | `?v=562` | prod lags by 1 (side) |
| webrtc.js | `?v=315` | `?v=315` | `?v=315` | none |

Confirm lines:

```text
# VIP + ME prod
395:  <link rel="stylesheet" href="live-stage.css?v=384" />
396:  <link rel="stylesheet" href="live-brand.css?v=10" />
397:  <link rel="preload" href="live.js?v=561" as="script" />
3031:  <script src="webrtc.js?v=315" defer></script>
3032:  <script src="live.js?v=561" defer></script>

# disk
395:  <link rel="stylesheet" href="live-stage.css?v=386" />
396:  <link rel="stylesheet" href="live-brand.css?v=10" />
397:  <link rel="preload" href="live.js?v=562" as="script" />
3031:  <script src="webrtc.js?v=315" defer></script>
3032:  <script src="live.js?v=562" defer></script>
```

### live.html body notes

| Source | HTTP | bytes | md5 | Last-Modified |
|--------|------|-------|-----|---------------|
| VIP `live.html` | 200 | 190 499 | `30f1d1832808fc4d682dd548517ab5de` | Wed, 12 Aug 2026 01:42:46 GMT |
| ME `live.html` | 200 | 190 486 | `7d743819d1545eb6b0ed1983778d2c3e` | (no Last-Modified header) |
| Disk `ui/live.html` | n/a | 190 499 | `ebb13ddf0bf656ff53c344797dffffe3` | mtime local 2026-08-11 20:29 |

- **VIP vs ME:** host/brand copy only (`ruletka.vip` ↔ `ruletka.me` titles, OG, canonical, header brand span). **Same asset pins.** Same `#stage-brand-center` / `#stage-brand-spin` / wordmark `ruletka.me` DOM (L638–640).
- **VIP vs disk:** only pin deltas above (`live-stage` 384→386, `live.js` 561→562). Brand DOM identical. Size match (190 499) but md5 differs.
- Brand link appears **once** in each HTML.

### live-brand.css body — prod vs disk

| Source | HTTP | bytes | md5 | Last-Modified / note |
|--------|------|-------|-----|----------------------|
| VIP `live-brand.css?v=10` | 200 | **8097** | **`4fc20584a054ab80520b850ab3d2c963`** | Tue, 11 Aug 2026 22:22:12 GMT |
| ME `live-brand.css?v=10` | 200 | **8097** | **`4fc20584…`** (same) | Tue, 11 Aug 2026 22:22:12 GMT |
| VIP / ME bare `live-brand.css` | 200 | **8097** | **`4fc20584…`** (same) | same body; `?v=` is cache-bust only |
| Disk `ui/live-brand.css` | n/a | **8097** | **`4fc20584…`** | local mtime 2026-08-11 16:22:12 (−0600) |

`Cache-Control` on prod brand CSS: `public, max-age=31536000, immutable`.

**`cmp` VIP CSS == ME CSS == disk CSS: YES (byte-identical).**

### `stage-brand-spin-360-loop` presence

| Location | Present? | Lines |
|----------|----------|-------|
| Prod VIP CSS body | **YES** | L198 `@keyframes stage-brand-spin-360-loop`; L227 `animation: stage-brand-spin-360-loop 16.2s infinite` on `.stage.has-brand-live .stage-brand-spin` |
| Prod ME CSS body | **YES** | same |
| Disk `ui/live-brand.css` | **YES** | same |

Counts: `grep -c stage-brand-spin-360-loop` → **2** on each of VIP / ME / disk (definition + animation apply). Reduced-motion branch sets `animation: none` (L239–240) — expected.

Keyframe contract on prod = disk:

```css
@keyframes stage-brand-spin-360-loop {
  0%     { transform: rotate(0deg) scale(1); opacity: 0.88; … }
  3.704% { transform: rotate(180deg) scale(1.06); opacity: 1; … }
  7.407% { transform: rotate(360deg) scale(1); opacity: 0.88; … }
  7.41%  { transform: rotate(0deg) scale(1); opacity: 0.88; … }
  100%   { transform: rotate(0deg) scale(1); opacity: 0.88; }
}
.stage.has-brand-live .stage-brand-spin {
  animation: stage-brand-spin-360-loop 16.2s infinite;
}
```

Soft 360° every 15s (1.2s spin + 15s hold = 16.2s cycle) — matches brand-stage skill.

## Verdict

| Check | Result |
|-------|--------|
| Prod HTML pin `live-brand.css?v=` | **10** (VIP + ME) |
| Disk HTML pin `live-brand.css?v=` | **10** |
| Pin match? | **YES** |
| Prod CSS body == disk body? | **YES** — identical 8097 bytes / md5 `4fc20584…` |
| `stage-brand-spin-360-loop` in prod CSS? | **YES** (VIP + ME) |
| `stage-brand-spin-360-loop` in disk CSS? | **YES** |
| Brand deploy lag (live-brand)? | **NONE** — prod already ships disk brand CSS |
| Side lag (not brand) | live.js **561** vs disk **562**; live-stage **384** vs **386** — known stack lag, out of OWN |
| Deploy this task? | **No** (not needed for brand CSS; not requested) |

**Summary:** Prod VIP and ME both pin **`live-brand.css?v=10`** and serve a CSS body **byte-identical to disk** `ui/live-brand.css`. **`stage-brand-spin-360-loop` is present in prod CSS** (keyframes + 16.2s infinite animation). Brand stack is **not lagging** disk. Other live pins (`live.js` 561, `live-stage` 384) still lag disk but are outside this brand OWN.

## Not done (by design)

- No product / UI / mobile edits
- No deploy / `push.sh` / APK / AAB
- No git push
- No invent human PASS / GOAL_MET on spin feel in browser
- No skill restamp (`live-brand` still v=10; no CSS change)

## Connect risk
None — read-only HTTP GET + disk `cmp`/`md5sum`.
