# Task: iOS EAS + app.json / app.config.js store keys

## Goal
Make EAS iOS production config ready so a human can `eas build --platform ios --profile production`.

## Spec
`knowledge/specs/current-ios-app-store.md`

## OWN (write only these)
- `mobile/eas.json`
- `mobile/app.json` (ios + infoPlist keys only; do **not** bump android versionCode)
- `mobile/app.config.js` (ios merge / privacyManifests / build-properties ios only)

## Must not
- MediaSession.ts, live.tsx, webrtc
- bump 0.1.476 / versionCode 484
- deploy, git push, run eas build (no Apple creds here)
- invent ascAppId — keep REPLACE_ASC_APP_ID with a comment pointing at App Store Connect

## Done
- [ ] `ITSAppUsesNonExemptEncryption` = false (HTTPS/WebRTC only)
- [ ] Camera/mic usage strings remain; add photo library **only if** avatar picker needs it
- [ ] Background modes: audio if WebRTC needs it while locked; do not add location
- [ ] Privacy manifest / NSPrivacyAccessedAPITypes if Expo requires
- [ ] eas.json production ios notes; submit.ios.ascAppId still placeholder unless already real
- [ ] RESULT + COMPLETE

## Verify
`python3 -c "import json; json.load(open('mobile/eas.json')); json.load(open('mobile/app.json'))"`
`node -e "require('./mobile/app.config.js')"` from mobile/ if needed
