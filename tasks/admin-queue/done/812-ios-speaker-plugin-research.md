# Task: iOS default-to-speaker research (read-only + optional plugin stub)

## Goal
802 flagged: expo-av cannot set defaultToSpeaker. Document the smallest Expo config-plugin (or webrtc InCallManager) path. Do **not** thrash MediaSession.

## OWN
- `docs/IOS_SPEAKER.md` (create)
- optional `mobile/plugins/withIosDefaultToSpeaker.js` **only if** it is a 20-line config plugin and you also add one line to `mobile/app.config.js` plugins array — if that risks a bad prebuild, **docs only**.

## Must not
- MediaSession.ts, live.tsx, webrtc.js, pool>0, eas build

## Done
- [ ] RESULT: recommend plugin vs InCallManager vs leave as-is for TestFlight 1
- [ ] COMPLETE
