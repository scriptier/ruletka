# 836 — iOS 1v1 browser-duo safe area (partner | you)

## Status
COMPLETE

## What changed
Both fixes are additive, `Platform.OS === "ios"` gated inline style objects — no
shared style files touched, no RTCView remount, no MediaSession/live.tsx edits.

### `mobile/src/live/PartnerIdentityDock.tsx`
- Existing iOS-only top-strip inset (`iosTopStyle`) only floored `paddingTop`
  for portrait (notch/Dynamic Island at the top). In landscape the notch
  moves to one side (`insets.left` xor `insets.right`) and `insets.top` drops
  near 0, so the name/★/loc row could still sit under the rotated
  sensor housing.
- Added `useWindowDimensions` landscape detection (`winW > winH`) and now
  compute `paddingLeft`/`paddingRight` as `12 + insets.left` / `12 + insets.right`
  (12 is `partnerIdentityTopStrip`'s existing base horizontal padding, so
  portrait — where these insets are ~0 — is unchanged). `paddingTop` switches
  to a smaller landscape floor (`max(insets.top, 8) + 4`) instead of the
  portrait 44+6 floor.

### `mobile/src/live/LiveBottomBar.tsx`
- Added the same landscape detection. New `iosSideStyle` (iOS + landscape
  only) applies `paddingLeft: insets.left`, `paddingRight: insets.right` to
  the two internal rows (search-controls row, icon row) so the mic/flip/
  mute/blur/more/settings icons don't land under the side notch/rotated
  home-indicator strip. `styles.row` has no existing horizontal padding, so
  this is purely additive.
- `hideSearchControls` (browser-duo 1v1 → Stop/Next off this bar) was already
  wired from live.tsx; left untouched and re-verified it still keeps
  Stop/Next off the bar for `isBrowserLayout && matched && extraPeers.length < 1`.

## Files touched
- `mobile/src/live/PartnerIdentityDock.tsx`
- `mobile/src/live/LiveBottomBar.tsx`

## Verify commands run
- `cd mobile && npx tsc --noEmit` — pre-existing repo-wide errors only
  (missing native modules like `expo-clipboard`/`expo-av`, unrelated
  `live.tsx` issues); no errors in either owned file.
- `grep -n "Platform.OS" mobile/src/live/PartnerIdentityDock.tsx mobile/src/live/LiveBottomBar.tsx` —
  confirms both new branches are `Platform.OS === "ios"` gated, Android path
  unchanged.
- No device/TestFlight smoke available in this sandbox — human should verify
  on an iPhone with a Dynamic Island/notch in landscape (rotate both ways)
  during a browser 1v1 match.

## Connect risk
none — no hub/ICE/MediaSession/offer files touched; changes are inline style
additions gated to iOS, no RTCView remount, no `live.tsx` edit.

COMPLETE
