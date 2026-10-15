# BRAND-P1-idle-breath RESULT

**Date:** 2026-08-12  
**Skill:** `brand-stage`  
**Status:** **COMPLETE** (disk CSS ship-ready; **no deploy**; **no human PASS invented**)  
**OWN:** `ui/live-brand.css` (`@keyframes stage-brand-spin-360-loop` hold phase) · `ui/live.html` pin only  
**Spec:** `knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md` **P1**

## Goal

Subtle opacity/glow pulse on center pill during **hold** phase so the brand does not look dead for ~14s between soft 360° spins.

## Before (disk v=13 body — post-P0)

| Param | Value |
|-------|--------|
| Cycle | **16.2s** infinite under `.stage.has-brand-live .stage-brand-spin` |
| Spin phase | **1.9s** (11.728%) — mid 5.864% scale **1.16** + glow peak |
| Hold | **~14.3s** upright — **flat** opacity 0.9 + base glow (no life) |
| Pin | `live-brand.css?v=13` |

## After (this hop)

| Param | Value |
|-------|--------|
| Cycle | **16.2s** unchanged (still soft one-rev every ~15s) |
| Spin phase | **unchanged** — 1.9s / mid scale 1.16 / mid glow peak |
| Hold breath | **opacity 0.87 ↔ 0.97** + soft halo inhale/exhale |
| Breath period | ~**3.2s** (10% of cycle) × ~3 full breaths during hold |
| Hold transform | locked `rotate(360deg) scale(1)` — **no** second spin, no scale thrash |
| Peak halo | brand-blue ~0.22 (below mid-spin peak 0.34 — quieter than spin) |
| Valley | opacity 0.87 · glow ~0.08 |
| Settle | 82% soft inhale → 100% base (loop-safe match to 0% opacity/glow) |
| Easing hold | `ease-in-out` on breath keyframes |
| Reduced motion | unchanged: `animation: none`; static upright opacity 0.92 |
| Pin | **`live-brand.css?v=14`** (+1) |

### Hold keyframe map

```
t%      phase        opacity   halo
11.728  settle       0.90      base 0.12
22      inhale       0.97      soft 0.22
32      exhale       0.87      dim  0.08
42      inhale       0.97      soft 0.22
52      exhale       0.87      dim  0.08
62      inhale       0.97      soft 0.22
72      exhale       0.87      dim  0.08
82      soft inhale  0.95      soft 0.18
100     base (loop)  0.90      base 0.12
```

### Delta (why it should read better)

| | Before | After | Δ |
|--|--------|-------|---|
| Hold life | dead flat 14.3s | ~3 soft breaths | new |
| Opacity hold | 0.9 static | 0.87–0.97 | subtle pulse |
| Halo hold | base only | base ↔ soft inhale | new |
| Spin feel | P0 | P0 preserved | none |
| Cycle cadence | 16.2s | 16.2s | same ~15s feel |

## Files touched

| Path | Change |
|------|--------|
| `/home/drakosik/freenet-roulette/ui/live-brand.css` | P1 hold-phase breath keyframes + header/doc comments |
| `/home/drakosik/freenet-roulette/ui/live.html` | `live-brand.css?v=` **13 → 14** |

## Preserved contract

- Center seam place (duo 50% / trio 33.333%) — not edited
- Gate only under `.stage.has-brand-live`
- Tile `.stage-wm` hidden on match-live
- Full `ruletka.me` never clip
- `pointer-events: none`
- `prefers-reduced-motion` static
- No constant spin (still one 360° then long upright rest)
- P0 spin length / mid-scale / mid-glow untouched

## Not touched

- `live.js`, `live-stage.css`, MediaSession, WebRTC/ICE, mobile, APK
- Deploy (human)
- No invented human PASS / multi PASS / GOAL_MET

## Risk

| Risk | Mitigations |
|------|-------------|
| Breath too strong / flashy | Amplitude tight (opacity ±0.07–0.1); halo max 0.22 vs spin peak 0.34 |
| Breath fights spin mid-turn | Breath keyframes only after 11.728% settle; transform locked |
| GPU box-shadow cost | Same property already animated in P0; reduced-motion kills all |
| Loop snap | 100% opacity/glow = 0% base; 360°→0° still visual no-op |

## Human smoke (next — not claimed)

1. Hard-refresh live → Network **`live-brand.css?v=14`**
2. PC 1v1 → center vertical `ruletka.me` pill
3. Spin (~1.9s, mid scale + stronger glow) then **~14s upright with soft glow/opacity breath** — not dead flat
4. Next spin at ~16s; breath does not look like a second spin
5. OS reduced-motion → static upright only
6. No tile-corner dual mark

## Residual / stack

| Next | Note |
|------|------|
| P2 match-enter flourish | one-shot faster intro 360° on has-brand-live |
| Deploy | human `proceed` only |
| Skill stamp | restamp `live-brand.css?v=14` + P1 breath after smoke |

## Status

**COMPLETE** — P1 idle breath on disk; pin **v=14**; ready for human hard-refresh smoke; **not deployed**.
