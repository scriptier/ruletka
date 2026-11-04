# Spec: iOS readiness (2026-10-10)

> Decision document for Anton. Docs only. No IPA, no EAS build, no App Store Connect action, no Submit for Review.
> Code facts are from branch `polish/2026-10-10` in `~/freenet-roulette-polish` on 2026-10-10.
> This file does not claim TestFlight, App Store approval, or product.ok.

```text
GOAL: Anton can choose an iPhone path with the parity gaps, Guideline 1.2 removal risk, and the shortest TestFlight sequence written down.
DONE WHEN:
  - This file lists feature / A/V / safety-filter / report-block parity against the Android Expo app on this branch
  - It quotes Guideline 1.2 (filter, report, block, published contact, and the random-chat removal sentence)
  - It states the friends-by-code option and the iPhone Safari / PWA option
  - It lists the minimum human steps to an internal TestFlight install
  - §3.1 is a matrix for options A, B, and C: App Store exposure, engineering scope, moderation, and what waits for an explicit OK
  - §5 lists privacy/terms strings to change before TestFlight for A and for C, and Safari notes for B
  - §6 is the internal TestFlight runbook: accounts, certificates, 2FA, and what this Linux box cannot do
  - §7 has metadata drafts, a real-screen screenshot list, and a privacy-label checklist for A, B, and C
  - §8 has age-rating answers, export-compliance wording, and App Review contact notes for A and C
  - eas.json stays REPLACE_ASC_APP_ID; 6804910924 stays a note
  - No build and no App Store Connect action is taken from this hop
EVAL:
  - Sources section names the Apple pages fetched 2026-10-10 and the two research notes
  - Safety claims match mobile/src/safety/logic.test.mjs on this branch (HUB_ACCEPTS_SAFETY_LOG is true; the detector stub still does not confirm)
  - eas.json on this branch still shows ascAppId REPLACE_ASC_APP_ID (unchanged)
CHECKPOINTS: Anton picks A, B, or C in §3.1 before any EAS login, IPA, or TestFlight group
OUT OF SCOPE:
  - Swift rewrite
  - Editing mobile/ or ui/ (mobile tab and site tab)
  - MediaSession.ts, ui/webrtc.js, ui/live.js
  - EAS build, eas submit, App Store Connect, Submit for Review
  - push, deploy, website APK
VERIFY:
  - Baseline: read eas.json, app.json, app.config.js, safety/logic.js, live.tsx report/block, settings filter
  - After: node mobile/src/safety/logic.test.mjs (policy claims only)
  - Second critic: none
LANE: ios (docs)
OWN FILES: knowledge/specs/ios-readiness-2026-10.md
MUST NOT: pool>0, push.sh, git push, eas build, eas submit, edit eas.json, invent GOAL_MET
MAX HOPS: docs only until Anton picks A, B, or C. Implementation still waits.
```

## 1. Parity vs Android

The Play app and an iOS build are the same Expo project (`mobile/`, bundle / package `me.ruletka.app`). This branch is app version **0.1.471**, Android `versionCode` **479**, iOS `buildNumber` **"1"**. Most screens are one `live.tsx`. `Platform.OS === "ios"` in this tree is limited to keyboard padding, haptic length, blur radius, and the audio-session flags below. There is no iPhone smoke record in this worktree. A shared file is not a passed iPhone test.

| Area | Android on this branch | iOS on this branch | Gap |
|---|---|---|---|
| Stranger Start / Next / Stop | `live.tsx` → hub spin / next / stop | Same file | None in code. `isFriendsOnly()` hides the stranger queue on both. Production `eas.json` does not set that flag. |
| Friends by code, chat, call | `friends.tsx`, `call_friend` | Same | None in code. Profiles `preview-friends` and `production-friends` set `EXPO_PUBLIC_FRIENDS_ONLY=1`. |
| 18+ gate | `rules.tsx` before the hub | Same | Age-rating answers are a human form. Draft is §8. Override to 18+ so the store matches the gate. |
| Blur / hide, gifts, identity, 3-way | Shared live UI | Same JS | Visual safe-area and tile chrome are unsmoked on an iPhone. |
| Camera + mic permission copy | Android manifest permissions | `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` in `app.json` and the WebRTC config plugin | Strings exist. A real grant on iOS is untested here. |
| Call audio | `audioSession.ts` mode `call`, speaker (not earpiece) | Same function: `allowsRecordingIOS: true`, `playsInSilentModeIOS: true`, `interruptionModeIOS: MixWithOthers`, `staysActiveInBackground: false` | `UIBackgroundModes` is `[]` in `app.config.js`. No background audio. No iPhone A/V scorecard. |
| Push for a friend call | Expo notifications + `register_push` | Same JS path | APNs key / entitlement is an Apple + EAS credential step. Not verified. |
| Safety filter | Default **on**. Off is two actions. Detector is a **stub**. | Same module, same prefs | See §1.1. A native model is not in this binary on either OS. |
| Report | Sheet + `report_user` + screenshot + block + next | Same | Screenshot uses `captureRef`. Android SurfaceView frames are often missing. iOS capture is untested. |
| Block | `block_user` alone (`doBlockOnly`) or together with report | Same | Hub ban ladder is shared. This doc does not change it. |
| Published contact | Settings copies `support@ruletka.me`. `supportUrl` is `{hub}/safety.html` | Same | App Store Connect Support URL is a separate human field (§3). |

