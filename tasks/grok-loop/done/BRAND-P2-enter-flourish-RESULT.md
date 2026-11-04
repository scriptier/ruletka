# BRAND-P2-enter-flourish RESULT

**Date:** 2026-08-12  
**Skill:** `brand-stage`  
**Status:** **COMPLETE** (disk CSS ship-ready; **no deploy**; **no human PASS invented**)  
**OWN:** `ui/live-brand.css` (enter flourish keyframes + dual animation) · `ui/live.html` pin only  
**Spec:** `knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md` **P2**

## Goal

One short intro spin/pop when `has-brand-live` turns on, then settle into the long 16.2s 360° loop.

## Before (disk v=14 body — post-P1)

| Param | Value |
|-------|--------|
| Gate | `.stage.has-brand-live .stage-brand-spin` |
| Animations | single: `stage-brand-spin-360-loop 16.2s infinite` |
| Enter | center fade/scale transition only (0.4s) — first spin same as every later spin |
| Spin phase | **1.9s** mid scale **1.16** + glow peak |
| Hold breath | P1 opacity/halo (unchanged this hop) |
| Pin | `live-brand.css?v=14` |

## After (this hop)

| Param | Value |
|-------|--------|
| Enter flourish | **`stage-brand-enter-flourish`** — **1.0s** · count **1** · fill **both** |
| Intro mid | **48%** → `rotate(180deg) scale(1.18)` · opacity 1 · stronger glow |
| Intro settle | **100%** → `rotate(360deg) scale(1)` · opacity 0.9 · base glow |
| Long loop | same **16.2s** infinite, **delayed 1.0s** so it starts after flourish |
| Hand-off | flourish end ≈ loop 0% (upright scale 1 / opacity 0.9) — no snap |
| Restart | class re-apply on new match restarts both (pure CSS; no JS class thrash) |
| Reduced motion | still `animation: none`; static upright opacity 0.92 |
| P0 / P1 | spin length / mid-scale 1.16 / hold breath **preserved** |
| Pin | **`live-brand.css?v=15`** (+1) |

### Animation list (gate rule)

```css
.stage.has-brand-live .stage-brand-spin {
  animation:
    stage-brand-enter-flourish 1s 1 both,
    stage-brand-spin-360-loop 16.2s infinite 1s;
}
```

### Enter keyframe map

```
t%    phase     rot    scale  opacity  glow
0     start     0°     0.94   0.82     base
48    mid       180°   1.18   1.00     peak (punchier than loop)
100   settle    360°   1.00   0.90     base → loop takes over at +1.0s
```

### Delta (why it should read better)

| | Before | After | Δ |
|--|--------|-------|---|
| Match-link moment | same slow first spin as every cycle | **1.0s** faster intro 360° + pop | new |
| Mid enter scale | n/a (1.16 first cycle) | **1.18** one-shot | punchier |
| After intro | — | long 16.2s loop (P0+P1) | delayed 1s |
| Steady cadence | 16.2s from t=0 | 16.2s from t=1s | still ~15s soft spins |
| JS | none | **none** (CSS-only) | no thrash risk |

## Files touched

| Path | Change |
|------|--------|
| `/home/drakosik/freenet-roulette/ui/live-brand.css` | `@keyframes stage-brand-enter-flourish` + dual animation under gate; header/docs |
| `/home/drakosik/freenet-roulette/ui/live.html` | `live-brand.css?v=` **14 → 15** |

## Preserved contract

- Center seam place (duo 50% / trio 33.333%) — not edited
- Gate only under `.stage.has-brand-live`
- Tile `.stage-wm` hidden on match-live
- Full `ruletka.me` never clip
- `pointer-events: none`
- `prefers-reduced-motion` static (flourish + loop both killed)
- No constant spin (one intro rev + soft rev every ~15s)
- P0 spin (1.9s / 1.16) and P1 hold breath untouched

## Not touched

- `live.js` (no one-shot class; `setStageBrandLive` unchanged)
- `live-stage.css`, MediaSession, WebRTC/ICE, mobile, APK
- Deploy (human)
- No invented human PASS / multi PASS / GOAL_MET

## Risk

| Risk | Mitigations |
|------|-------------|
| Dual anim property fight | Loop delayed 1s; flourish count 1 + both fill; same props hand off cleanly |
| Flourish too flashy | 1.0s within plan 0.9–1.1s; scale 1.18 only once at enter |
| Re-trigger thrash | `classList.toggle(..., true)` no-ops when already on; rematch off→on restarts intentionally |
| GPU | same transform/opacity/box-shadow set as P0/P1; reduced-motion kills all |
| Loop delay shifts first soft spin | first soft spin at ~1s + 1.9s; cadence still ~15s upright majority |

## Human smoke (next — not claimed)

1. Hard-refresh live → Network **`live-brand.css?v=15`**
2. PC 1v1 match start → **immediate ~1s full 360°** (noticeable pop/scale) as brand appears
3. Then long upright hold with P1 breath; next soft spin ~16s later (1.9s / scale 1.16)
4. Hangup → rematch: flourish plays again once; no dual continuous spin
5. OS reduced-motion → static upright only (no enter, no loop)
6. No tile-corner dual mark

## Residual / stack

| Next | Note |
|------|------|
| P3 glass/theme polish | brand-tint rim / theme variants |
| Deploy | human `proceed` only |
| Skill stamp | restamp `live-brand.css?v=15` + P2 enter flourish after smoke |

## Status

**COMPLETE** — P2 match-enter flourish on disk; pin **v=15**; CSS-only; ready for human hard-refresh smoke; **not deployed**.
