# BRAND-P0-spin-feel RESULT

**Date:** 2026-08-12  
**Skill:** `brand-stage`  
**Status:** **COMPLETE** (disk CSS ship-ready; **no deploy**; **no human PASS invented**)  
**OWN:** `ui/live-brand.css` (`@keyframes stage-brand-spin-360-loop` + spin pill) · `ui/live.html` pin only  
**Spec:** `knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md` **P0**

## Goal

Make PC mid-match center-seam `ruletka.me` 360° more noticeable and polished without constant spinning.

## Before (disk v=12 body)

| Param | Value |
|-------|--------|
| Cycle | **16.2s** infinite under `.stage.has-brand-live .stage-brand-spin` |
| Spin phase | **1.55s** (9.568% of cycle) |
| Mid keyframe | **4.784%** → `rotate(180deg) scale(1.12)` · opacity 1 |
| End spin | **9.568%** → `rotate(360deg) scale(1)` · opacity 0.9 |
| Hold | **~14.65s** upright at 360° (≈90.4% of cycle) |
| Glow | static pill `box-shadow` only (no keyframe pulse) |
| Pin | `live-brand.css?v=12` |

### Before math
```
cycle     = 16.2 s
spin      = 1.55 s  →  1.55/16.2 ≈ 9.568%
mid       = 0.775 s →  0.775/16.2 ≈ 4.784%
hold      = 16.2 − 1.55 = 14.65 s  (~90.4%)
mid_scale = 1.12
```

## After (this hop)

| Param | Value |
|-------|--------|
| Cycle | **16.2s** (unchanged — still soft one-rev every ~15s) |
| Spin phase | **1.9s** (11.728% of cycle) — within plan **1.8–2.0s** |
| Mid keyframe | **5.864%** → `rotate(180deg) scale(1.16)` · opacity 1 |
| End spin | **11.728%** → `rotate(360deg) scale(1)` · opacity 0.9 |
| Hold | **~14.3s** upright (≈88.3% of cycle) — still majority rest |
| Mid scale | **1.16** — within plan **1.14–1.18** |
| Mid glow | soft brand-blue `box-shadow` peak at 180°; base shadow restored on settle |
| Easing | first half ease-in (`0.33, 0.05, 0.22, 1`); second half ease-out settle (`0.22, 0, 0.28, 1`); hold linear |
| Reduced motion | unchanged: `animation: none`; static upright opacity 0.92 |
| Wordmark | full vertical-rl `ruletka.me`; overflow visible; no clip |
| Pin | **`live-brand.css?v=13`** (+1) |

### After math
```
cycle     = 16.2 s
spin      = 1.9 s   →  1.9/16.2  ≈ 11.728%
mid       = 0.95 s  →  0.95/16.2 ≈ 5.864%
hold      = 16.2 − 1.9 = 14.3 s   (~88.3%)
mid_scale = 1.16
```

### Delta (why it should read better)

| | Before | After | Δ |
|--|--------|-------|---|
| Spin length | 1.55s | **1.9s** | **+0.35s** (~+23%) |
| Mid scale | 1.12 | **1.16** | **+0.04** |
| Mid glow | none | soft blue pulse | new |
| Hold upright | 14.65s | 14.3s | −0.35s (still ~88% rest) |
| Cycle cadence | 16.2s | 16.2s | same ~15s feel |

## Files touched

| Path | Change |
|------|--------|
| `/home/drakosik/freenet-roulette/ui/live-brand.css` | P0 keyframes + header comment + `will-change` includes `box-shadow` |
| `/home/drakosik/freenet-roulette/ui/live.html` | `live-brand.css?v=` **12 → 13** |

## Preserved contract

- Center seam place (duo 50% / trio 33.333%) — not edited
- Gate only under `.stage.has-brand-live`
- Tile `.stage-wm` hidden on match-live
- Full `ruletka.me` never clip
- `pointer-events: none`
- `prefers-reduced-motion` static
- No constant spin

## Not touched

- `live.js`, `live-stage.css`, MediaSession, WebRTC/ICE, mobile, APK
- Deploy (human)
- No invented human PASS / multi PASS / GOAL_MET

## Risk

| Risk | Mitigations |
|------|-------------|
| Glow thrash on low GPU | Peak only ~1s of 16.2s; base shadow matches static pill; reduced-motion kills anim |
| Scale 1.16 clips wordmark | Pill + wordmark `overflow: visible`; max-size none; center transform-origin |
| “Still subtle” after smoke | Residual: push spin to **2.0s** and/or mid-scale **1.18** only if human FAIL |

## Human smoke (next — not claimed)

1. Hard-refresh live → Network **`live-brand.css?v=13`**
2. PC 1v1 → center vertical `ruletka.me` pill
3. Within ~2s and again ~16s: whole pill turns **360°** (~1.9s), mid-turn slightly larger + soft glow, then long upright rest
4. OS reduced-motion → static upright only
5. No tile-corner dual mark

## Residual / stack

| Next | Note |
|------|------|
| P1 idle breath | hold-phase halo (not this hop) |
| Deploy | human `proceed` only |
| Skill stamp | restamp `live-brand.css?v=13` + feel 1.9s / 1.16 after smoke |

## Status

**COMPLETE** — P0 spin feel on disk; pin **v=13**; ready for human hard-refresh smoke; **not deployed**.
