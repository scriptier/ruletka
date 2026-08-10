# 037 RESULT — Hotkeys taller + scroll

**COMPLETE**

## CSS approach
- Settings hotkeys view already had scrollable body (`#settings-view-hotkeys .settings-body` flex + `overflow-y: auto`) from prior polish.
- `?` keys-help overlay: taller card `max-height: min(92dvh, 720px)` (was 88dvh/640px), list remains `overflow-y: auto` with sticky head.

## Files
- `ui/live-stage.css` — `.keys-help-card` max-height / width polish

## Risk
**safe** — CSS only, no WebRTC/match.

## Connect risk
None.
