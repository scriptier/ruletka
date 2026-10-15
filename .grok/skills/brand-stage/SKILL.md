---
name: brand-stage
description: >
  Stage brand watermark + idle loading loop for freenet-roulette / ruletka.
  PC mid-match: center seam .stage-brand-spin (vertical between partner|you);
  whole-pill soft 360° every 30s; tile .stage-wm hidden. Android: BrandWatermark
  bottom-middle of partner video; soft 360° every 30s. Idle/search Android:
  BrandLoadingLoop HQ loading-screen.mp4. Full "ruletka.me" never clip.
  MUST NOT thrash MediaSession for brand-only.
metadata:
  short-description: "Stage brand watermark + loading loop (no MediaSession)"
  learned: "2026-08-12"
  triggers:
    - brand watermark
    - stage-brand-spin
    - BrandWatermark
    - BrandLoadingLoop
    - ruletka.me clip
    - loading-screen.mp4
    - stage wordmark flip
    - has-brand-live
---

# Brand stage (PC + Android)

You fix **stage branding only**: mid-match watermark placement/spin and idle
search loading video.  
You do **not** open WebRTC/ICE/MediaSession for brand-only FAILs.  
You do **not** rewrite match identity chrome — that is `mobile-match-identity`.

**Ship stamps (on disk — re-read `ui/live.html`):**  
`live-brand.css?v=23` · `live.js?v=756` (`data-brand-seam` from live people) · sfx `sounds/match.mp3?v=1`  
**Feel (disk CSS body):** still → halo glow (~0.9s) → one quick 360° (~0.7s) → **20s** still → repeat (`stage-brand-pulse-spin` **22s linear**)  
- Gate: `.stage.has-brand-live` only · place via **`data-brand-seam`**: 1v1/hunt **duo 50%** · 3 live people **trio 33.333%** · 4-way/2×2 **quad 50% cross**. Never key off leftover `.stage-trio` or `#remote-third:not([hidden])` (`showThirdConnecting` unhides that on 1v1).  
- Reduced motion: `animation: none` static upright  
**Prod honesty:** prod may still be brand **v=17** / live.js **619** until human rsync of **v=19 / 620**. **Do not invent prod==disk.**  
Smoke checklist: `knowledge/raw/2026-08-12-brand-spin-smoke.md` (human only — no invent PASS).

## When to use

| Symptom | This skill |
|---------|------------|
| PC mark moved to partner bottom (should be **center seam**) | Yes |
| Wrong spin (180° invert vs 360° every 30s) | Yes |
| Spin never runs mid-match (class / wire miss) | Yes — `has-brand-live` |
| Android mid-torso / not bottom-middle | Yes |
| Wordmark clipped | Yes |
| Loading video missing on Android search | Yes |
| Match chime still dual-tone beep (not spin.mp3) | Adjacent — `sounds/match.mp3` |
| Partner name / hex | **No** → `mobile-match-identity` |
| Black cams | **No** → `av-fix-loop` |

## Contract

### PC mid-match

| Rule | Detail |
|------|--------|
| Place | **Center seam** between partner \| you (`.stage-brand-center`) — **not** partner tile bottom |
| Pill | `.stage-brand-spin` whole-pill; vertical-rl wordmark |
| Gate | CSS animates only under **`.stage.has-brand-live`** |
| Wire | `setStageBrandLive(isLive)` from **`syncMatchChrome`** (also startMatchTimer / keep-PC rematch; stop clears only when not live) |
| Tile marks | `.stage-wm` **hidden** on match-live / has-brand-live |
| Enter | **P2** one-shot flourish ~**1.0s** (mid scale ~**1.18**) then long loop |
| Cycle | Still → glow → one **quick 360°** (~**0.7s**) → **20s** still (`stage-brand-pulse-spin` **22s**) |
| Hold | Static upright between spins (no continuous rotate, no idle breath) |
| Glass | **P3** denser plate + brand-blue rim (dark); light/pink/matrix/saloon variants |
| Wordmark | Full **`ruletka.me`** never clip |
| Clicks | `pointer-events: none` |
| a11y | `prefers-reduced-motion: reduce` → static upright |

### Android mid-match

| Rule | Detail |
|------|--------|
| Place | **Bottom-middle** of partner/conversationalist video |
| Spin | Still → glow → one quick **360°** → **20s** rest |
| Component | `BrandWatermark.tsx` |

### Android idle / search

| Rule | Detail |
|------|--------|
| `BrandLoadingLoop` + HQ `assets/brand/loading-screen.mp4` | Full stage; local PiP |

### Match SFX (PC web)

| Rule | Detail |
|------|--------|
| Asset | `ui/sounds/match.mp3` (spin-style chime; cache `?v=1`) |
| Play | `playMatchChime()` / `getMatchChimeAudio()` in `live.js` |

## Source of truth

| Path | Use |
|------|-----|
| `ui/live-brand.css` | PC seams + glow/spin keyframes; tile hide; body behind **`?v=23`** |
| `ui/live.html` | `#stage-brand-center`; **`live-brand.css?v=23`** · **`live.js?v=756`** |
| `ui/live.js` | `setStageBrandLive` · `applyStageLayoutMode` → `data-brand-seam` · match chime |
| `ui/sounds/match.mp3` | Match-link spin chime |
| `knowledge/raw/2026-08-12-brand-spin-smoke.md` | Human browser smoke steps (P5) |
| `knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md` | P0–P5 improve stack |
| `mobile/src/live/BrandWatermark.tsx` | Android match mark |
| `mobile/src/live/BrandLoadingLoop.tsx` | Android search loop |

## DONE WHEN

- [ ] PC: **center seam** still → glow → one quick 360° → 20s still
- [ ] PC: Matched / friend_call / trio → **`main.stage.has-brand-live`**; hangup clears
- [ ] Android: bottom-middle still → glow → one quick 360° → 20s still
- [ ] Full `ruletka.me` readable
- [ ] Ship pin `live-brand.css?v=` matches disk after CSS feel edits
- [ ] **GOAL_MET** only after human browser smoke — no invent PASS

## MUST NOT

1. MediaSession / ICE thrash for brand-only  
2. Put PC mark on partner tile bottom (user wants seam)  
3. Dual seam + tile visible  
4. Clip wordmark  
5. Leave `html.match-live` without `has-brand-live` (wire only in timer — use `syncMatchChrome`)  
6. Invent human spin-feel PASS / GOAL_MET without browser smoke  
7. Dual-write `live-brand.css` from non-brand OWN; thrash `live.js` for brand-only  

## Related

- `mobile-match-identity` · `av-fix-loop` · `knowledge-compound` · `multi-party-stage`
