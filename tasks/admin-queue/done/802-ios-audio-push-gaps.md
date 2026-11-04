# Task: iOS camera/mic/audio/push parity vs Android

## Goal
Close **platform gaps** so iOS can Start a call like Android: permissions, audio session, incoming-call local notification. Not a connect ICE rewrite.

## Spec
`knowledge/specs/current-ios-app-store.md`

## OWN (write only these)
- `mobile/src/permissions/media.ts`
- `mobile/src/feedback/audioSession.ts`
- `mobile/src/push/localCallAlert.ts`
- `mobile/src/push/notifOptIn.ts`

## Must not
- MediaSession.ts, live.tsx, webrtc.js, HubClient.ts
- Android-only battery-opt-in rewrite except early-return on iOS (already)
- deploy, APK, pool>0

## Done
- [ ] media.ts: iOS camera+mic permission request (not `return true` skip if that blocks WebRTC)
- [ ] audioSession.ts: playAndRecord / speaker for iOS live (expo-av or existing helper)
- [ ] localCallAlert / notifOptIn: iOS notification permission path (no Android-only dead-end)
- [ ] RESULT: what still needs live.tsx (do not edit it) vs what you fixed
- [ ] COMPLETE

## Verify
Grep Platform.OS in OWN files. If there are tests `*.test.mjs` for these modules, run them.
