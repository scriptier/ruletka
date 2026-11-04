# RESULT: 501 — Nightly: PC brand idle breath between spins (P1)

## Status
DONE

## What changed
Extended the existing `stage-brand-spin-360-loop` keyframe (used only while `.stage.has-brand-live`) so the hold phase after the 360° settle (11.728%) is no longer perfectly static. Added a low-amplitude opacity/halo breath cycle across 22% → 32% → 42% → 52% → 62% → 72% → 82% → 100%, alternating opacity 0.97 (inhale) / 0.87 (exhale) with a matching soft box-shadow glow swing. `transform` stays pinned at `rotate(360deg) scale(1)` for every hold keyframe, so the breath never fights the spin/scale motion and there's no second spin.

Chose to extend the single existing keyframe rather than adding a second `animation-name` to the list — avoids any risk of the two animations fighting over `transform`/`opacity`/`box-shadow` timing, and keeps the one-shot enter flourish + long loop composition unchanged.

Reduced motion: `@media (prefers-reduced-motion: reduce)` already forces `.stage.has-brand-live .stage-brand-spin { animation: none; ... }`, which fully disables the breath along with the spin (static upright pill, opacity 0.92).

## Files touched
- `ui/live-brand.css` (only file per task OWN)

## Verify commands run
- `node -e` brace-balance check on `ui/live-brand.css` → OK (depth 0, no mismatch)
- Manual read-through of `@keyframes stage-brand-spin-360-loop` (hold-phase keyframes 22%–100%) and `@media (prefers-reduced-motion: reduce)` block to confirm breath is gated off correctly

No dev server / visual smoke run in this pass (CSS-only, text-based verification per task scope). Recommend a quick visual check of the center-seam pill during a live match hold phase before merge.

## Connect risk
none — CSS-only change to a decorative stage-brand pill; no touch to hub/ICE/offer/MediaSession/connectivity code.

COMPLETE
