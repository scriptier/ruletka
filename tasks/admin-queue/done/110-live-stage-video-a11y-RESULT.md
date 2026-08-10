# 110 — LiveStageVideo a11y labels

## Status
COMPLETE

## Audit findings
`mobile/src/live/LiveStageVideo.tsx` had zero `accessibilityLabel`/`accessibilityRole`
props anywhere, unlike every sibling component in `mobile/src/live/` (`LiveBottomBar`,
`LiveConnPill`, `LiveMoreSheet`, `LiveStatusBanners`, etc.), which consistently pair
`accessibilityRole="button"` with `accessibilityLabel` on `Pressable`s.

Notably, `labels.longPressReport` (`L.longPressReport`) is declared in the props type
and passed down from `mobile/app/live.tsx:3808`, but was never consumed anywhere in
the file — a dead prop that was clearly intended to surface the "long-press video to
report" affordance to screen readers.

## Changes
Added `accessibilityRole`/`accessibilityLabel`/`accessibilityHint` to the three
interactive stage containers, matching each one's existing visible text/behavior
(no zOrder, connect, or gesture-logic changes):

1. **Split-tile `Pressable`** (multi-peer layout, ~line 211): label mirrors the
   visible tile text (`tile.name` + `· {L.focus}` for the focused tile). Suppressed
   while `privacyBlur` is active (no stream to describe).
2. **Main stage placeholder `Pressable`** (~line 312): label built from
   `partnerName`, `partnerLoc`, and the current retry/status text (`L.retryHard` /
   `L.retrying` / `emptyStatus`), only when `phase === "matched"` (matches when the
   connect card is actually visible). `accessibilityHint` now surfaces
   `L.longPressReport` when `onReport` is available.
3. **`remoteTapLayer` `Pressable`** (full-bleed double-tap-to-reblur overlay,
   ~line 441): `accessibilityLabel={partnerName}`, and `accessibilityHint` wired to
   `L.longPressReport` (gated on `!isFriendCall && onReport`, matching the existing
   `onLongPress` guard).

## Files touched
- `mobile/src/live/LiveStageVideo.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — pre-existing unrelated errors only
  (missing `node_modules` type declarations in `app/live.tsx`, `MediaSession.ts`,
  etc.); no new errors, none in `LiveStageVideo.tsx`.

## Connect risk
none — no zOrder, MediaSession, offer/ICE/TURN, or connect-flow logic touched.
Only additive accessibility props on existing `Pressable`s; `onPress`/`onLongPress`/
`disabled` logic left byte-for-byte identical.

COMPLETE
