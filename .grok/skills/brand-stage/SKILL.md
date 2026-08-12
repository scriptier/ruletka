---
name: brand-stage
description: >
  Stage brand watermark + idle loading loop for freenet-roulette / ruletka.
  PC mid-match: center seam .stage-brand-spin (vertical between partner|you);
  whole-pill soft 360° every 15s; tile .stage-wm hidden. Android: BrandWatermark
  bottom-middle of partner video; soft 360° every 15s. Idle/search Android:
  BrandLoadingLoop HQ loading-screen.mp4. Full "ruletka.me" never clip.
  MUST NOT thrash MediaSession for brand-only.
metadata:
  short-description: "Stage brand watermark + loading loop (no MediaSession)"
  learned: "2026-08-11"
  triggers:
    - brand watermark
    - stage-brand-spin
    - BrandWatermark
    - BrandLoadingLoop
    - ruletka.me clip
    - loading-screen.mp4
    - stage wordmark flip
---

# Brand stage (PC + Android)

You fix **stage branding only**: mid-match watermark placement/spin and idle
search loading video.  
You do **not** open WebRTC/ICE/MediaSession for brand-only FAILs.  
You do **not** rewrite match identity chrome — that is `mobile-match-identity`.

## When to use

| Symptom | This skill |
|---------|------------|
| PC mark moved to partner bottom (should be **center seam**) | Yes |
| Wrong spin (180° invert vs 360° every 15s) | Yes |
| Android mid-torso / not bottom-middle | Yes |
| Wordmark clipped | Yes |
| Loading video missing on Android search | Yes |
| Partner name / hex | **No** → `mobile-match-identity` |
| Black cams | **No** → `av-fix-loop` |

## Contract

### PC mid-match

| Rule | Detail |
|------|--------|
| Place | **Center seam** between partner \| you (`.stage-brand-center`) — **not** partner tile bottom |
| Pill | `.stage-brand-spin` whole-pill; vertical-rl wordmark |
| Tile marks | `.stage-wm` **hidden** on match-live |
| Cycle | Soft **360°** (~1.2s) every **15s** upright (`stage-brand-spin-360-loop` 16.2s) |
| Wordmark | Full **`ruletka.me`** never clip |
| Clicks | `pointer-events: none` |

### Android mid-match

| Rule | Detail |
|------|--------|
| Place | **Bottom-middle** of partner/conversationalist video |
| Spin | Soft **360°** every **15s** (not 180° invert hold) |
| Component | `BrandWatermark.tsx` |

### Android idle / search

| Rule | Detail |
|------|--------|
| `BrandLoadingLoop` + HQ `assets/brand/loading-screen.mp4` | Full stage; local PiP |

## Source of truth

| Path | Use |
|------|-----|
| `ui/live-brand.css` | PC center seam + 360° keyframes; tile hide |
| `ui/live.html` | `#stage-brand-center` / `#stage-wm` DOM; `live-brand.css?v=` |
| `mobile/src/live/BrandWatermark.tsx` | Android match mark |
| `mobile/src/live/BrandLoadingLoop.tsx` | Android search loop |

## DONE WHEN

- [ ] PC: **center seam** 360° every 15s; no bottom tile mark
- [ ] Android: bottom-middle 360° every 15s
- [ ] Full `ruletka.me` readable

## MUST NOT

1. MediaSession / ICE thrash for brand-only  
2. Put PC mark on partner tile bottom (user wants seam)  
3. Dual seam + tile visible  
4. Clip wordmark  

## Related

- `mobile-match-identity` · `av-fix-loop` · `knowledge-compound`
