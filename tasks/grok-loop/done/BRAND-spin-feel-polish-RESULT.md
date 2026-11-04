# BRAND-spin-feel-polish RESULT

**Date:** 2026-08-11  
**Skill:** `brand-stage`  
**Status:** COMPLETE (verify-only; **no human PASS claimed**)  
**OWN:** `ui/live-brand.css`, `ui/live.html` (v= bump only)

## Goal
PC mid-match center-seam `ruletka.me` soft 360° every ~15s. If animation works but feel still wrong/too subtle → lengthen spin / more visible in **live-brand.css only** + bump `?v=`. Else document verification + residual.

## Prior hop
`BRAND-pc-spin-audit-RESULT.md` already shipped feel fix:
- Spin phase **1.2s → 1.55s** (cycle still **16.2s**)
- Mid-scale **1.06 → 1.12**, opacity pulse **0.9 → 1**
- Hold stays at `360°` (no mid-cycle snap)
- Cache **`live-brand.css?v=11`**

## Disk verification (this hop)

| Check | Result |
|-------|--------|
| Cache | `ui/live.html` → `live-brand.css?v=11` ✓ |
| Animation rule | `.stage.has-brand-live .stage-brand-spin { animation: stage-brand-spin-360-loop 16.2s infinite }` ✓ |
| Keyframes | `0%` → `4.784%` (180° / scale 1.12) → `9.568%` (360°) → `100%` hold ✓ |
| Spin duration | 9.568% × 16.2s ≈ **1.55s** spin; rest ≈ **14.65s** upright ✓ |
| Cycle | Soft one revolution every **~15s** (16.2s total) ✓ |
| `backface-visibility: hidden` | Present on live spin pill ✓ |
| `prefers-reduced-motion` | `animation: none`; static upright opacity 0.92 ✓ |
| Tile `.stage-wm` | `opacity:0 !important; visibility:hidden` on match-live / has-brand-live ✓ |
| Wordmark | Full `ruletka.me` vertical-rl; overflow visible; no max-size clip ✓ |
| Place | `.stage-brand-center` 50%/50% seam; trio at 33.333% ✓ |
| Clicks | `pointer-events: none` on center + spin ✓ |

### Math (feel contract)
```
spin_pct  = 1.55 / 16.2 ≈ 9.568%
mid_pct   = 0.775 / 16.2 ≈ 4.784%
hold      = 100% − 9.568% ≈ 90.4% of cycle (~14.65s upright)
```
Matches soft 360° every ~15s: deliberate turn, long rest — not continuous spinning.

## Decision: no further CSS change

Prior audit already addressed “too subtle” (1.2s / scale 1.06 → 1.55s / 1.12).  
No human residual “still too subtle after v=11” in card. Job allows:

> optional micro-tweak only if **clearly** still subtle.

Current disk is **already good enough** for the soft-360-every-~15s contract. Extra lengthening (e.g. 2s+) without visual FAIL would be thrash and risks feeling less “soft.”

**Files touched this hop:** none (verify-only).  
**v=:** stays **11**.

## Residual (human / next)

1. Hard-refresh live; Network must show `live-brand.css?v=11`.
2. Start PC 1v1 → center vertical `ruletka.me` pill.
3. Within ~2s (and again ~16s later): whole pill clearly rotates 360°, then rests upright.
4. No tile-corner `ruletka.me` mid-match.
5. Optional OS reduced-motion → static upright only.

If human reports **still too subtle** after v=11 smoke:
- OWN only: extend spin to ~1.8–2.0s (recompute keyframe % on 16.2s), mid-scale ~1.14–1.15
- Bump `live-brand.css?v=12`
- Keep reduced-motion + tile hide + no clip

## Contract residual
| Rule | Disk |
|------|------|
| Center seam (not partner bottom) | ✓ |
| Soft 360° every ~15s | ✓ (1.55s spin / 16.2s cycle) |
| Tile marks hidden match-live | ✓ |
| Full wordmark never clip | ✓ |
| Reduced-motion static | ✓ |

## Not touched
- `ui/live.js`, `ui/live-stage.css`, MediaSession, ICE, mobile, deploy, APK
- No invented human PASS / multi PASS