### 1.1 Safety filter (default on)

Source: `mobile/src/safety/logic.js`, `mobile/app/settings.tsx`, `mobile/app/live.tsx` (receiver watch).

- `safetyFilterEnabled`: any stored value other than `false` means **on**, including a missing pref (`store.ts` writes `true` on read).
- Turning it off takes two actions: the Off chip calls `beginDisableFilter()` (filter stays on, confirm pending), then a confirm alert calls `confirmDisableFilter()`. Cancel leaves it on.
- The live watch runs only in a stranger match. Friend calls reset the session and do not scan.
- `createSafetyDetector()` stays on the stub for `tflite` and `onnx` as well (`ready: false`, face and nsfw `unknown`). The stub cannot raise a hit, so a match is not false-blurred.
- Policy, when a real detector exists: one sexy / explicit / face-absent streak blurs; 2 of the last 3 frames explicit opens skip or report, stores a local `safety_log` (`explicit_shadow`, `log_only: true`), and `deliverSafetyLog` may send that record. `HUB_ACCEPTS_SAFETY_LOG` is **true** on this branch (`logic.js`, site commit `77a811c` is in the tree). The send path refuses `explicit_ai` and `report_user`. The stub never confirms, so a phone still sends nothing. The running hub gets that line only after `77a811c` is deployed. Deploy is not this tab.
- Web (research, not this binary): nsfwjs is default on, and it is disabled on FX-lite, which includes Safari, and on friend calls. iPhone Safari therefore does not get the web filter today. Source: `knowledge/research/moderation-ui-2026-10-08.md` (table row “On-device NSFW (web)”).

The Oct 8 research note said the mobile app had no filter. Phase 1 on this branch added the stub, the default, and the two-step off. It did not add a model.

### 1.2 Report and block

`ReportSheet.tsx` reasons: `underage`, `explicit`, `harassment`, `hate`, `spam`, `other`. Submit (`doReport`) sends `report_user` (optional JPEG) and `block_user`, then skips. Block-only sends `block_user` and skips, with no report. Hub thresholds (research, `bridge/src/simple.rs`): underage 1 reporter / 30 days; explicit and `explicit_ai` 3 reporters / 90 days. `docs/OPS.md` in the research note was already drifting from that code. This hop does not reconcile it (site / hub).

## 2. Guideline 1.2 risk

Fetched 2026-10-10 from <https://developer.apple.com/app-store/review/guidelines/> (section 1.2 User-Generated Content). The Oct 8 research note dates this wording to an update on 2026-06-08. This hop did not find that date on the page. The sentences below are what the page returned on 2026-10-10.

Apple requires every app with user-generated content or social networking to include:

- “A method for filtering objectionable material from being posted to the app”
- “A mechanism to report offensive content and timely responses to concerns”
- “The ability to block abusive users from the service”
- “Published contact information so users can easily reach you”

The same section then says apps used primarily for pornographic content, “Chatroulette-style experiences, random or anonymous chat,” objectification of real people, threats, or bullying “do not belong on the App Store and may be removed without notice.”

A further sentence: if the app shows user-generated content from a web-based service, incidental mature content must be “hidden by default and only displayed when the user turns it on via your website.”

Ruletka’s stranger match is the random-chat case in that paragraph. A filter, a report button, and a block button improve the four bullets. They do not cancel the removal sentence. The research note says the same: strong moderation and timely report handling improve the odds and guarantee nothing (`moderation-ui-2026-10-08.md` §10 and open question 8).

Adjacent rule, same page, 1.1.4: overtly sexual or pornographic material, including apps that may include pornography, is objectionable content. 1.5: the app and its Support URL need a way to contact the developer.

Guideline 2.2 (same page): betas belong on TestFlight, and an app submitted for TestFlight “should be intended for public distribution and should comply with the App Review Guidelines.” Internal TestFlight is not a waiver of 1.2.

### What we can point at today

| Apple bullet | On this branch | Short of the bullet |
|---|---|---|
| Filter objectionable material | Pref default on, two-step off, blur veil, web nsfwjs on desktop browsers | Native detector is a stub. iPhone Safari web filter is off (FX-lite). “Via your website” is how Apple describes the incidental-NSFW switch. Our switch is in Settings. |
| Report + timely response | In-call report with reasons, hub stores the report, auto-ban ladder. A confirmed model hit can also send `safety_log` (log only, no ban). | No published response-time. No staffed queue in this doc. The stub never confirms, so that log is not sent today. |
| Block | `block_user` in the call, with or without a report | Block is per hub account / id, not a proven device ban across reinstalls. |
| Published contact | In-app copy of `support@ruletka.me`. `app.config.js` `supportUrl` = `{hub}/safety.html` | App Store Connect Support URL and a monitored inbox are human steps. |

