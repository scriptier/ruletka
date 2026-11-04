# Task: iOS IdleArcadeStart + BrandWatermark placement

## Spec
`knowledge/specs/current-ios-parity.md`

## OWN
- `mobile/src/live/IdleArcadeStart.tsx`
- `mobile/src/live/BrandWatermark.tsx`
- `mobile/src/live/BrandLoadingLoop.tsx`

## Goal
Start button on the gold diamond (~70% of 720×1096 loop) must not sit under the iPhone Dynamic Island / home indicator. Brand watermark on partner video: same 30s spin as Android.

## Must not
live.tsx, MediaSession, liveStyles.ts (820 owns it), deploy

## Done
- [ ] iOS-only offset if needed (Platform.OS === 'ios')
- [ ] RESULT + COMPLETE
