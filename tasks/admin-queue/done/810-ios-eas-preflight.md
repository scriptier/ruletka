# Task: iOS EAS preflight (read + tiny config only)

## Goal
Make `eas build --platform ios --profile production --non-interactive` as ready as possible. Grok kicks the actual EAS build (Apple 2FA is human). You do **not** run eas build.

## Spec
`knowledge/specs/current-ios-app-store.md`

## OWN
- `docs/IOS_APP_STORE.md` (add a "First EAS build" checklist only)
- `mobile/assets/store/ios/WHAT-TO-TEST.md` (TestFlight "What to Test" paste)

## Must not
- MediaSession.ts, live.tsx, webrtc, eas.json (ascAppId already 6804910924)
- `eas build` / `eas submit` / git push / deploy
- invent TestFlight URL

## Done
- [ ] WHAT-TO-TEST.md: 18+ rules, camera+mic, Start vs ruletka.vip browser, friends call
- [ ] IOS_APP_STORE.md: first-build command `cd mobile && eas build --profile production --platform ios`
- [ ] RESULT: leftover human (Apple 2FA, screenshots)
- [ ] COMPLETE
