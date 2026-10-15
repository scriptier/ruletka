# FX visual second critic (read-only)

## Goal
Second critic on mid-match gift FX visuals for ruletka browser. Rank the **smallest high-ROI CSS/JS hops** to make every catalog effect read more premium **without** touching video/WebRTC.

Kinds: heart, bars, fence, flowers, balloons, confetti, shooting_star, snow, spotlight, crown, pass_mic, fireworks, please_stay.

## OWN
- READ `ui/live-stage.css` (`.fx-*` only)
- READ `ui/live.js` (`ensure*Fx`, `playFireworksCanvasBurst`)
- READ `ui/live.html` fx-overlay markup
- WRITE only `tasks/admin-queue/done/780-fx-visual-critic-RESULT.md`

## Must not
- Edit product CSS/JS/HTML
- MediaSession / ICE / deploy / APK / push
- `filter` / `transform` on `<video>`
- Invent GOAL_MET / product.ok

## Done
RESULT with:
1. Current cheap-now line per kind (one sentence)
2. Recommended hop list (max 8, ranked) — file + selector + what to change
3. MUST NOT
4. Verify plan (preview + gift-kinds)

COMPLETE when RESULT is written.
