# Compound digest — PC chrome autohide + Android gift FX (2026-08-11)

Product lessons filed into wiki without smoke claims or ICE thrash.

1. **PC chrome autohide restored** — root cause was `wireTileChromeAutohide` forcing always-on + pin, and CSS not hiding local rail. Fix on disk: `live.js?v=542` (3s idle `scheduleHide`), `live-stage.css?v=374` (all-sides under `html.chrome-autohide`). Keep rail only while open or settings/flyout open.
2. **Android gift FX** — APK **0.1.330-vc338**: `GiftFxOverlay.tsx` animates heart/flowers/fireworks with soft tint and elevation; still not full web CSS parity.
3. **Human device smoke still pending** — do not GOAL_MET.

Wiki: `live-chrome-ux.md`, `mobile-ux.md`, `gotchas.md`, `index.md`, `log.md`.