## 3. Options (Anton’s choice)

**A. Friends-by-code TestFlight.** The friends flag is `EXPO_PUBLIC_FRIENDS_ONLY=1` on both `preview-friends` and `production-friends`. TestFlight uses **`production-friends`** (store distribution). `preview-friends` is ad hoc (`distribution: internal`), not TestFlight. The home screen hides the stranger queue and keeps Friends and Call (`mobile/src/config.ts`, `mobile/app/index.tsx`). This is the product shape furthest from “random or anonymous chat.” Live video between people who exchanged a code is still user-generated content, so the four 1.2 bullets still apply. Acceptance is not promised.

**B. iPhone Safari / the site.** No App Store binary. The SEO note already recommends the public line “Нет iPhone-приложения? Работает в Safari” (`knowledge/research/seo-2026-10-08.md`, P4). The site tab’s 2026-10-10 inbox says the Android page says Safari on iPhone and does not claim a public iOS app. Schema should not list iOS as an `operatingSystem` until a real app exists (same note, T11). Caveat from the moderation note: the web NSFW filter is disabled on Safari. Safari crackle and delay are a separate web-audio issue (`ui/live.js`, `ui/webrtc.js`) and stay with the site / connect lanes.

**C. Stranger-match app on the App Store.** Same Start queue as Play. This is the case Guideline 1.2 names. Plan on rejection or later removal even with the filter stub replaced by a real model. Do not start this until Anton says the risk is accepted.

Public store Submit for Review stays blocked until Anton says yes in chat. This document does not submit anything.

### 3.1 Decision matrix

Read this before any `eas build` or `eas submit`. Exposure follows Guideline 1.2 and 2.2 (quoted in §2) and the TestFlight rules in §4. Engineering scope is what this codebase already contains on `polish/2026-10-10`. The mobile tab owns `mobile/`. The site tab owns `ui/` and hub config. This tab does not take those files.

| | **A. Friends-by-code TestFlight** | **B. Safari only** | **C. Stranger-match app** |
|---|---|---|---|
| App Store exposure | A TestFlight binary of the friends-only profile. An internal group (up to 100 team roles) can install after processing, without the first external Beta App Review. The first build added to an external group goes to TestFlight App Review, and Guideline 2.2 says that beta should comply with the App Review Guidelines. Stranger Start is hidden, so the product is not the random queue Guideline 1.2 names. Live video between people who exchanged a code is still user-generated content. A later public release is a separate Submit for Review. | No App Store binary and no TestFlight review. iPhone users stay on `ruletka.me` in Safari. The SEO note (P4) already recommends the public line that there is no iPhone app and Safari works. Schema should not list iOS as an `operatingSystem` until a real app exists (T11). | Highest. This is the “random or anonymous chat” case Guideline 1.2 says does not belong on the App Store and may be removed without notice. Internal TestFlight is the same binary Apple reviews if it is later sent to Beta App Review or Submit for Review. Approval, if it happened, would not remove that sentence. |
| Engineering scope on this codebase | Already built. `preview-friends` and `production-friends` set `EXPO_PUBLIC_FRIENDS_ONLY=1`. `isFriendsOnly()` hides the stranger queue and keeps Friends and Call (`config.ts`, `index.tsx`, `live.tsx`). The TestFlight profile is `production-friends`. `preview-friends` extends `preview`, which sets `distribution: internal` (ad hoc device list). Still open: privacy/terms strings in §5, a real iPhone smoke, and APNs if a killed-app friend ring matters. `submit.production.ios.ascAppId` on this branch is `REPLACE_ASC_APP_ID`. | No `mobile/` change. Safari behavior lives in `ui/live.js` and `ui/webrtc.js` (site and connect). The moderation note: the web nsfwjs filter is default on, and it is off on FX-lite, which includes Safari. Safari crackle and conversational delay stay on that web lane. | The default `production` profile does not set `FRIENDS_ONLY`, so Start matches Play. Same `live.tsx`. Still open on iPhone: camera, mic, and tile chrome, with no smoke in this worktree. `createSafetyDetector()` stays the stub until a native runtime is installed, including when the env says `tflite`. Face self-check does not block Start while the detector is not ready (`pushFaceSample` always returns `blocked: false`). The native model commit is on `polish/ml-native`, not the path a production iOS build of this branch would run. iOS frame capture was the later half of the research plan (Android first). |
| Moderation and reporting | Friend calls skip the receiver safety watch (`live.tsx`: the watch resets when `matchMode === "friend"`). Report and block stay in the call (`report_user`, `block_user`). The four Guideline 1.2 bullets still apply to that video. The filter pref does not scan these calls. In-app contact remains `support@ruletka.me` and `{hub}/safety.html`. | Web report and block exist (moderation note). iPhone Safari does not run that nsfwjs graph today. There is no native `safety_log` from the browser. A staffed response and the published contact are the same human duties as on Android, on the website. | Filter defaults on and takes two actions to turn off (§1.1). A confirmed hit stores a local log and may send `safety_log` (`log_only`, reason `explicit_shadow`). That send does not ban and is not `report_user`. The stub never confirms, so nothing is sent now. Hub handling is commit `77a811c` in this branch and reaches production only if that commit is deployed. Human report, block, and a monitored inbox are still required. “Timely responses” is not implemented as a staffed queue. |
| Waits for Anton’s explicit OK | `eas build --profile production-friends --platform ios`, then `eas submit --profile production --platform ios` after a real `ascAppId` is in `eas.json`. Adding TestFlight testers. Any edit that replaces `REPLACE_ASC_APP_ID`. Submit for Review. `preview-friends` is not the TestFlight command. | No EAS command. A Safari filter change or an audio change is a site/connect edit plus a deploy of ruletka.me. Both wait for his go in that lane. | `eas build --profile production --platform ios`, then `eas submit`, then Submit for Review. Also, separately: deploy of hub `safety_log`, and any prebuild that installs `react-native-fast-tflite` or merges `polish/ml-native`. He accepts the Guideline 1.2 removal risk in chat before this row starts. |

