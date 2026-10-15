# Task: second critic — iOS App Store pack (read-only)

## Goal
Read-only critic after sibling lanes. Catch missing Apple checklist vs Android Play pack.

## OWN
- **none** (read-only). Do not edit production code.

## Read
- knowledge/specs/current-ios-app-store.md
- docs/STORE.md
- docs/IOS_APP_STORE.md (if present)
- mobile/eas.json
- mobile/app.json
- mobile/assets/store/ios/ (if present)
- mobile/src/permissions/media.ts

## Must not
- any file write except RESULT in the task report path the factory already uses
- deploy, APK, ICE

## Done
- [ ] RESULT: gaps vs Play (listing, privacy, 17+, TestFlight, WebRTC Expo Go, encryption export)
- [ ] What human must do before first `eas build --platform ios`
- [ ] COMPLETE (critic)
