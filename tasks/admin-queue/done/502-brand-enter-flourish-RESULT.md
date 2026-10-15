# 502-brand-enter-flourish RESULT

**Date:** 2026-08-12
**Skill:** `brand-stage`
**Status:** **COMPLETE** — verified in place on disk, CSS-only, not deployed

## Goal
One snappy intro 360° (or scale pop) when match goes live, then settle into the ~16s loop.

## Finding
This worktree already carries the P2 enter-flourish implementation (from a prior
`BRAND-P2-enter-flourish` hop, pinned `live-brand.css?v=16`). I verified the existing
code against this task's spec instead of re-implementing:

- Gate: `.stage.has-brand-live .stage-brand-spin` runs a two-animation list —
  `stage-brand-enter-flourish 1s 1 both` (one-shot) followed by
  `stage-brand-spin-360-loop 16.2s infinite 1s` (long loop delayed 1.0s so it
  hands off cleanly after the flourish settles). `ui/live-brand.css:429-436`.
- Flourish keyframes: 0% pop-in (scale 0.94/opacity 0.82) → 48% peak
  (rotate 180°, scale 1.18, opacity 1, stronger glow) → 100% settle
  (rotate 360°, scale 1, opacity 0.9) — total **1.0s**, within the ≤1.2s budget.
  `ui/live-brand.css:207-246`.
- `prefers-reduced-motion: reduce` kills both the flourish and the loop —
  `.stage.has-brand-live .stage-brand-spin { animation: none; ... }`, static
  upright opacity 0.92. `ui/live-brand.css:438-452`.
- `setStageBrandLive` in `ui/live.js` is a plain class toggle (`has-brand-live`
  on/off) — no one-shot JS class, no thrash; the CSS animation list restarts
  naturally whenever the gate class is re-applied on rematch. `ui/live.js:29978`.

No code changes were needed — the CSS-only path already satisfies this task's
Do/Must-not list.

## Files touched
None (verification only).

## Verify
- Read `ui/live-brand.css:193-274` (flourish keyframes + loop hand-off + P2 timing note).
- Read `ui/live-brand.css:429-452` (animation list + reduced-motion kill).
- Grepped `ui/live.js` for `setStageBrandLive` — confirmed unchanged, no `brand-enter` JS class.

## Connect risk
**none** — no CONNECTIVITY_LOCK / offer / ICE / TURN / MediaSession touched.

## Not touched
- `live.js`, `live-stage.css`, mobile, APK, deploy.

**COMPLETE**