**Candidate App Store id (connect tree only).** Uncommitted `mobile/eas.json` in `~/freenet-roulette` contains `ascAppId` **6804910924**. This branch’s committed file is still `REPLACE_ASC_APP_ID`. That number was not opened in App Store Connect, not copied into this branch, and not treated as proof the record is current. Confirm it before anyone edits `eas.json`.

## 4. Minimum path to TestFlight

Internal testing is the shortest path to a binary on a phone Anton controls. It still needs his Apple login. This Linux box cannot run Xcode. Steps below are the sequence, not work this hop did.

1. Apple Developer Program membership on the account that will own `me.ruletka.app`.
2. App Store Connect record for that bundle id. Copy the numeric Apple ID into `mobile/eas.json` → `submit.production.ios.ascAppId` only after Anton confirms it. **This branch still has `REPLACE_ASC_APP_ID`.** Candidate seen on the connect tree: **6804910924** (§3.1). This hop does not edit `eas.json` and does not open App Store Connect.
3. EAS credentials (distribution cert, provisioning profile) via `eas` while Anton completes Apple 2FA. Expo owner in `app.json` is `courtiers-team`. Project id `1e9b8ca4-2dfc-4923-84d1-138222be372f`.
4. Export compliance is already in `app.config.js`: `ITSAppUsesNonExemptEncryption: false` and `ios.config.usesNonExemptEncryption: false`. iOS deployment target **15.1**. `supportsTablet: true` (iPad screenshots enter the conversation if that stays).
5. When Anton asks for a build, use the store profile in §6 (not `preview` / `preview-friends`). Then `eas submit --profile production --platform ios` only after the real `ascAppId` is in the file. Agents do not run these until he asks.
6. After processing, add an **internal** group. Apple: up to 100 App Store Connect users with Account Holder, Admin, App Manager, Developer, or Marketing. A build in Ready to Submit can go to internal testers. External testers (up to 10,000) need the first build approved by TestFlight App Review, plus a beta description, beta contact email, and review information. Builds last 90 days.
7. Smoke on a real iPhone: camera, mic, either a friend call (option A) or one stranger match (option C), then report and block. Write the result in chat. Agents do not mark that smoke passed.

Sources for the tester rules, fetched 2026-10-10:

- <https://developer.apple.com/testflight/>
- <https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/> (page dated 2026-10-06)
- <https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/> (page dated 2026-10-06)
- <https://developer.apple.com/help/app-store-connect/reference/app-uploads/app-build-statuses/> (Ready to Submit vs Waiting for Review)

Before a **public** listing (not required for the first internal install): 6.7" and 6.5" screenshots that meet Guideline 2.3.8 (metadata appropriate for a 4+ rating even when the app is rated higher), age-rating answers, App Privacy nutrition label, Support URL, and a monitored `support@ruletka.me`.

## 5. Privacy and terms, per option

Prep only. The site tab owns `ui/` legal copy. The mobile tab owns `app.json` permission strings. This hop changes neither. Strings below are what is in the tree on 2026-10-10.

The app already opens privacy and terms from Settings and the home screen: `${hubBase}/legal/privacy.html` and `${hubBase}/legal/terms.html` (`settings.tsx`, `index.tsx`). `hubBase` in `app.json` `extra` and in every `eas.json` env block is `https://ruletka.vip`. `app.config.js` also sets `supportEmail` `support@ruletka.me` and `privacyEmail` `privacy@ruletka.me`. The 18+ rules screen and the in-app support copy stay.

`NSCameraUsageDescription` today: “Ruletka.me needs the camera for peer-to-peer video chat. Video goes device-to-device and is not uploaded to our servers.” A report can still upload a JPEG still (`live.tsx` `report_user`). The mic string does not say that. There is no separate photo-library usage string. The capture is in-app.

`page.privacy.intro` already names web and `me.ruletka.app`. `page.privacy.media1` still says call media is exchanged “directly between browsers.” `page.privacy.reports` says optional on-device AI “may send an assisted report signal without uploading video.” The app’s shadow path is `safety_log` (`log_only`, reason `explicit_shadow`), and the stub never confirms, so a phone sends nothing today. `ui/legal/privacy.html` canonical is still `https://ruletka.vip/legal/privacy.html`.

