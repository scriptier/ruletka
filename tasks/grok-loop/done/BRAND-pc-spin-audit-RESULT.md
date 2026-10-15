# BRAND-pc-spin-audit RESULT

**Date:** 2026-08-11  
**Skill:** `brand-stage`  
**Status:** COMPLETE (code-on-disk fix; **no human PASS claimed**)

## Goal
PC mid-match center-seam `ruletka.me` soft 360° every ~15s. Audit + fix if broken/too subtle.

## Audit findings

| Check | Result |
|-------|--------|
| DOM | `#stage-brand-center` > `#stage-brand-spin` > `.stage-brand-wordmark` in `ui/live.html` ✓ |
| Visibility gate | `.stage.has-brand-live` via `setStageBrandLive(true)` on match timer start ✓ |
| Animation rule | `.stage.has-brand-live .stage-brand-spin { animation: stage-brand-spin-360-loop 16.2s infinite }` ✓ |
| `live-stage.css` kill | **0** matches for `stage-brand*` / `has-brand-live` / brand-spin — **no override** |
| Tile `.stage-wm` | Force-hidden (`opacity:0 !important; visibility:hidden`) on match-live ✓ |
| Wordmark | Full `ruletka.me` vertical-rl; overflow visible ✓ |
| `prefers-reduced-motion` | Correctly disables spin only under reduce media query (not default) ✓ |
| JS thrash | Spin is pure CSS; `spinStageBrand` / `startStageBrandSpinLoop` are no-ops — left alone ✓ |

### What was wrong
Animation was **present and not killed**, but **too subtle to perceive** as a deliberate whole-pill 360°:

1. Spin phase only **1.2s** of 16.2s (~7.4% of cycle).
2. Mid-spin scale only **1.06** — easy to miss on a thin vertical pill over busy video.
3. Opacity pulse **0.88 → 1** almost invisible.
4. Mid-cycle **7.41% reset** `360° → 0°` was unnecessary (hold can stay at 360° until loop; restart is a visual no-op).

Not a wiring bug: `has-brand-live` toggles correctly; stage CSS does not zero the animation.

## Fix (disk)

### `ui/live-brand.css` (primary)
- Spin phase **1.55s** (still ~15s upright rest; cycle stays **16.2s**).
- Mid keyframe: `rotate(180deg) scale(1.12)` + opacity `1`.
- Hold `9.568%–100%` at `rotate(360deg)` (no mid-cycle snap).
- `backface-visibility: hidden` on spinning pill for cleaner GPU turn.
- Still soft: one revolution then long upright rest — not constant spinning.
- Reduced-motion path unchanged (static upright).

### `ui/live.html`
- Cache bump: `live-brand.css?v=10` → **`?v=11`**

### Not touched
- `ui/live.js` (has-brand-live already works; no MediaSession/ICE)
- `ui/live-stage.css` (no brand overrides to fix)
- Android `BrandWatermark.tsx`
- Deploy / human PASS invention

## Contract residual
- Place: center seam between partner \| you
- Tile marks: hidden when match-live / has-brand-live
- Full wordmark never clip
- Soft 360° every ~15s (16.2s cycle)

## Human verify (not agent PASS)
1. Hard-refresh live (confirm Network shows `live-brand.css?v=11`).
2. Start PC 1v1 match → center vertical `ruletka.me` pill appears.
3. Within first ~2s (and again ~16s later) whole pill should clearly rotate 360° then rest upright.
4. No tile-corner `ruletka.me` visible mid-match.
5. Optional: OS reduced-motion → static upright only.
