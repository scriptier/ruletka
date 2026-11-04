# RESULT — 803-ios-store-critic

## Status

Done — read-only critic pass complete. No spec file exists at
`knowledge/specs/current-ios-app-store.md` (same gap the two sibling lanes, 800 and 801, already
noted) — critiqued against the task's own Done list, `docs/STORE.md` (Android/Play pack), and the
two sibling RESULTs (`800-ios-app-store-runbook-RESULT.md`, `801-ios-eas-appjson-RESULT.md`).

## Findings (most severe first)

1. **`mobile/assets/store/ios/LISTING.md` does not exist.** `docs/IOS_APP_STORE.md` §3 and its
   own prior RESULT (800) both point to this file for the App Store Connect listing copy
   (app name, subtitle, keywords, description, App Review notes, EN+RU). `find mobile/assets/store`
   shows no `ios/` subdirectory at all, and `git log --all -- 'mobile/assets/store/ios/*'` returns
   nothing — it was never committed. Human following the runbook hits a dead reference.
2. **The `.gitignore` fix claimed by RESULT 800 was never applied.** RESULT 800 says it scoped
   `mobile/.gitignore`'s `ios/`/`android/` rules to root-only (`/ios/`, `/android/`) so the new
   `mobile/assets/store/ios/` directory would stop being silently swallowed. Current
   `mobile/.gitignore` lines 11–12 are still the unscoped `ios/` / `android/` patterns, and
   `git check-ignore -v mobile/assets/store/ios/LISTING.md` confirms it still matches and is
   ignored. If the listing file is recreated as-is, it will disappear from `git status` again.
3. **No Apple "App Privacy" (nutrition-label) data-type mapping exists.** Android has a dedicated
   `docs/PLAY_DATA_SAFETY.md` referenced from `docs/STORE.md`'s listing checklist. Nothing
   equivalent exists for iOS — `docs/IOS_APP_STORE.md` covers the 17+ age-rating questionnaire but
   never mentions App Store Connect's separate "App Privacy" section (data types collected, linked
   to identity, used for tracking). This is a hard submission blocker, distinct from age rating.
4. **Delete-my-data is web-link-only, no in-app deletion.** `mobile/app/settings.tsx:1631` opens
   `${hubBase()}/legal/delete.html` — there's no in-app self-service delete flow. Apple Guideline
   5.1.1(v) requires in-app account/data deletion for apps with any persistent identity; ruletka's
   device-generated id carries friends/stars/reputation, which is the pattern Apple reviewers
   flag even without traditional signup. Not mentioned as a risk anywhere in `IOS_APP_STORE.md`.

Verified as *not* gaps (already handled correctly by sibling lanes):
`ITSAppUsesNonExemptEncryption`/`usesNonExemptEncryption`/`privacyManifests`/`UIBackgroundModes`
(all present in `mobile/app.config.js`, confirmed by reading the file directly); camera/mic
`NSCameraUsageDescription`/`NSMicrophoneUsageDescription` strings (present in `app.json`); no
Contacts/Location/Tracking APIs in use (grepped `friends.tsx`, `package.json` — none); app icon
1024×1024 has no alpha channel (checked with PIL — Apple would reject an icon with transparency);
`mobile/src/permissions/media.ts` is Android-only by design (`Platform.OS !== "android"` short-
circuits to granted=true) — iOS relies on the native WebRTC/AVCaptureDevice prompt triggered by
`getUserMedia`, which is the standard Expo/RN-WebRTC pattern, not a gap.

## What human must do before first `eas build --platform ios`

Per `docs/IOS_APP_STORE.md` + the gaps above:
1. Create the app in App Store Connect, get the numeric Apple App ID, fill
   `submit.production.ios.ascAppId` in `mobile/eas.json` (still `REPLACE_ASC_APP_ID`).
2. **Recreate `mobile/assets/store/ios/LISTING.md`** (missing — see finding 1) — and actually
   fix `mobile/.gitignore` lines 11–12 to `/ios/` / `/android/` first, or it'll vanish again.
3. **Prepare the App Store Connect "App Privacy" data-type answers** (finding 3) — no doc exists
   yet; should mirror `docs/PLAY_DATA_SAFETY.md`'s categories for consistency.
4. Decide on finding 4 (in-app delete-my-data vs. web link) before submitting, or be ready for a
   5.1.1(v) rejection on first pass.
5. `npx eas credentials --platform ios` (interactive Apple Developer login).
6. Take iOS-specific screenshots (6.7"/6.5" iPhone + iPad) — none exist yet, Play/RuStore shots
   are Android-only.
7. Complete the age-rating questionnaire in ASC (mapping in `IOS_APP_STORE.md` §4) — expect 17+.
8. Set export-compliance answer `ITSAppUsesNonExemptEncryption = false` in ASC (already set in
   `app.config.js`, so this should just confirm, not prompt).
9. TestFlight internal smoke per `IOS_APP_STORE.md` §8 before requesting review.
10. If Apple rejects stranger roulette: `production-friends` EAS profile contingency (already
    documented, already wired in `eas.json`).

## Files touched

None — read-only critic, per task scope. This RESULT file only.

## Verify commands run

```bash
ls knowledge/specs/current-ios-app-store.md docs/STORE.md docs/IOS_APP_STORE.md mobile/eas.json \
   mobile/app.json mobile/src/permissions/media.ts mobile/assets/store/ios/
# spec file + assets/store/ios/ both "No such file or directory"

find mobile/assets/store -maxdepth 2   # confirms no ios/ subdir exists

git log --all --oneline -- 'mobile/assets/store/ios/*' 'docs/IOS_APP_STORE.md'
# no history for either — docs/IOS_APP_STORE.md is untracked (`?? docs/IOS_APP_STORE.md`)

grep -n "^ios/\|^android/" mobile/.gitignore        # still unscoped at lines 11-12
git check-ignore -v mobile/assets/store/ios/LISTING.md
# mobile/.gitignore:11:ios/  mobile/assets/store/ios/LISTING.md  -> still ignored

grep -in "app privacy\|nutrition\|data type\|linked to\|tracking" docs/IOS_APP_STORE.md
# no output — confirms no App Privacy section

grep -n "delete" mobile/app/settings.tsx | head -30
# only the external legal/delete.html link, no in-app deletion action

python3 -c "from PIL import Image; im=Image.open('mobile/assets/store/app-icon-1024.png'); print(im.mode, im.size)"
# RGB (1024, 1024) — no alpha channel, fine for Apple

grep -n "Contacts\|expo-image-picker\|expo-location\|Tracking" mobile/app/friends.tsx mobile/package.json
# no output — no extra Info.plist usage strings needed
```

## Connect risk

**none** — read-only review, no edits to MediaSession/live.tsx/webrtc/ICE/CONNECTIVITY_LOCK, no
edits to any production code, no deploy, no APK.

COMPLETE (critic)