App Privacy answers in App Store Connect are a human form. Topic list to reuse, labeled as the Play analog: `docs/PLAY_DATA_SAFETY.md` (camera, microphone, report still, app-generated user id, optional push token; no contacts; no payment; stars are not money). This hop does not fill that form.

### A — friends-by-code, before TestFlight

On device, the `production-friends` binary already does this when `EXPO_PUBLIC_FRIENDS_ONLY=1`:

- Display name becomes `Ruletka.me Friends` (`app.config.js`).
- Home copy `mobile.home.friendsOnlyNote`: “Friends-only build: Call friends by code. Stranger matchmaking is off.”

Still to change before that binary is installed by testers:

- Camera usage string: say live video is device-to-device, and say a report can send a still. The current “not uploaded” sentence is too broad for a report.
- Site privacy `media1`: include the app, not only browsers, because Settings opens that page from the app.
- Site privacy/terms that this binary opens: say this iOS build has no stranger queue and calls are by friend code. `page.terms.safeBody` currently describes Next, strangers, and matchmaking bans as the way the product works. A short friends-only paragraph on that page (site tab) has to be true for the build testers open.
- `page.privacy.reports`: call the shadow signal `safety_log`, log-only, and not a ban. Do not describe it as an assisted `report_user`. Friend calls skip the watch, so the friends binary still will not send it.
- TestFlight beta description, written by Anton in App Store Connect: friends by code, no stranger queue. Same words as the on-device note. No claim that an on-device model is running.

### C — stranger-match, before TestFlight

Same camera-string fix and the same `media1` / `reports` wording as A. In addition:

- Keep stranger Start, Next, and Stop in the terms. That is what `production` ships.
- Any safety page the app can open (`/safety.html`, `/bezopasnost`) must not say an on-device model is running on iOS. The stub does not blur and does not send `safety_log`.
- Beta description and review notes must not claim the filter catches explicit video on this build.
- He accepts the Guideline 1.2 removal risk in chat before the build command in §6.

### B — Safari notes only

No TestFlight binary, so no Info.plist edit and no App Privacy form.

- `page.privacy.media1` (“between browsers”) matches this path. Leave it accurate for the web if A/C later add the app clause: the web sentence can stay beside the app sentence.
- Home schema on this branch is already `"operatingSystem": "Web, Android"` (`ui/index.html`). Leave iOS off until a real app exists (SEO note T11).
- `ui/pwa-install.js` teaches iPhone Safari “Share → Add to Home Screen.” That is a website shortcut, not an App Store app.
- The web nsfwjs filter is off on Safari (FX-lite, moderation note). Do not tell Safari users the on-device filter is on.
- The EULA already says official iOS apps count as the software “when distributed.” Leave that conditional. Do not change it into “now on the App Store.”

## 6. Internal TestFlight runbook

This is the checklist for the day Anton picks A or C and sits for Apple 2FA. Option B skips it. Nothing here was run on this hop.

**Lock.** `mobile/eas.json` → `submit.production.ios.ascAppId` stays `REPLACE_ASC_APP_ID` until he confirms a number in chat. **6804910924** is a candidate seen in uncommitted `eas.json` on the connect tree `~/freenet-roulette`. It is not copied here, not opened in App Store Connect, and not proof the record is current.

**This machine, checked 2026-10-10.** Linux. `xcodebuild` is absent. Node is v20.20.2. `eas` is on `PATH`. There is no iOS Simulator and no Apple keychain.

This box cannot, without Xcode on a Mac:

- Archive or sign an iOS app locally
- Run the Simulator
- Create a distribution certificate in a local keychain
- Install an IPA with Xcode

A later `eas build --platform ios` compiles on Expo’s Mac builders. Starting it still needs his “yes” and his Apple ID 2FA. This prep does not start it.

**Before the login**

- [ ] He picked A or C in chat. For C he also accepted the Guideline 1.2 risk.
- [ ] §5 for that option is done, or he accepts the current strings in writing.
- [ ] Apple Developer Program is active for the team that will own bundle id `me.ruletka.app`.
- [ ] He can receive Apple 2FA during the session.
- [ ] He confirms the App Store Connect id. Until that sentence, nobody edits `eas.json`.

**Accounts and certificates (his keyboard)**

- [ ] Expo account that owns `courtiers-team` / project `1e9b8ca4-2dfc-4923-84d1-138222be372f`. `eas login` only if the CLI is not already that user.
- [ ] First `eas build` or `eas credentials` asks for the Apple ID, then creates or reuses an Apple Distribution certificate and a provisioning profile for `me.ruletka.app`. Those stay with Apple and Expo. They are not committed.
- [ ] App Store Connect record for `me.ruletka.app`. He reads the numeric Apple ID and only then replaces `REPLACE_ASC_APP_ID`. The submit profile in `eas.json` is `production` only. There is no `submit.production-friends`. The friends flag is baked in at build time.
- [ ] Export compliance is already in `app.config.js`: `ITSAppUsesNonExemptEncryption: false` and `usesNonExemptEncryption: false` (HTTPS and WebRTC only). If App Store Connect still asks, he answers. Agents do not click it.
- [ ] APNs key is a later credential, only if a friend-call push must ring while the app is killed. The first internal install does not need it.

