# BRAND-multi-trio-place RESULT

**Date:** 2026-08-11  
**Skill:** `brand-stage`  
**Status:** COMPLETE (CSS harden; **no multi / blur product PASS claimed**)  
**OWN:** `ui/live-brand.css` + `ui/live.html` cache pin only

## Goal
When stage is trio (partner | looking | you), center brand watermark still animates and seam placement is correct (left ~33% of design contract).

## Before

| Item | Disk |
|------|------|
| Duo place | `.stage-brand-center { left: 50% }` + `translate(-50%,-50%)` |
| Trio place | `.stage.stage-trio .stage-brand-center { left: 33.333% }` only |
| Spin gate | `.stage.has-brand-live .stage-brand-spin { animation: stage-brand-spin-360-loop 16.2s infinite }` |
| Narrow ≤720px | `.stage-brand-center { left: 50% }` (lower specificity than trio — trio still 33%) |
| Grid 2×2 + trio | still forced `left: 33.333%` (no equal first-third seam on 2×2) |
| Pin | `live-brand.css?v=11` |

Static audit: spin already worked under trio (no live-stage kill; animation not gated on duo-only). Primary gap was **grid exclusion** + **explicit hunt / narrow reaffirm** of the 33.333% seam.

## After

| Item | Disk |
|------|------|
| Trio / hunt place | `.stage.stage-trio:not(.stage-layout-grid)` + `.stage.stage-trio-searching:not(.stage-layout-grid)` → **`left: 33.333%`** |
| Grid 2×2 | **excluded** → stays default **50%** |
| Narrow ≤720px | duo 50%; trio/hunt re-stated **33.333%** so seam cannot regress |
| Spin | unchanged — still **only** `.stage.has-brand-live .stage-brand-spin` (trio does not re-gate; reduced-motion still wins) |
| Pin | **`live-brand.css?v=12`** |

### Placement math (contract)
```
3 equal columns: [0──33.3%] [33.3──66.7%] [66.7──100%]
                  partner     looking/3rd    you
left: 33.333% + translateX(-50%) → pill center ON partner↔middle seam
```
Not mid-looking brand video (would be 50%). Matches prior BRAND polish stamp + skill “seam” language.

## Files

| Path | Change |
|------|--------|
| `ui/live-brand.css` | Harden trio seam selectors; exclude grid; narrow reaffirm; comment |
| `ui/live.html` | `live-brand.css?v=11` → **`?v=12`** |

## Verify (static)

```text
✓ left: 33.333% under stage-trio / stage-trio-searching (not grid)
✓ stage-brand-spin-360-loop 16.2s infinite under .has-brand-live
✓ animation: none only in prefers-reduced-motion
✓ no stage-brand* kill in live-stage.css
✓ live.html pin v=12
✓ wordmark vertical-rl; .stage-wm hidden on match-live / has-brand-live
✓ no MediaSession / live.js / live.tsx edits
```

## Not claimed / not done

- **No multi product PASS** (find-3rd / 3-way faces)
- **No blur product PASS**
- **No human browser spin PASS** (needs hard-refresh + live trio smoke)
- **No deploy** (human). Prod may still pin older `?v=` until push
- **No APK / phone adb**
- **No live.js wire change** (has-brand-live assumed from prior BRAND-has-brand-live-wire)

## Residual (human)

1. Hard-refresh live; Network → `live-brand.css?v=12`
2. PC find-3rd hunt: partner | looking | you → vertical `ruletka.me` on **first seam** (~⅓), soft 360° ~every 15s
3. Optional: switch layout to 2×2 grid → brand should recenter (~50%)
4. Hangup clears brand; reduced-motion → static upright

## Merge advice

Safe brand-only hop. No connectivity/ICE risk. Ship with next UI deploy when human authorizes.
