# RESULT: 841-ios-duo-mic-rail

## Status
COMPLETE (docs-only, per task's own tie-break rule)

## Decision: docs, not LiveMoreSheet
Checked `tasks/admin-queue/done/826-ios-parity-more-banners-RESULT.md`: 826
already touched `mobile/src/live/LiveMoreSheet.tsx` (iOS safe-area padding
on the floating card + ScrollView) in this same parity chain, so per this
task's own rule ("Prefer docs if LiveMoreSheet is already owned by 826") I
did not add a row there. Also confirmed a row wouldn't fit the ask anyway:
`LiveMoreSheet` is a per-partner-tap floating sheet, not an overlay
anchored to the you-tile, so a mic/flip row there would be a second, harder-
to-reach copy of the bottom-bar buttons — not the web pattern (self-tile
side-rail) the spec is chasing.

## What I found (remaining FAIL vs web, mic on you tile)
- **Web** (`ui/live.html`): the local/you video tile has its own
  `<aside class="side-rail side-rail-right">` docked directly on the tile —
  Flip (`#btn-flip-cam`), Mic mute (`#btn-mute-mic` + live level meter),
  Hide (self-blur), Settings. Controls live on the self camera preview
  itself.
- **Android 0.1.477 and iOS** (Expo, shared code): `LiveStageVideo.tsx`
  renders a you-tile (`testID="live-you-tile-dock"`) but it's video +
  identity dock only, no mic/flip overlay. Mic and Flip live only in
  `LiveBottomBar.tsx` (`live-mic-btn` / `live-flip-btn`), a bottom bar with
  **no `Platform.OS` branch** around those two buttons — i.e. Android and
  iOS already match each other here; this is not an iOS-specific
  regression, both mobile platforms diverge from web the same way.
- `LiveMoreSheet.tsx` has a leftover unused `onFlipCam` prop — a flip row
  used to live in that sheet and was removed in favor of the bottom bar.
  Confirms the sheet is the wrong place to reintroduce it.
- **FAIL**: mic/flip are reachable (bottom bar) but not co-located with the
  you-tile on either mobile platform, unlike web.

## What changed
- Added `docs/IOS_DUO.md` (new file — didn't exist yet under that name in
  this worktree or the main tree). Documents the web vs. mobile behavior
  above, why a fix belongs in `LiveStageVideo.tsx` + `liveStyles.ts` (both
  on this task's Must-not list, and a real anchored-overlay fix would need
  to be done for both platforms together to avoid newly diverging iOS from
  Android 477), and records a recommended follow-up task shape.

## Files touched
- `docs/IOS_DUO.md` (new)

No `LiveStageVideo.tsx`, `liveStyles.ts`, `MediaSession`, `live.tsx`, or
`LiveMoreSheet.tsx` changes made.

## Verify commands run
- `git status --short docs/IOS_DUO.md` — confirms only the new doc is
  staged/untracked from this task; no other files touched.
- Read-only review of `ui/live.html` (side-rail markup), `LiveStageVideo.tsx`
  (you-tile render, no mic/flip), `LiveBottomBar.tsx` (mic/flip buttons, no
  `Platform.OS` branch on them), and `LiveMoreSheet.tsx` (leftover
  `onFlipCam` prop) to source the doc's claims. No build/tsc run — no code
  changed.

## Connect risk
none — docs-only change, no hub/ICE/MediaSession/live.tsx/LiveStageVideo
touch.

COMPLETE
