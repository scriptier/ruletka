# RESULT — 802-ios-audio-push-gaps

## Status

Done.

## Files touched

- `mobile/src/permissions/media.ts`
- `mobile/src/feedback/audioSession.ts`
- `mobile/src/push/localCallAlert.ts`
- `mobile/src/push/notifOptIn.ts`

## What changed

### `permissions/media.ts` — real iOS camera+mic check/request

Previously `hasMediaPermissions()`/`ensureMediaPermissions()` short-circuited to
`allGranted: true` on any non-Android platform without asking the OS anything. A
prior read-only critic pass (`803-ios-store-critic-RESULT.md`) argued this was fine
because `getUserMedia` triggers its own native prompt — true for the *first* call,
but it means the app has no way to detect a **permanent denial** and can't show the
"open Settings" fallback UX Android already gets; Start would just silently fail to
get a camera track with no explanation.

Fixed by using `react-native-webrtc`'s own `permissions` export (`WebRTCModule.
checkPermission` / `requestPermission` on iOS — the same AVCaptureDevice bridge
`getUserMedia` calls internally, per `node_modules/react-native-webrtc/src/
Permissions.ts` and `getUserMedia.ts`). So this is not a second permission system,
it's just making the existing native check queryable ahead of Start, mirroring the
Android branch's shape (check → cache → request → cache). Falls back to
`allGranted: true` only if the native module truly isn't linked (shouldn't happen
in a real build), so it never becomes a new blocking dead-end.

### `feedback/audioSession.ts` — iOS "call" mode duck fix

Found a real Android/iOS inconsistency: Android's `"call"` mode used
`InterruptionModeAndroid.DuckOthers` but iOS used `InterruptionModeIOS.
MixWithOthers` — meaning during a live video call on iOS, other apps' audio (e.g.
background music) would keep playing at full volume instead of ducking, unlike
Android. Changed iOS `"call"` to `DuckOthers` to match.

**What I did *not* fix, and why it's not fixable from this file:** `expo-av`
15.0.2's native iOS side (`EXAV.m::_updateAudioSessionCategoryForAudioSessionMode`)
only ever sets `AVAudioSessionCategoryPlayAndRecord` with `.duckOthers`/
`.mixWithOthers`/`.allowBluetooth` options — it never sets `.defaultToSpeaker` and
never calls `AVAudioSession.overrideOutputAudioPort`. There is no JS-reachable way
via `expo-av`'s `setAudioModeAsync` (the only exported audio-mode API) to force
speaker-over-earpiece routing; the `AudioMode` type has no such field. In practice
this is very likely already moot: `react-native-webrtc`'s own `RTCAudioSession`
takes over AVAudioSession configuration once a WebRTC audio track is live (default
`useManualAudio=false`), and WebRTC's own default iOS config uses
`AVAudioSessionModeVideoChat`, which Apple routes to the speaker by default — but
that's inside `MediaSession.ts`, which is out of OWN scope for this task, and I
have no iPhone to confirm on-device. If a real-device smoke test shows calls
routing to the earpiece, the fix belongs in a native config plugin (add
`AVAudioSessionCategoryOptionDefaultToSpeaker` / an explicit `overrideOutputAudioPort`
call) — not in this file, and not something `expo-av`'s public API can do.

### `push/localCallAlert.ts` — iOS interruption level parity

Android's incoming-call local notification uses `AndroidImportance.MAX` +
`sticky: true` to guarantee it rings through. Added the iOS analogue:
`interruptionLevel: "timeSensitive"` on the notification content (supported by the
installed `expo-notifications` ~0.29.14 types), so the ring has a shot at breaking
through Focus modes the same way Android's MAX-importance channel does. Silently
degrades to `"active"` if the Time Sensitive entitlement isn't provisioned — not a
new dead-end, matches existing "ignore on failure" style in this file.

### `push/notifOptIn.ts` — removed dead Android/iOS branch

`openAppNotificationSettings()` had an `if (Platform.OS === "android") { ...;
return; }` followed by the *exact same* `Linking.openSettings()` call for every
other platform. Not a real bug (iOS was already getting the right call), but the
branching read like iOS was an unhandled fallback rather than an equally-supported
path, and the task explicitly asked me to verify there's no such dead-end here —
simplified to a single unconditional call. The rest of the file
(`maybeOfferNotifOptIn`, permission check, `tryRegisterPush` path) was already
platform-generic; the only other `Platform.OS === "android"` check gates the
battery-unrestricted follow-up prompt, which the task's "Must not" section says to
leave as an iOS early-return (already correct — untouched).

## What still needs `live.tsx` / native build (NOT done here, out of OWN scope)

1. **Speaker-vs-earpiece on-device verification.** See `audioSession.ts` section
   above — I made the one JS-level fix available (matching duck behavior), but
   confirming actual output routing during a call requires a real iPhone + either
   trusting `react-native-webrtc`'s internal `RTCAudioSession` default (likely
   correct) or adding a native config plugin if it isn't. Not something `live.tsx`
   itself needs edited for — it's native/config-plugin territory.
2. **Wiring `ensureMediaPermissions()`'s iOS result into the Start button's
   error/Settings-fallback UI** — `media.ts` now returns an accurate `allGranted`
   for iOS, but whatever calls it from `live.tsx`/`index.tsx` to show a "camera
   blocked, open Settings" message is presumably already wired for the Android
   shape (`MediaPermissionResult`) since the return type didn't change; nothing to
   do there unless that call site special-cased Android only, which I did not
   check (out of scope — did not read/edit `live.tsx`).
3. **iOS notification category/actions** (e.g. Accept/Decline directly from the
   notification) — not attempted; would need a `categoryIdentifier` registered in
   `push/register.ts` (out of OWN) plus native entitlement work, and the task's
   Done list didn't ask for it.

## Verify commands run

```bash
grep -n "Platform.OS" mobile/src/permissions/media.ts mobile/src/feedback/audioSession.ts \
  mobile/src/push/localCallAlert.ts mobile/src/push/notifOptIn.ts

find mobile -path mobile/node_modules -prune -o -name "*.test.mjs" -print \
  | xargs grep -l "permissions/media\|feedback/audioSession\|push/localCallAlert\|push/notifOptIn"
# no output — no tests target these modules

cd mobile && npx tsc --noEmit 2>&1 | grep -E "permissions/media|feedback/audioSession|push/localCallAlert|push/notifOptIn"
# no output — zero new type errors from the 4 OWN files
# (full tsc run has many pre-existing errors from missing node_modules in this
# worktree — expo-av, expo-clipboard, react-native-gesture-handler, etc. — and
# pre-existing errors inside live.tsx/MediaSession.ts I did not touch; none are
# in my OWN files)
```

## Connect risk

**none** — no edits to `MediaSession.ts`, `live.tsx`, `webrtc.js`, or `HubClient.ts`.
No ICE/offer/TURN/CONNECTIVITY_LOCK changes. No deploy, no APK, no `pool>0`. All
four diffs are additive `Platform.OS` branches or same-file logic fixes inside the
declared OWN files.

COMPLETE
