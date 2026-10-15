# Task: iOS partner blur visual vs Android SoftBlur

## Spec
`knowledge/specs/current-ios-parity.md` + skill android-partner-paint (do not remount RTCView)

## OWN
- `mobile/src/live/SoftBlurRemote.tsx`
- `mobile/src/live/PartnerBlurVeil.tsx`

## Goal
Android uses SoftBlur decode. iOS currently `return false` for useNativeSoftBlur. Provide an iOS veil that *looks* like Android hide/soft-blur without unmounting the video.

## Must not
MediaSession.ts, live.tsx, forceRepaintRemote remount, deploy

## Done
- [ ] iOS blur/veil path that does not unmount partner video
- [ ] RESULT: remaining gap vs Android SoftBlur
- [ ] COMPLETE
