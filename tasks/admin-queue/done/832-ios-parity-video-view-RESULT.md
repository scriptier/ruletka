# 832 — iOS VideoView / RTCView objectFit

## Status
COMPLETE

## Root cause
`react-native-webrtc`'s iOS native view (`RTCVideoViewManager.m`) initializes
`_objectFit` to `RTCVideoViewObjectFitCover` in `initWithFrame:`, but its
`setObjectFit:` setter only calls `self.videoView.videoContentMode = ...`
when the incoming value **differs** from the cached `_objectFit`. Since our
JS always passed `objectFit="cover"` on mount (same as the native default),
the setter's guard skipped the body and `videoContentMode` was never
explicitly set — so the partner video rendered at whatever
`RTCMTLVideoView`'s true internal default is (aspect-fit / letterboxed),
never filling like Android. Android's `WebRTCView` has no such guard, so it
was unaffected (already correct).

## Fix
`mobile/src/live/VideoView.tsx`: on iOS only, mount `RTCView` with
`objectFit="contain"` and flip to `"cover"` one `requestAnimationFrame`
later, on the same native view instance (the `key` — url/epoch/zOrder — is
unchanged, so no remount). This forces the native setter to see a real
`contain → cover` transition and actually apply
`UIViewContentModeScaleAspectFill`. Android path is untouched (`objectFit`
stays a static `"cover"` string, same as before).

## Files touched
- `mobile/src/live/VideoView.tsx`

## Verify commands run
- `npx tsc --noEmit` (mobile/) — no new errors introduced; pre-existing
  unrelated errors in other files (missing `expo-*` type declarations,
  `live.tsx` issues) are unchanged and untouched by this diff. No errors
  reference `VideoView.tsx`.
- No iOS device/simulator available in this environment to visually verify;
  this is a code-level fix for a documented react-native-webrtc iOS
  behavior (guarded setter skips the `cover` case when it matches the
  native default). Recommend a phone smoke test on next iOS build to
  confirm the partner video now fills the frame instead of
  letterboxing.

## Connect risk
none — no changes to MediaSession, live.tsx, offer/answer, ICE/TURN, or
CONNECTIVITY_LOCK. Android rendering path unchanged. iOS-only prop timing
change on a view that doesn't own the peer connection.

COMPLETE