**Build and internal testers (after the yes)**

- [ ] A: `cd mobile && eas build --profile production-friends --platform ios`
- [ ] C: `cd mobile && eas build --profile production --platform ios`
- [ ] Do not use `preview` or `preview-friends` for this list. They set `distribution: internal` (ad hoc UDIDs), not TestFlight. `production` does not set `distribution`, so EAS treats it as store, which is the TestFlight upload. `production` has `autoIncrement: true` and `appVersionSource: remote`, so the iOS build number moves on Expo’s side when the build actually runs. App version on this branch is still 0.1.471. `buildNumber` in `app.json` is still `"1"`.
- [ ] `eas submit --profile production --platform ios` after the build artifact exists and `ascAppId` is a real number.
- [ ] After processing, he adds an internal group in App Store Connect: up to 100 users who already have Account Holder, Admin, App Manager, Developer, or Marketing. They install with the TestFlight app. A build lasts 90 days. External testers are a later step and send the first build to TestFlight App Review (§4).
- [ ] He smokes camera, mic, a friend call (A) or one stranger match (C), then report and block, and pastes the result. Agents do not mark that passed.

Submit for Review of the public listing stays a separate yes.

## 7. Listing drafts (not pasted)

Prep only. Nothing here is entered in App Store Connect. `mobile/eas.json` → `submit.production.ios.ascAppId` stays `REPLACE_ASC_APP_ID`. Candidate **6804910924** is still only the uncommitted value on the connect tree. Do not copy it in.

Limits used below: subtitle 30, promotional text 170, keywords 100 (commas, no space after a comma). Name on the binary is `Ruletka.me` or, for A, `Ruletka.me Friends` (`app.config.js`). Guideline 2.3.7: the words must describe the binary. Guideline 2.3.8: subtitle, keywords, and screenshots stay suitable for a 4+ page even though the app is 18+ / expect 17+.

### A — friends-by-code

**Subtitle** (24): `Friend video calls. 18+.`

**Keywords** (45): `friends,video call,friend code,p2p,webrtc,18+`

No `roulette`, `random`, `stranger`, or `omegle`. Those words describe a queue this binary hides.

**Promotional text** (144): `Call someone you know. Exchange a friend code, then start a video call. This build has no stranger queue. Report and block are in the call. 18+.`

**Review Notes**

- This binary is friends-only (`EXPO_PUBLIC_FRIENDS_ONLY=1`). Stranger Start is hidden. Home text: “Friends-only build: Call friends by code. Stranger matchmaking is off.”
- No account. Accept 18+, allow camera and microphone.
- Two devices: open Friends, copy the code, add the other device, tap Call.
- In the call, open Report (reasons include explicit and underage) and Block. A report can attach a still from the stage.
- Settings → safety filter defaults on. The detector in this build is a stub and does not blur or send a log.
- Contact: support@ruletka.me. Privacy and terms open from Settings.
- Encryption: `ITSAppUsesNonExemptEncryption` is false (HTTPS and WebRTC only).

### B — Safari only

Do not create an App Store record and do not paste subtitle, keywords, or promotional text. There is no binary to review.

Public line, already the SEO recommendation: there is no iPhone app; ruletka.me opens in Safari. Schema stays `Web, Android` (§5). Review Notes are not used.

### C — stranger match

Paste this only after Anton has accepted Guideline 1.2 in chat. The removal sentence still applies.

**Subtitle** (20): `P2P video chat. 18+.`

**Keywords** (56): `video chat,roulette,webrtc,p2p,friends,random chat,adult`

**Promotional text** (156): `18+ video chat. Tap Start to meet someone, or call a friend by code. Report and block are in every call. Live video is peer-to-peer when the network allows.`

**Review Notes**

- 18+ peer-to-peer video chat with a stranger queue (Start) and friend calls by code. No login.
- Guideline 1.2: this is random video chat. Report, block, a default-on filter control, and support@ruletka.me are in the app. The on-device detector in this build is a stub: it does not catch video and it does not send `safety_log`. Human report and block do work.
- Demo: two devices, accept 18+, allow camera and mic, tap Start. If the queue is empty, use Friends → code → Call so both sides have audio and video.
- Report attaches a still when the capture succeeds. Block can be used without a report. Both skip to the next step.
- Stars are cosmetics, not IAP and not real money.
- Encryption: `ITSAppUsesNonExemptEncryption` is false.

### Screenshots

Source: Apple’s screenshot specifications, fetched 2026-10-10. At least one image, at most 10, JPEG or PNG, no alpha. To submit you must supply:

- **iPhone, Dynamic Island, medium display** (required): portrait **1179×2556** or **1206×2622**.
- **iPad 13-inch** (required while `app.json` `supportsTablet` is true): portrait **2064×2752** or **2048×2732**.

