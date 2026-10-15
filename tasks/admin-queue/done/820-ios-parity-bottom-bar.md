# Task: iOS LiveBottomBar / liveStyles safe-area parity

## Spec
`knowledge/specs/current-ios-parity.md`

## OWN
- `mobile/src/live/LiveBottomBar.tsx`
- `mobile/src/live/liveStyles.ts`

## Goal
iPhone home indicator / notch: Stop/Next/Start diamond sit like Android 475 (idle: Start on diamond, no Stop/Next until Start). Use SafeAreaInsets already in LiveBottomBar — tighten iOS padding so bars aren't under the home pill or overlapping the partner tile.

## Must not
MediaSession.ts, live.tsx, webrtc, deploy, APK, invent GOAL_MET

## Done
- [ ] iOS padding/safe area in liveStyles or LiveBottomBar
- [ ] idleBeforeStart still hides Stop/Next
- [ ] RESULT + COMPLETE
