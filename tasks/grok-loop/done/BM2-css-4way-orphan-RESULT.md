# BM2-css-4way-orphan — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live-stage.css`, `ui/live.html` (`live-stage.css?v=` only)  
**Date:** 2026-08-12T02:58Z  
**Plan:** `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` § C2  
**Prior:** `tasks/grok-loop/done/W7-multi-css-orphan-static-RESULT.md` (read-only residual inventory)

## Goal
Fix or audit **stage-count-4 orphan black** / mute chip floors so 4-way layout does not leave permanent black orphan styling issues.

## Disk stamps (after)

| Surface | On disk |
|---------|---------|
| `ui/live-stage.css` | brace balance **3303 / 3303** |
| `ui/live.html` link | `live-stage.css?v=387` (was 386) |
| Mute/vol font floors (W3) | still present `max(0.72rem, 11px)` / `max(0.62rem, 10px)` |
| `#remote2-wrap[hidden]` zero-footprint | still present |

## Audit (reconfirm W7 + act)

### Mute chip floors (C2 half) — **no change needed**
W3 already set dense 4-way floors:
- `.stage.stage-multi.stage-count-4 .peer-mute-btn` → `font-size: max(0.72rem, 11px)`
- `.peer-vol-pct` → visible + `max(0.62rem, 10px)`  
Left as-is (not thrash).

### Orphan black (C2 half) — **minimal guard fix**
W7 residual: legacy multi stack/grid **unguarded** `display: block !important` on `.remote-b-wrap` / `.vid.remote-b` could beat bare `.remote-b-wrap[hidden]` (0,2,0). Disk previously relied on `#remote2-wrap[hidden]` ID belt only.

Also symmetry: grid-4 / stack-4 vid show paths forced `#remote2` / `.vid.remote-b` block without wrap `:not([hidden])`.

## Changes

### `ui/live-stage.css`

1. **Legacy stack split** (~L18757):  
   `.remote-stack.split .remote-b-wrap` → `:not([hidden])`  
   `.vid.remote-b` → `:not([hidden])`

2. **Legacy stack.trio** (~L18773):  
   wrap + vid.remote-b → both `:not([hidden])`

3. **Legacy grid.trio** (~L18840):  
   wrap + vid.remote-b → both `:not([hidden])`

4. **Grid stage-count-4** (~L20412):  
   `.remote-b-wrap .vid…` → `.remote-b-wrap:not([hidden]) .vid…` / `#remote2`

5. **Stack stage-count-4** (~L20589):  
   `.remote-b-wrap .vid.remote-b` → `.remote-b-wrap:not([hidden]) .vid.remote-b`

Zero-footprint hide block (`#remote2-wrap[hidden]`, `#tile-third[hidden]`, transparent multi vids) unchanged.

### `ui/live.html`
- `live-stage.css?v=386` → **`?v=387`** only

## Not edited
- `live-brand.css`, `live.js`, MediaSession, mobile/*, deploy, APK

## Verify (static only)

| Check | Result |
|-------|--------|
| CSS brace balance | **3303 / 3303** |
| Legacy unguarded multi remote-b `display:block` | **gone** (all show paths use `:not([hidden])`) |
| stage-count-4 wrap show guarded | **yes** (pre-existing + vid chain) |
| Mute chip floors | **present** (W3) |
| Cache bump | **387** |
| Human 4-way smoke / product.ok | **not claimed** |
| Multi product PASS | **not invented** |

## Risks
- Static cascade only — unused remote2 still depends on JS setting `wrap.hidden` / `#remote2[hidden]`.  
- Count-3 unguarded `.tile-third` show (legacy grid count-3) left out of scope (W7 #3).  
- Prod CDN may lag until human deploy.

## Merge advice
Safe CSS-only hop. No live.js. Deploy web assets when human authorizes so clients get `?v=387`.

## Job complete
Running → done; RESULT filed. **COMPLETE** = residual unguarded orphan-show rules fixed + cache bump + mute floors confirmed.  
**Not** claimed: human 4-way faces / GOAL_MET / multi PASS.