A larger iPhone set is optional. Dynamic Island large accepts portrait **1290×2796** among other sizes on that page. If Anton turns `supportsTablet` off before the build, the iPad row drops. This Linux box cannot take these shots (`xcodebuild` is absent). Capture them from the real iOS binary on a device or a Simulator of that same build. No composited faces, no Figma frames, no Android or browser chrome, no other brands (Guideline 2.3.3 and 2.3.10). Frames must stay 4+ even though the app is rated higher (2.3.8): clothed adults who agreed to be in the shot, or the real UI with no second person. Do not paste a stock face onto a black tile.

| # | A (friends binary) | C (stranger binary) |
|---|---|---|
| 1 | Home, friends-only line visible, stranger Start absent | 18+ rules screen, before camera |
| 2 | Friends, this device’s own code visible. No one else’s real name | Live idle, Start visible |
| 3 | Outgoing or in-call stage from that build. If no consented partner, shoot the real ringing state | In-call stage, same 4+ rule. If no consented partner, shoot the real searching state |
| 4 | Report sheet open on a non-explicit frame | Report sheet, same rule |
| 5 | Settings with the safety filter On and support@ruletka.me visible | Same Settings screen |

B has no shot list.

### Privacy Nutrition Labels

Human form in App Store Connect. Not filled here. Types follow what this branch actually does. “No account” means no email and password. The app still creates a `user_id` and sends it to the hub, in stranger mode and in friends mode. Declare that as **User ID**, linked to the user, App Functionality, not used to track. Tracking (ads, data brokers, IDFA): **none**. Do not declare Email, Phone, Contacts, Precise Location, Payment Info, Health, Purchases, or Advertising Data.

| Data type | Declare | Linked to the user | Notes for A and C |
|---|---|---|---|
| Photos or Videos | Yes | Yes | Camera stream to the partner (WebRTC, or TURN if the direct path fails). Not stored as a call archive. A report can also upload one JPEG still. |
| Audio Data | Yes | Yes | Microphone, same path as video. |
| User ID | Yes | Yes | App-generated id. Used to match, call friends, report, and block. Stranger mode has this id too. |
| Name | Yes, if a display name is saved | Yes | Optional name the person types. Skip the row only if that build cannot save one. |
| Coarse Location | Yes, if the build still shows country or city | Yes | Shown from the connection when Hide IP is off (`PartnerChrome.tsx`). No Core Location permission and no Precise Location row. The Play draft’s “Approximate location: No” does not match that screen. |
| Product Interaction | Yes | No | `track()` stores counts on device and POSTs `{event}` to `/v1/funnel` with no user id (`mobile/src/analytics/track.ts`). Purpose Analytics. |
| Other User Content | Yes | Yes | Friend list and friend codes on the hub; in-call chat. Friends mode uses this. Stranger mode still can add a friend after a match. |
| Device ID | Only if push is offered | Yes | Expo push token via `register_push`, optional. Not required for the first install. |

Do not add a row for `safety_log` on this binary. The stub never sends it. Add labels-only (not video) on the next build that can confirm a hit.

`docs/PLAY_DATA_SAFETY.md` is the Android analog. Use it for camera, mic, report still, user id, and “stars are not money.” Do not copy its location “No” onto this form while the app shows a city.

## 8. Age rating, export, review contact

Prep only. Not entered in App Store Connect. `eas.json` stays `REPLACE_ASC_APP_ID`. Candidate **6804910924** is notes-only. Option B has no questionnaire, no export upload, and no review contact, because there is no binary.

### Age rating

Source: Apple’s age-rating values page, fetched 2026-10-10, and the 9 July 2026 note that social media means a feed or similar discovery that spreads user content to many people. Apple calculates a rating from the answers. A higher age can be set when the product rule is stricter. Kids category: **Not Applicable**. Do not list the app in Kids.

The in-app gate is the rules screen (`rules.tsx`): the person taps 18+ before the hub. That tap is not the Declared Age Range API and not an ID check. Apple’s age-assurance note says some regions still require that API even when the store rating is 18+. This branch does not call it. Do not answer Age Assurance as Yes.

Shared answers for A and C (the app’s own UI, not what a partner might show):

| Question | Answer |
|---|---|
| Parental controls | No |
| Age assurance (API, estimate, or government ID) | No |
| Unrestricted web access | No. No in-app browser. Privacy, terms, and safety open in Safari via `Linking.openURL`. |
| Social media (feed, likes, reshare to many people) | No. There is no feed. |
| Social media disabled under 13 | Do not select. That row requires the Declared Age Range API. |
| Messaging and chat | Yes. Voice and video, plus text, for a direct call. |
| User-generated content | Yes. The other person creates the live picture, sound, and chat. |
| Advertising | No |
| Profanity, horror, alcohol or drugs, medical, health | None |
| Mature or suggestive themes, sexual content, graphic sexual content | None in the app’s own screens and art |
| Violence, weapons | None |
| Gambling, simulated gambling, contests, loot boxes | None |
| Calculated floor from those rows | Messaging and user-generated content sit in Apple’s 4+ examples. They do not by themselves produce 18+. |
| Override | **18+**. The product rule is 18+. Leave the calculated floor in place and set the higher age. On OS versions before 26 the store can still show an older label such as 17+. |

