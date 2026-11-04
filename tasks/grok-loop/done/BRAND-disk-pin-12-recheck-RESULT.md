# BRAND disk pin 12 recheck RESULT

**Date:** 2026-08-11  
**Skill:** `brand-stage`  
**Prior ship:** `BRAND-multi-trio-place-RESULT.md` / L14  
**Status:** COMPLETE (read-only static recheck)  
**OWN:** `ui/live-brand.css` + `ui/live.html` — **no product edit**

## Goal

Confirm disk still pins **`live-brand.css?v=12`**, trio/hunt seam **`left: 33.333%`**, and spin gated only under **`.stage.has-brand-live`**. No multi product PASS invent.

## Verify (static — disk 2026-08-11)

| Check | Evidence | OK |
|-------|----------|----|
| Cache pin | `ui/live.html` L396: `href="live-brand.css?v=12"` | ✓ |
| Duo default place | `.stage-brand-center { left: 50%; top: 50% }` (L81–82) | ✓ |
| Trio seam | `.stage.stage-trio:not(.stage-layout-grid) .stage-brand-center` → **`left: 33.333%`** (L264–266) | ✓ |
| Hunt seam | `.stage.stage-trio-searching:not(.stage-layout-grid) .stage-brand-center` → **`left: 33.333%`** (same block) | ✓ |
| Grid exclusion | `:not(.stage-layout-grid)` → 2×2 keeps default **50%** | ✓ |
| Narrow ≤720px reaffirm | Trio/hunt restated **`left: 33.333%`** after narrow duo `50%` (L275–277) | ✓ |
| Spin gate | `.stage.has-brand-live .stage-brand-spin { animation: stage-brand-spin-360-loop 16.2s infinite }` (L225–226) | ✓ |
| Keyframes | `@keyframes stage-brand-spin-360-loop` 0°→360° mid-scale 1.12 (L202–222) | ✓ |
| Reduced motion | `.stage.has-brand-live .stage-brand-spin { animation: none }` (L241–244) | ✓ |
| Tile marks hidden | `html.match-live` / `.stage.has-brand-live .stage-wm` opacity 0 (L28–34) | ✓ |
| Spin not re-gated on trio | Comment L261–262: trio does not re-gate animation | ✓ |
| Body size | `ui/live-brand.css` 9191 B · md5 `83e3d655af61b458df6f3fd56b909791` | note |
| Product edit this hop | **None** (read-only) | ✓ |

### Placement math (unchanged contract)

```
3 equal columns: [0──33.3%] [33.3──66.7%] [66.7──100%]
                  partner     looking/3rd    you
left: 33.333% + translateX(-50%) → pill center ON partner↔middle seam
```

### Pin quote

```html
<link rel="stylesheet" href="live-brand.css?v=12" />
```

### Trio place quote

```css
.stage.stage-trio:not(.stage-layout-grid) .stage-brand-center,
.stage.stage-trio-searching:not(.stage-layout-grid) .stage-brand-center {
  left: 33.333%;
}
```

### Spin gate quote

```css
.stage.has-brand-live .stage-brand-spin {
  animation: stage-brand-spin-360-loop 16.2s infinite;
}
```

## Verdict

**Disk pin 12 recheck PASS (static only).**  
`live-brand.css?v=12` + trio/hunt seam 33.333% (not grid) + `has-brand-live` spin gate all still present and consistent with `BRAND-multi-trio-place`.

## Not claimed / not done

- **No multi product PASS** (find-3rd / 3-way faces)
- **No blur product PASS**
- **No human browser spin PASS** (needs hard-refresh + live trio smoke)
- **No deploy** / no phone / no APK
- **No CSS or HTML edit** this hop
- Skill `brand-stage` SKILL.md still stamps tip **`?v=11`** in Source of truth — **skill lag only**, not OWN of this card; body contract (seam / has-brand-live / 16.2s) still matches disk

## Residual (human)

1. Hard-refresh live → Network **`live-brand.css?v=12`**
2. PC find-3rd: partner \| looking \| you → `ruletka.me` on **first seam** (~⅓), soft 360° ~15s
3. Optional grid 2×2 → brand ~50%
4. Optional: restamp skill tip 11→12 in a separate OWN skill card

## Merge advice

No code change. Card is verify-only; safe to drop from loop. Prior brand trio ship remains the code owner of v=12.
