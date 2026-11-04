# L14-brand-trio RESULT

**Date:** 2026-08-12T03:20Z  
**Card:** `BRAND-multi-trio-place` / `L14-brand-trio`  
**Skill:** `brand-stage`  
**Status:** **COMPLETE** (static CSS ensure; **no multi / human spin PASS invented**)  
**OWN:** `ui/live-brand.css` + `ui/live.html` pin only

## Goal
Ensure **stage-trio** center brand still **animates**; place seam at **left ~33%** in `live-brand.css`. Bump `live-brand` `?v=` if change.

## Disk truth

| Check | Result |
|-------|--------|
| Pin | `ui/live.html` → **`live-brand.css?v=12`** |
| CSS body | `ui/live-brand.css` · **9191 B** · md5 **`83e3d655af61b458df6f3fd56b909791`** |
| Trio place | `.stage.stage-trio:not(.stage-layout-grid) .stage-brand-center` → **`left: 33.333%`** |
| Hunt place | `.stage.stage-trio-searching:not(.stage-layout-grid) .stage-brand-center` → **`left: 33.333%`** |
| Narrow ≤720px | duo `left:50%`; trio/hunt **re-stated `33.333%`** (no mid-stage regress) |
| Grid 2×2 | **excluded** via `:not(.stage-layout-grid)` → stays default **50%** |
| Spin gate | `.stage.has-brand-live .stage-brand-spin { animation: stage-brand-spin-360-loop 16.2s infinite }` |
| Feel | 1.55s spin / 16.2s cycle / mid scale 1.12 (unchanged this hop’s feel) |
| Reduced motion | `animation: none` still wins |
| Wire (prior) | `syncMatchChrome` → `setStageBrandLive(isLive)` with `trioBrowse` in `isLive` |

### Placement math
```
3 equal columns: [0──33.3%] [33.3──66.7%] [66.7──100%]
                  partner     looking/3rd    you
left: 33.333% + translate(-50%, -50%) → pill center ON partner↔middle seam
```
Not mid-looking brand (50%). Not stage dead-center on 3-col stack.

### Why animation still runs on trio
Spin is **not** re-gated or disabled under `.stage-trio`. Only gate is **`.has-brand-live`**, which stays on while `matched || inFriendCall || trioBrowse` (`setStageBrandLive` via `syncMatchChrome`). No `live-stage.css` rule kills `.stage-brand-*` animation.

## Change summary (this hop)

| Path | Change |
|------|--------|
| `ui/live-brand.css` | Trio/hunt seam `left: 33.333%`; exclude grid; narrow reaffirm; comments |
| `ui/live.html` | `live-brand.css?v=` **11 → 12** |

Prior sibling RESULT: `BRAND-multi-trio-place-RESULT.md` (same OWN).

## Verify commands

```bash
grep -nE 'live-brand\.css\?v=' ui/live.html
grep -nE '33\.333%|stage-brand-spin-360|has-brand-live .stage-brand-spin' ui/live-brand.css
md5sum ui/live-brand.css
# expect: no animation:none on brand outside prefers-reduced-motion
```

## Not claimed

- No multi product PASS (find-3rd / 3-way faces)
- No human browser spin PASS
- No deploy / APK / MediaSession / live.js / live-stage edits this hop
- Skill ship tip may still say v=11 until a brand-skill restamp hop

## Residual (human)

1. Hard-refresh live → Network shows **`live-brand.css?v=12`**
2. PC find-3rd hunt: partner | looking | you → vertical `ruletka.me` on **first seam (~⅓)**, soft 360° ~every 15s
3. Optional layout grid 2×2 → brand ~50%
4. Hangup clears brand; OS reduced-motion → static upright

## RESULT
**COMPLETE**