**A.** Same table. There is no stranger queue, so the user-generated risk is a person you added by code. Still override to 18+, because this binary keeps the 18+ rules screen. Do not drop the override to chase a lower badge unless Anton changes that screen.

**C.** Same table, plus this risk: the stranger queue can put mature or explicit live video on the screen. That is why the override stays 18+. Do not tick Frequent or Infrequent **graphic sexual content**. On Apple’s chart that value is **Unrated**, and an Unrated app cannot be published on the App Store. Do not tick Unrestricted web access to “explain” the queue. The app does not contain a browser. Guideline 1.2 is the review risk (§2), not an age-rating row.

### Export compliance

No CCATS, no ERN, no French encryption declaration, and no other certificate is in this repo. Do not type a number.

The binary already says exempt encryption:

- `app.config.js`: `ITSAppUsesNonExemptEncryption: false`
- `app.config.js`: `ios.config.usesNonExemptEncryption: false`

That is the answer already chosen: the app is not using non-exempt encryption, so a documentation upload is not required on each build. This hop does not change the keys.

If App Store Connect or the upload form still asks, the true description is:

- Signaling uses HTTPS (and WSS) to the hub.
- Call media uses WebRTC DTLS-SRTP. The dependency is `react-native-webrtc` 124, which brings its own WebRTC stack. That path is not only Apple’s URLSession.
- No custom cipher. The app is not an encryption product.

Use the standard exemption wording for that: encryption is limited to standard HTTPS and DTLS-SRTP for a video call, qualifying under the mass-market / ancillary exemptions in Category 5, Part 2 (the app is not sold as crypto). Answer that it qualifies for the exemption. Answer that it does not use proprietary or non-standard cryptography. Leave every document-upload field empty.

If counsel or Apple says the bundled WebRTC stack is non-exempt, stop. Flip the plist only with a real classification in hand. Do not invent one.

### App Review contact

The contact form wants a person, a phone, and an email. This repo has **support@ruletka.me** and **privacy@ruletka.me**. It has no reviewer phone. Anton types his own name and phone when he submits. Do not copy a guessed number into the form.

There is no demo password. Sign-in required: **No**.

**A.** Notes to paste beside the contact:

- Friends-only build. Stranger Start is hidden.
- No account. Accept 18+ and allow camera and microphone.
- On Friends, the review device shows its own code. A second device we operate adds that code and calls. The code is created on the device at install, so it is written into these notes at submit time, not stored in the repo.
- Report and Block are in the call. Settings shows the safety filter on. The detector does not fire in this build.
- Contact for the app: support@ruletka.me.

**C.** Add this bullet to the review notes in §7:

- The developer has read Guideline 1.2. This binary includes random video chat, which that guideline says may be removed without notice. The submission is made with that risk accepted. Report, block, the default-on filter control, and support@ruletka.me are in the app. The detector is a stub and does not catch video.

## 9. Sources

- Apple App Review Guidelines, 1.2, 1.1.4, 1.5, 2.2, 2.3.8: <https://developer.apple.com/app-store/review/guidelines/> (fetched 2026-10-10).
- TestFlight pages in §4.
- Screenshot specifications, fetched 2026-10-10: <https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/> (Dynamic Island medium required; iPad 13-inch required if the app runs on iPad).
- Age ratings values and definitions, fetched 2026-10-10: <https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/>. Social media definition: Apple news, 9 July 2026, <https://developer.apple.com/news/?id=tlur8uvi>.
- `knowledge/research/moderation-ui-2026-10-08.md` §10 (Play two-step filter and Apple 1.2) and open question 8.
- `knowledge/research/seo-2026-10-08.md` P4 (Safari line for iPhone) and T11 (do not advertise iOS in schema until it is real).
- This branch: `mobile/eas.json` (`distribution: internal` on preview, `ascAppId` placeholder), `mobile/app.json` (camera/mic strings, `hubBase`), `mobile/app.config.js`, `mobile/src/i18n/packs/en.json` and `overlay/en.json` (privacy, terms, friends-only note), `ui/legal/privacy.html`, `ui/index.html` schema, `ui/pwa-install.js`, `docs/PLAY_DATA_SAFETY.md`.
- Same tree, still: `mobile/src/config.ts`, `mobile/src/safety/logic.js`, `mobile/src/safety/ReportSheet.tsx`, `mobile/src/feedback/audioSession.ts`, `mobile/app/live.tsx`, `mobile/app/settings.tsx`.

## Status

- **Draft for Anton.** Docs hop 5 added §8 (age rating, export compliance, review contact). Not an implementation hop.
- Last measure: 2026-10-10, `polish/2026-10-10`. `eas.json` `ascAppId` is still `REPLACE_ASC_APP_ID`. Candidate `6804910924` is notes-only.
- Next: Anton picks A, B, or C. No EAS build, no `eas submit`, no `eas.json` edit, and no Submit for Review until he says so.
