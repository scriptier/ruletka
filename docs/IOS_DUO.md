# iOS you-tile mic/flip parity vs web

Follow-up to `knowledge/specs/current-ios-parity.md`. Web puts cam/mic
controls directly on the **you tile**; Android 477 moved to a partner-tile
identity cluster but kept mic/flip in the bottom bar, not on the tile. This
doc records the remaining gap for iOS and why it's not fixed in this pass.

## Web (`ui/live.html`)

The local video tile (`#local-*`) has its own `<aside class="side-rail
side-rail-right">` docked to the tile: **Flip** (`#btn-flip-cam`), **Mic**
mute (`#btn-mute-mic`) with a live level meter, **Hide** (self-blur), and
**Settings** — all rendered as an overlay on top of the you-tile itself, not
in a separate global bar.

## Android 0.1.477 / iOS (Expo, shared code)

`mobile/src/live/LiveStageVideo.tsx` renders a local/you tile
(`stageLayout.includeLocalTile`, `testID="live-you-tile-dock"`) but it is
video + identity dock only — no mic/flip overlay on the tile. Mic and Flip
live exclusively in `mobile/src/live/LiveBottomBar.tsx` (`live-mic-btn`,
`live-flip-btn`), a **global bottom bar shared by both platforms** with no
`Platform.OS` branch around those two buttons. So this is not an iOS
regression against Android — both mobile platforms currently match each
other and both diverge from web the same way.

`mobile/src/live/LiveMoreSheet.tsx` (the floating partner-actions sheet,
already touched by `826-ios-parity-more-banners` for safe-area insets) has a
leftover unused `onFlipCam` prop — a mic/flip row used to live there and was
removed in favor of the bottom bar. Nothing to resurrect: that sheet opens
per-partner-tap, not anchored to the you-tile, so putting flip/mic there
would not reproduce the web pattern (an always-visible overlay on your own
tile) — it would just be a second, harder-to-reach copy of the bottom-bar
buttons.

## FAIL vs web

**FAIL** — mic/flip are not on the you-tile on either mobile platform. They
are reachable (bottom bar), just not co-located with the self camera preview
the way web does it.

## Why this stays docs-only (not a LiveMoreSheet row)

A real fix (an overlay docked to the you-tile, matching web's side-rail)
touches `LiveStageVideo.tsx` layout and `liveStyles.ts` — both on this task's
**Must not** list, and doing it only for iOS would newly diverge iOS from
Android 477 (which the parity spec doesn't ask for; the spec wants iOS to
match Android's existing chrome, not to leapfrog it). `LiveMoreSheet.tsx` is
the wrong location for this fix (see above), and it's already owned by
`826` for this parity chain, so no attempt was made there.

**Recommended follow-up** (own scope, needs `LiveStageVideo.tsx` +
`liveStyles.ts`, both platforms together): add a compact mic/flip overlay
docked to the you-tile in `LiveStageVideo.tsx`, gated so it doesn't collide
with the existing identity dock, and keep the bottom-bar buttons as the
primary control (overlay as a convenience, not a replacement) to avoid two
sources of truth for mic/flip state.
