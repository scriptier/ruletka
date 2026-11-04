# RESULT: 825-ios-parity-settings

## Status
COMPLETE (best-effort, static-analysis only — no physical iPhone/simulator
available to this agent; needs Grok/human TestFlight smoke to confirm pixel
fit).

## Context / note
`knowledge/specs/current-ios-parity.md` does not exist in this worktree
(`knowledge/specs/` only has `2026-08-20-ru-reach.md`). Read it from the main
tree instead (`/home/drakosik/freenet-roulette/knowledge/specs/current-ios-parity.md`)
— same DONE WHEN / MUST NOT as prior 82x tasks in this chain (Platform.OS iOS
branches where Android has chrome; no MediaSession/ICE/pool>0).

## What I found
Most Android-only chrome in `settings.tsx` was already correctly gated
before this task:
- Battery opt-in row ("Open battery settings") — already
  `Platform.OS === "android"` gated.
- "Pin to home screen" row (shortcut pin) — already
  `Platform.OS === "android"` gated (native module is Android-only by
  construction, see `src/shortcuts/homePin.ts`).
- The call-alerts guide copy already has an iOS-specific string
  (`mobile.settings.pushBatteryTipIos`) vs the Android battery-tip string.

Two real gaps remained:
1. **"Download APK" row** (About section) linked to
   `${hubBase()}/download/android.html` unconditionally on every platform.
   APK sideloading isn't an iOS concept (Apple doesn't allow it), and the app
   has no App Store listing yet to link to instead (would be inventing a
   store URL, which the spec's "no invent GOAL_MET"/no-fabrication rule and
   the task's "Do not invent TestFlight PASS" both argue against) — so the
   correct parity move is to hide the row on iOS, not relabel it.
2. **`buildLabel()`** (used for the About section subtitle and the
   long-press "copy build for support" box) only ever read
   `Constants.expoConfig?.android?.versionCode`, so on iOS it always fell
   back to the bare `ruletka {version}` with no build number — even though
   `app.json` already declares `ios.buildNumber` (currently `"1"`). Support
   triage on iOS would have no way to distinguish TestFlight builds.

## What changed
**`mobile/app/settings.tsx`**
- `buildLabel()`: now reads `Constants.expoConfig?.ios?.buildNumber` on
  `Platform.OS === "ios"` and `Constants.expoConfig?.android?.versionCode`
  otherwise, so the About subtitle and build-copy box show the right build
  number per platform. Android output is byte-identical to before.
- Wrapped the "Download APK" `Pressable` (About section) in
  `Platform.OS === "android" ? ( ... ) : null` — hidden entirely on iOS.
  Android output unchanged.

No other lines touched. `friends.tsx`, `live.tsx`, `MediaSession`, and any
deploy/EAS/TestFlight/`push.sh` paths were **not** touched, per Must-not.

## Files touched
- `mobile/app/settings.tsx`

## Verify commands run
- `grep -n "Platform.OS" mobile/app/settings.tsx` — confirms all
  Android-only rows (battery settings, home-screen pin, download APK) and
  the new build-number branch are now Platform-gated; no remaining
  ungated `android`-only strings (checked via
  `grep -ni android mobile/app/settings.tsx`).
- `npx tsc --noEmit -p .` (mobile/) — pre-existing errors only (missing
  native module type declarations in this worktree's `node_modules`:
  `expo-clipboard`, `expo-keep-awake`, `expo-image-manipulator`,
  `react-native-gesture-handler`, `react-native-reanimated`,
  `react-native-view-shot`, `expo-av`, plus unrelated pre-existing
  `live.tsx`/`matchContinuity.ts`/`MediaSession.ts` errors). Confirmed
  `node_modules/expo-clipboard` is absent in this worktree — same
  environment gap noted in the 824 RESULT. Zero new errors reference
  `buildLabel`, `ios.buildNumber`, or the new `Platform.OS === "android"`
  branch added by this diff.
- No iOS simulator/device in this environment — verified via types + grep
  only, not an on-device TestFlight smoke.

## Connect risk
none — no hub/ICE/MediaSession/live.tsx changes; `connectivity-lock` script
not run (out of scope, no offer/ICE/media-session touched). Both changes are
presentation-only in the About section of Settings; Android behavior is
unchanged by construction (`Platform.OS === "android"` branches preserve the
prior Android code path exactly).

COMPLETE
