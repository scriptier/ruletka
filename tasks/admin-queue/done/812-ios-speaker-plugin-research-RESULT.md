# RESULT — 812-ios-speaker-plugin-research

## Status

Done.

## Files touched

- `docs/IOS_SPEAKER.md` (new)

No `mobile/plugins/withIosDefaultToSpeaker.js` was created — see below.

## What I found

Confirmed the `802` finding at the source level: `expo-av@15.0.2`'s native
iOS code (`EXAV.m::_updateAudioSessionCategoryForAudioSessionMode`) never
sets `.defaultToSpeaker` or calls `overrideOutputAudioPort`, and its JS
`AudioMode` type has no such field. Went one step further and checked
`react-native-webrtc@124.0.8`'s own JS surface
(`node_modules/react-native-webrtc/src/RTCAudioSession.ts` +
`ios/RCTWebRTC/WebRTCModule+RTCAudioSession.m`) — it also has no
speaker-forcing method exposed to JS, only `audioSessionDidActivate` /
`audioSessionDidDeactivate` for CallKit.

However, `react-native-webrtc` defaults to `useManualAudio=false`, so its
internal (native-only) `RTCAudioSession` takes over `AVAudioSession` once a
call's audio track is live, and sets mode `AVAudioSessionModeVideoChat`
whenever a video track is present — which Apple defaults to speaker output.
Since ruletka is video-first, this is very likely already correct without
any extra code; this mechanism is documented in `docs/IOS_SPEAKER.md`.
Neither this pass nor `802` had a physical iPhone to confirm on-device.

## Recommendation (see `docs/IOS_SPEAKER.md` for full detail)

- **TestFlight 1: leave as-is (Option A).** Zero new code/dependency/prebuild
  risk. Verify with one manual step during TestFlight 1 device smoke: call
  on a real iPhone, confirm audio comes out the speaker not the earpiece.
- **If that check fails:** add `react-native-incall-manager` (Option B) as a
  small dedicated follow-up task — mature autolinked module, same shape as
  the existing `@config-plugins/react-native-webrtc` entry, no `AppDelegate`
  patching needed.
- **Custom config plugin (Option C) — not recommended for TestFlight 1.**
  `withAppDelegate` string-injection mods are unverifiable without a
  physical iPhone/Mac (same constraint `802` hit) and are the most fragile
  class of Expo config plugin across SDK upgrades. This is exactly the "if
  that risks a bad prebuild, docs only" case the task flagged, so no plugin
  stub was written.

## Verify commands run

```bash
grep -n "react-native-incall-manager|InCallManager" mobile/package.json mobile/package-lock.json
# no output — not currently a dependency, confirms Option B would be new

grep -rn "speaker|Speaker|overrideOutputAudioPort" mobile/node_modules/react-native-webrtc/src \
  mobile/node_modules/react-native-webrtc/ios/RCTWebRTC/WebRTCModule+RTCAudioSession.m
# no output — confirms no JS-reachable speaker API in react-native-webrtc

cat mobile/node_modules/react-native-webrtc/ios/RCTWebRTC/WebRTCModule+RTCAudioSession.m
# only audioSessionDidActivate / audioSessionDidDeactivate exported
```

## Connect risk

**none** — read-only research plus one new doc file. No edits to
`MediaSession.ts`, `live.tsx`, `webrtc.js`, `app.config.js`, or any OWN file
outside `docs/IOS_SPEAKER.md`. No new native dependency, no `pool>0`, no EAS
build attempted.

COMPLETE
