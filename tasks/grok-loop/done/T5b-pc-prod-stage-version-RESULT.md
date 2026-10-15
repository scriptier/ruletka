# T5b PC prod stage version check — RESULT

**Status:** COMPLETE  
**OWN:** read-only fetch + disk compare (`ui/live.html`)  
**Date:** 2026-08-12T02:28Z  
**Code change:** none  
**Deploy:** none (agent wall — no `push.sh`)

## Goal
Check production `live-stage.css` cache stamp vs disk `ui/live.html` (~L386/L395). RESULT only.

## Method
```bash
curl -s https://ruletka.vip/live.html | grep -E 'live-stage\.css\?v='
grep -nE 'live-stage\.css\?v=' ui/live.html
curl -sI https://ruletka.vip/live.html
curl -sI https://ruletka.vip/live-stage.css
```

## Measured

### Cache stamps

| Surface | `live-stage.css?v=` | Line / source |
|---------|---------------------|---------------|
| **PROD** `https://ruletka.vip/live.html` | **`384`** | prod HTML link |
| **DISK** `ui/live.html` | **`386`** | L395 |

### Related assets (context)

| Asset | PROD | DISK | Match |
|-------|------|------|-------|
| `live-stage.css` | **384** | **386** | **NO — prod 2 behind** |
| `live.js` | 561 | 561 | yes |
| `webrtc.js` | 315 | 315 | yes |
| `style.css` | 158 | 158 | yes |
| `live-brand.css` | 10 | 10 | yes |

### Body size (stage CSS)

| Surface | Size |
|---------|------|
| PROD `live-stage.css` (`Content-Length`) | **387 279** B |
| DISK `ui/live-stage.css` | **539 625** B |

Prod CSS body is also smaller / older than disk (not just the query stamp).

### Prod shell headers (`live.html`)
- `HTTP/2 200`
- `last-modified: Wed, 12 Aug 2026 01:42:46 GMT`
- `content-length: 190499`
- `cache-control: no-store, no-cache, must-revalidate` (+ `public, max-age=60`)

## Verdict

| Check | Result |
|-------|--------|
| Prod stage version | **`live-stage.css?v=384`** |
| Disk stage version | **`live-stage.css?v=386`** |
| In sync? | **NO** |
| Gap | Prod **2** cache bumps behind disk (**384 → 386**) |
| JS tip on prod | `live.js?v=561` already live (matches disk) |

**Human deploy still required** to ship stage **386** (and full disk CSS body). This task did **not** deploy.

## Note vs W8-deploy-stage-386-note
Earlier W8 RESULT (~02:16Z) saw disk html still at **385**. At this check (~02:28Z) disk `ui/live.html` L395 is already **`?v=386`**. Prod remains **384**.
