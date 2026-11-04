# iOS default-to-speaker research

Follow-up to `802-ios-audio-push-gaps`, which flagged: `expo-av` cannot set
`defaultToSpeaker` on iOS. This doc surveys the three real options and
recommends one for TestFlight 1. Read-only research — no `MediaSession.ts`,
`live.tsx`, or `webrtc.js` changes.

## The claim, verified

**`expo-av` cannot do it.** `expo-av@15.0.2`'s native iOS side
(`EXAV.m::_updateAudioSessionCategoryForAudioSessionMode`) only ever sets
`AVAudioSessionCategoryPlayAndRecord` with `.duckOthers` / `.mixWithOthers` /
`.allowBluetooth` options. It never sets `.defaultToSpeaker` and never calls
`AVAudioSession.overrideOutputAudioPort`. The `AudioMode` type `expo-av`
exposes to JS has no such field — there's no way to reach this from
`mobile/src/feedback/audioSession.ts`, which is the only file wiring
`expo-av`'s `setAudioModeAsync` today.

**`react-native-webrtc@124.0.8`'s public JS API can't do it either.**
Checked `node_modules/react-native-webrtc/src/RTCAudioSession.ts` and the
matching native side
(`ios/RCTWebRTC/WebRTCModule+RTCAudioSession.m`): the only two exported
methods are `audioSessionDidActivate()` / `audioSessionDidDeactivate()`,
meant for CallKit integration. Neither touches route/output-port selection.
There is no `setForceSpeaker`-style call anywhere in this package's JS
surface.

**But it's very likely already working anyway.** `react-native-webrtc`
defaults to `useManualAudio = false`, meaning its internal `RTCAudioSession`
(part of the vendored WebRTC/Jitsi iOS SDK, not exposed to JS at all) takes
over `AVAudioSession` configuration the moment a WebRTC audio track goes
live — after `expo-av`'s `playAndRecord` category hands off. WebRTC's
built-in iOS audio session logic sets the session **mode** to
`AVAudioSessionModeVideoChat` whenever the call has an active video track
(ruletka's case — this is a video-chat app, not audio-only). Apple's
documented `AVAudioSession` behavior is that `.videoChat` mode defaults
output to the speaker unless a headset/Bluetooth device is attached — this
is *why* most RN-WebRTC video-calling apps never need an extra
speaker-forcing library; it only tends to bite **audio-only** WebRTC apps,
where WebRTC instead picks `AVAudioSessionModeVoiceChat` (earpiece-default).

This matches the comment already in `mobile/src/feedback/audioSession.ts`
("call" mode) and the conclusion of the `802` RESULT — neither was able to
confirm on a physical iPhone, since no iPhone was available in that pass
either.

## Options for TestFlight 1

### A — Leave as-is (recommended)

Do nothing. Ship TestFlight 1 with the current `expo-av` "call" mode +
`react-native-webrtc`'s default `useManualAudio=false` behavior, and confirm
with one manual step: **on a real iPhone, start a call and check the audio
comes out of the speaker, not the earpiece.**

- Risk: none — zero new code, zero new native dependency, zero prebuild
  change.
- Cost: one on-device smoke check, which TestFlight 1 needs anyway.
- Why recommended: per the mechanism above, this is expected to already be
  correct for a video call. Spending native-plugin effort on a problem that
  may not exist is the wrong order of operations — verify first.

### B — `react-native-incall-manager` (fallback if A fails on-device)

If the smoke check in A shows calls routing to the earpiece, add
[`react-native-incall-manager`](https://github.com/react-native-webrtc/react-native-incall-manager)
(same GitHub org as `react-native-webrtc`, widely used alongside it). Call
`InCallManager.start({ media: 'video' })` on call start and
`InCallManager.setForceSpeakerphoneOn(true)` right after, then
`InCallManager.stop()` on call end.

- Risk: low. It's a mature, actively maintained autolinked native module —
  no `AppDelegate` string-patching, no custom config plugin needed, just
  `npx expo prebuild` picking it up like any other autolinked RN module
  (same shape as the existing `@config-plugins/react-native-webrtc` entry in
  `app.config.js`).
- Cost: new dependency, a few call sites where `MediaSession.ts` or
  `live.tsx` mark call start/end — **out of this task's OWN scope**, would
  be a small dedicated follow-up task if A doesn't hold.
- This is the standard, well-trodden fix in the RN-WebRTC ecosystem for
  exactly this symptom, so if A fails it's the next thing to reach for, not
  a custom plugin.

### C — Custom Expo config plugin (not recommended for TestFlight 1)

Write a `withAppDelegate` mod that injects Objective-C/Swift to call
`AVAudioSession.sharedInstance().overrideOutputAudioPort(.speaker)` (or set
`.defaultToSpeaker` in the category options) directly into
`AppDelegate.mm`/`.swift` at prebuild time.

- Risk: high, specifically because it's **unverifiable from this
  environment** — no iPhone/Mac available to build and run it (same
  constraint the `802` pass hit). `withAppDelegate` string-injection mods
  are also the most fragile category of Expo config plugin: they pattern-
  match against generated `AppDelegate` source, which changes shape across
  Expo SDK upgrades (the RN "New Architecture" AppDelegate looks nothing
  like the old one), so an unverified plugin can silently stop applying, or
  worse, break every subsequent `prebuild`/EAS build with no easy signal
  why.
- This is exactly the "if that risks a bad prebuild, docs only" case the
  task called out. Not attempting a plugin stub here — no
  `mobile/plugins/withIosDefaultToSpeaker.js` was created.

## Recommendation

**Ship TestFlight 1 with Option A (leave as-is).** Do a real-iPhone smoke
check for speaker-vs-earpiece routing as part of TestFlight 1 device smoke.
If (and only if) that check shows earpiece routing, pick up **Option B**
(`react-native-incall-manager`) as a small dedicated follow-up task with its
own OWN scope covering the `MediaSession.ts`/`live.tsx` call-start hookup.
Do not attempt Option C without a physical iPhone to verify against.
