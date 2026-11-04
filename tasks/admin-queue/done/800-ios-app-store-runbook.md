# Task: iOS App Store runbook + listing pack

## Goal
Prepare Apple listing the same way we did Play/RuStore — **Expo app, not a Swift rewrite**. Human still owns Apple Developer + TestFlight.

## Spec
`knowledge/specs/current-ios-app-store.md`

## OWN (write only these)
- `docs/IOS_APP_STORE.md` (create)
- `mobile/assets/store/ios/` (create LISTING.md EN + RU short/full, review notes, age 17+)

## Must not
- MediaSession.ts, live.tsx, ui/webrtc.js, ui/live.js
- pool>0, push.sh, git push, deploy, APK/AAB/IPA build
- invent App Store APPROVED / GOAL_MET
- edit app.json / eas.json (other lane)

## Done
- [ ] `docs/IOS_APP_STORE.md`: EAS iOS production steps, ascAppId how-to, 17+ rating, camera/mic strings, ITSAppUsesNonExemptEncryption, TestFlight smoke vs ruletka.vip, friends-only contingency
- [ ] `mobile/assets/store/ios/LISTING.md`: App name, subtitle, keywords (100 char), short, description, what's new, support URL, privacy URL (use ruletka.me / ruletka.vip legal URLs from STORE.md)
- [ ] RESULT.md with files + leftover human steps
- [ ] COMPLETE

## Verify
No MediaSession diffs. Listing URLs match STORE.md.
