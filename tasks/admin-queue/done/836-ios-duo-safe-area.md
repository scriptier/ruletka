# Task: iOS 1v1 browser-duo safe area (partner | you)

## Spec
`knowledge/specs/current-ios-parity.md`

Grok already shipped Android/shared 1v1: portrait partner TOP / you BOTTOM; landscape partner LEFT / you RIGHT (`youTileDock` / `youTileDockWide` in liveStyles + LiveStageVideo). Do **not** remount RTCView.

## OWN
- `mobile/src/live/PartnerIdentityDock.tsx`
- `mobile/src/live/LiveBottomBar.tsx`

## Goal
On iPhone: name/★ not under notch in portrait; not under landscape status. hideSearchControls already used from live.tsx — keep Stop/Next off the bar in browser 1v1. Extra iOS padding only.

## Must not
LiveStageVideo.tsx, liveStyles.ts, MediaSession, live.tsx, deploy, remount RTCView

## Done
- [ ] iOS insets for dock on split 1v1
- [ ] RESULT + COMPLETE
