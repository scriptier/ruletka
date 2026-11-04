# BRAND-P3-glass-theme RESULT

**Date:** 2026-08-12  
**Skill:** `brand-stage`  
**Status:** **COMPLETE** (disk CSS ship-ready; **no deploy**; **no human PASS invented**)  
**OWN:** `ui/live-brand.css` (glass + theme blocks + keyframe shadow handoff) · `ui/live.html` pin only  
**Spec:** `knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md` **P3**

## Goal

Richer glass pill + theme variants so center `ruletka.me` mark reads on busy video.

## Before (disk v=15 body — post-P2)

| Param | Value |
|-------|--------|
| Plate bg | white sheen 0.10→0.02 + radial `rgba(52,58,74,0.72)` → `rgba(8,10,16,0.78)` |
| Border | `1px solid rgba(255,255,255,0.18)` |
| Rim / shadow | `0 0 0 1px rgba(0,0,0,0.28)` + drop `0 6px 22px / 0.48` + blue glow `0 0 28px / 0.12` + inset bevel |
| Backdrop | `blur(10px) saturate(1.15)` |
| Wordmark | `rgba(255,255,255,0.96)` · 3-layer dark shadow |
| Light/pink | shared inverted glass; border `rgba(0,0,0,0.08)`; soft blue glow only |
| Matrix / saloon | **none** (default dark glass) |
| Pin | `live-brand.css?v=15` |

### Preserved (not changed this hop)

| Contract | Value |
|----------|--------|
| P0 spin | **1.9s** · mid scale **1.16** · cycle **16.2s** |
| P1 hold breath | opacity / halo inhale-exhale on hold keyframes |
| P2 enter flourish | dual anim: `stage-brand-enter-flourish 1s 1 both` + loop `16.2s infinite 1s` |
| Gate | `.stage.has-brand-live` only |
| Place | duo 50% / trio 33.333% |
| Reduced motion | `animation: none` static upright |

## After (this hop)

### Dark default glass

| Param | Before | After |
|-------|--------|-------|
| Sheen | white 0.10 / 0.02 | **0.14 / 0.04** + bottom dark 0.16 |
| Plate radial | 0.72 / 0.78 | denser **0.86 / 0.90** |
| Border | white 0.18 | brand-blue **`rgba(180,200,255,0.28)`** |
| Rim stack | single dark 1px | **brand-blue 1px** + **dark outer 2px** |
| Drop | 6px/22px @ 0.48 | **8px/28px @ 0.58** |
| Halo | blue 28px @ 0.12 | blue **34px @ 0.18** + whisper rose **16px @ 0.06** |
| Inset bevel | white 0.14 / black 0.18 | white **0.20** / black **0.28** |
| Backdrop | blur 10 / sat 1.15 | **blur 12 / sat 1.28** |
| Wordmark | 0.96 + 3 shadows | **0.98** + 4-layer punchier dark stack |

### Light / pink contrast

| Theme | Glass | Rim | Wordmark |
|-------|-------|-----|----------|
| **light** | frost white 0.72→0.32 + cool radial 0.94/0.92 | blue `rgba(70,100,180,0.28)` + white outer ring | ink `rgba(14,18,30,0.94)` |
| **pink** | blush 0.78→0.40 + rose radial | rose `rgba(220,90,150,0.36)` + white outer | rose-ink `rgba(72,18,48,0.94)` |

Both: `backdrop-filter: blur(12px)` (sat 1.2 light / 1.25 pink).

### Matrix / saloon brand-tint rim (cheap)

| Theme | Border | Halo / plate | Wordmark |
|-------|--------|--------------|----------|
| **matrix** | green `rgba(0,200,90,0.42)` | green rim 1px + green glow 32px; near-black green plate | mint `rgba(180,255,210,0.96)` + green halo text-shadow |
| **saloon** | gold `rgba(201,162,39,0.48)` | gold rim 1px + gold glow 32px; warm brown plate | cream `rgba(255,236,200,0.96)` + gold halo text-shadow |

**Note:** keyframe `box-shadow` still uses brand-blue glow during spin/breath (product default). Theme **border-color** + **background** survive animation (not keyframed) so rim tint stays visible mid-spin. Static/reduced-motion uses full theme shadow stack.

### Keyframe handoff

Enter + loop base/peak/breath `box-shadow` values rebased to the new dark glass rim stack so P0/P1/P2 do not snap back to the pre-P3 5-layer shadow. Timing / transform / opacity **unchanged** (1.9s, 1.16, 1.0s flourish, breath %).

### Pin

`live-brand.css?v=` **15 → 16**

## Files touched

| Path | Change |
|------|--------|
| `/home/drakosik/freenet-roulette/ui/live-brand.css` | dark glass; light/pink split; matrix + saloon rims; keyframe shadow rebase; header note |
| `/home/drakosik/freenet-roulette/ui/live.html` | pin **15 → 16** only |

## Not touched

- `live.js` / MediaSession / WebRTC / ICE  
- `live-stage.css` / `live-themes.css`  
- mobile / APK  
- Deploy (human)  
- No invented human PASS / multi PASS / GOAL_MET  

## Risk

| Risk | Mitigation |
|------|------------|
| Pill too heavy / dark blob | still frosted glass + inset highlight; density only +0.08–0.12 alpha |
| Theme shadow overridden mid-spin | border + bg survive; rim still reads |
| Keyframe/base mismatch | all base/peak/breath shadows rebased together |
| Pink/light washout | denser plate + darker ink wordmark + stronger rim |

## Human smoke (next — not claimed)

1. Hard-refresh live → Network **`live-brand.css?v=16`**
2. Dark match: center pill has blue rim + denser glass; `ruletka.me` readable on busy video
3. Theme light → frost plate + dark ink wordmark
4. Theme pink → blush plate + rose rim + rose-ink wordmark
5. Theme matrix → green rim; saloon → gold rim
6. P2 enter flourish still ~1s; then soft 1.9s / 1.16 every ~15s with P1 breath
7. Reduced-motion → static upright (theme glass still applies)
8. No tile-corner dual mark

## Residual / stack

| Next | Note |
|------|------|
| P4 layout audit | duo 50% / trio 33.3% / grid / narrow mobile |
| Deploy | human `proceed` only |
| Skill stamp | restamp `live-brand.css?v=16` + P3 glass after smoke |

## Status

**COMPLETE** — P3 glass + theme polish on disk; pin **v=16**; CSS-only; ready for human hard-refresh smoke; **not deployed**.
