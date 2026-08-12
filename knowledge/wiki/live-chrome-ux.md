# Live chrome UX (PC browser rails / autohide / brand)

Desktop live stage: partner + local side rails and floor trays hide after idle so video is full-bleed; hover/move shows them again. Mid-match brand lives on the **center seam**, not tile corners.

## Target artifacts (on disk 2026-08-11)

| Piece | Version / path |
|-------|----------------|
| JS (chrome hop) | `ui/live.js` — `wireTileChromeAutohide()`, `CHROME_AUTOHIDE_MS = 3000` (landed ~`?v=542`) |
| JS (current ship) | `ui/live.js?v=551` — identity re-paint + who-sub hide; cache-bust in `live.html` |
| Stage CSS | `ui/live-stage.css?v=379` |
| Brand CSS | `ui/live-brand.css?v=10` — center seam + 360° loop; tile `.stage-wm` force-hidden |
| HTML | `ui/live.html` links stage `?v=379`, brand `?v=10`, `live.js?v=551` |

## Brand watermark (PC mid-match)

Contract skill: `brand-stage`. Source: `ui/live-brand.css`, `#stage-brand-center` in `live.html`.

| Rule | Detail |
|------|--------|
| Place | **Center seam** vertical wordmark between partner \| you (`.stage-brand-center` / `.stage-brand-spin`) |
| Spin | Soft **360°** (~1.2s) every **15s** upright (`stage-brand-spin-360-loop` **16.2s** cycle) |
| Tile marks | `.stage-wm` / `.stage-wm-local` **hidden** on match-live (center seam owns brand) |
| Wordmark | Full **`ruletka.me`** — never clip |
| Clicks | `pointer-events: none` |
| Not this page | Android `BrandWatermark` bottom-middle → [mobile-ux](mobile-ux.md) |

**MUST NOT:** move PC mark to partner tile bottom; dual seam + tile visible; thrash MediaSession for brand-only.

## Intended behavior (chrome autohide)

1. **Fine pointer (mouse):** `html.chrome-autohide` on; rails/floors start hidden.
2. **Enter / move on tile:** JS adds `.is-chrome-open` → CSS shows that tile’s chrome.
3. **3s idle:** `scheduleHide` removes `.is-chrome-open` unless a flyout/sheet is open.
4. **Coarse / touch:** `html.chrome-always` (no autohide) — CSS media keeps controls visible.
5. **Settings / flyouts open:** keep **local** right rail (or partner floor) visible while sheet/flyout open — do not force permanent always-on.

CSS sides under autohide (all hide when not open):

| Tile | Hidden when idle |
|------|------------------|
| Remote | left rail, floor-partner, layout btn |
| Local | right rail (Flip/Mic/Hide/Settings), floor-local |

Identity / stars badges stay visible (z-index forced; not part of autohide rails). Fullscreen btn stays available under autohide.

## Bug restored (2026-08-11)

| | |
|--|--|
| **Symptom** | Local rail (Settings etc.) never hid; chrome felt “always on” forever |
| **Root** | `wireTileChromeAutohide` forced **chrome-always + pin every 2s** (workaround for “settings vanished”); CSS never applied hide to local rail under autohide |
| **Fix** | Idle **3s** `scheduleHide`; CSS hides **all sides** under `html.chrome-autohide`; show only with `.is-chrome-open` or open settings/flyout selectors |

## MUST NOT (gotcha)

- **Do not** disable chrome-autohide / force `chrome-always` forever because Settings “vanished.”
- Keep local rail visible **only while** `.is-chrome-open` **or** settings sheet / flyout is open (`sheet-settings-open`, `#settings-sheet.is-open`, `.is-flyout-open`, etc.).
- Identity vanishing under video is a **z-index** problem (badges ≥45 over `#local`), not a reason to pin rails forever.

## Related

- Android match chrome (SurfaceView / dock / BrandWatermark): [mobile-ux](mobile-ux.md)
- Identity dual-id / who-sub: [gotchas](gotchas.md) §17 · skill `mobile-match-identity`
- Brand place: [gotchas](gotchas.md) §19 · skill `brand-stage`
- Ship UX smoke checklist still human-gated: `../specs/SMOKE-NEXT.md`, `../specs/current-ship-ux.md`
- Anti-patterns: [gotchas](gotchas.md) §15

### Log

- 2026-08-11: page created — PC chrome autohide restored (`live.js?v=542`, `live-stage.css?v=374`). Code-on-disk compound; **human smoke still pending** (no agent PASS claim).
- 2026-08-11: brand contract filed — PC **center seam** 360°/15s; `.stage-wm` hidden; artifacts `live-brand.css?v=10`, ship `live.js?v=551` / stage `?v=379`.
