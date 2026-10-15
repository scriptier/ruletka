# RESULT — 801-ios-eas-appjson

## Status

Done — verified, no edits needed. `mobile/eas.json`, `mobile/app.json` (ios), and
`mobile/app.config.js` (ios) already satisfy every item in the task's Done list. Confirmed with
`eas-cli config` dry-resolution (no Apple credentials required for this check) rather than
just reading the source files.

No spec file exists at `knowledge/specs/current-ios-app-store.md` (same gap noted by the prior
`800-ios-app-store-runbook` RESULT) — followed the task's own Done list instead.

## What was checked, and why no diff was needed

- **`ITSAppUsesNonExemptEncryption = false`** — already set two ways in
  `mobile/app.config.js`: `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` and
  `ios.config.usesNonExemptEncryption: false` (the latter is a real Expo config key —
  confirmed against `@expo/config-plugins/build/ios/UsesNonExemptEncryption.js`, which writes
  the same Info.plist key). Both were already present at `HEAD` (`git show HEAD:mobile/app.config.js`),
  not part of any in-flight WIP.
- **Camera/mic usage strings** — present in `mobile/app.json` (`ios.infoPlist`), unchanged.
  **Photo library**: checked whether the avatar picker needs `NSPhotoLibraryUsageDescription`.
  It doesn't — `mobile/app/settings.tsx` uses `expo-document-picker` (Files browser), not
  `expo-image-picker`/Photos, and no `expo-image-picker` dependency exists in
  `mobile/package.json`. The working tree's uncommitted `app.json` diff already dropped the
  stale `NSPhotoLibraryUsageDescription` string that was in the previous committed version —
  correctly, since it's dead.
- **Background modes** — `UIBackgroundModes: []`, and this is correct, not an oversight.
  Read `mobile/src/live/useBackgroundMediaPause.ts` (deliberately disables outbound cam/mic on
  `AppState` → background/inactive) and `mobile/src/feedback/audioSession.ts`
  (`staysActiveInBackground: false` in every mode, including `"call"`). The product
  intentionally does not keep WebRTC audio alive when backgrounded/locked, so no
  `audio` background mode should be added — matches the task's "if WebRTC needs it" condition
  (it doesn't). No location mode added.
- **Privacy manifest** — `ios.privacyManifests.NSPrivacyAccessedAPITypes` declares
  `NSPrivacyAccessedAPICategoryUserDefaults` / reason `CA92.1`. Read
  `@expo/config-plugins/build/ios/PrivacyInfo.js`: the plugin auto-fills
  `NSPrivacyTracking: false`, `NSPrivacyCollectedDataTypes: []`, `NSPrivacyTrackingDomains: []`
  when omitted, so the generated `PrivacyInfo.xcprivacy` will be complete. Third-party pods
  (`@react-native-async-storage/async-storage`, `expo-file-system`, `expo-constants`,
  `expo-system-ui`, RN core) already ship their own bundled `PrivacyInfo.xcprivacy` files
  (confirmed via `find node_modules -iname PrivacyInfo.xcprivacy`), so no additional
  app-level API-type declarations are needed for those.
- **`eas.json` production iOS readiness / `ascAppId` placeholder** — ran
  `npx eas-cli config --profile production --platform ios` locally (no Apple credentials
  needed for config resolution). Confirmed the resolved build profile is exactly right for a
  store build: `"credentialsSource": "remote"`, `"distribution": "store"`,
  `"autoIncrement": true` (all via schema defaults — no explicit `ios` block needed since
  Android's production profile already relies on the same top-level defaults). The resolved
  `ios` app config included `bundleIdentifier`, `infoPlist` encryption/background flags,
  `associatedDomains`, and `privacyManifests` — no errors, no missing fields.
  `submit.production.ios.ascAppId` is still the placeholder `"REPLACE_ASC_APP_ID"` — left
  untouched per the task's "must not invent" rule. `docs/IOS_APP_STORE.md` §1 (written by the
  prior `800` task) already documents where to get the real value and which field to fill —
  that already serves as the "comment pointing at App Store Connect."

## Files touched

None. `mobile/eas.json`, `mobile/app.json`, `mobile/app.config.js` were read and verified only;
no edits were made because every Done-list item was already satisfied in the current worktree
state (some already at `HEAD`, e.g. the `ITSAppUsesNonExemptEncryption`/`privacyManifests`/
`UIBackgroundModes` block; some in the pre-existing uncommitted WIP from other lanes, e.g. the
`NSPhotoLibraryUsageDescription` removal in `app.json`). Editing further would have been
unjustified churn against "prefer minimal diffs."

## Verify commands run

```bash
python3 -c "import json; json.load(open('mobile/eas.json')); json.load(open('mobile/app.json')); print('OK json')"
# OK json

cd mobile && node -e "require('./app.config.js'); console.log('OK app.config.js')"
# OK app.config.js

npx eas-cli config --profile production --platform ios
# resolved cleanly: distribution=store, credentialsSource=remote, autoIncrement=true,
# ios app config included encryption flag + privacy manifest + associatedDomains, no errors

git show HEAD:mobile/app.config.js | grep -n "ITSAppUsesNonExemptEncryption\|UIBackgroundModes\|privacyManifests"
# confirms these were already committed at HEAD, not invented this session

git status --short mobile/src/media/ mobile/app/live.tsx ui/webrtc.js ui/live.js
# confirms other lanes' WIP touches those forbidden paths — untouched by this task
```

## Connect risk

**none** — no code changes at all. Read-only verification of iOS store config; nothing in
MediaSession/live.tsx/webrtc/ICE/CONNECTIVITY_LOCK was touched.

## Leftover human steps

Same as documented in `docs/IOS_APP_STORE.md` (create ASC app, fill real `ascAppId`, run
`eas credentials`/`eas build`/`eas submit` — all require Apple Developer access this
environment doesn't have).

COMPLETE
