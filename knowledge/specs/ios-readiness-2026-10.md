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
  - No build and no App Store Connect action is taken from this hop
EVAL:
  - Sources section names the Apple pages fetched 2026-10-10 and the two research notes
  - Safety claims match mobile/src/safety/logic.test.mjs on this branch
  - eas.json on this branch still shows ascAppId REPLACE_ASC_APP_ID (unchanged)
CHECKPOINTS: Anton picks one option below before any EAS login, IPA, or TestFlight group
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
MUST NOT: pool>0, push.sh, git push, eas build, eas submit, invent GOAL_MET
MAX HOPS: 1 (this document). Next hop waits for Anton.
```

## 1. Parity vs Android

The Play app and an iOS build are the same Expo project (`mobile/`, bundle / package `me.ruletka.app`). This branch is app version **0.1.471**, Android `versionCode` **479**, iOS `buildNumber` **"1"**. Most screens are one `live.tsx`. `Platform.OS === "ios"` in this tree is limited to keyboard padding, haptic length, blur radius, and the audio-session flags below. There is no iPhone smoke record in this worktree. A shared file is not a passed iPhone test.

| Area | Android on this branch | iOS on this branch | Gap |
|---|---|---|---|
| Stranger Start / Next / Stop | `live.tsx` → hub spin / next / stop | Same file | None in code. `isFriendsOnly()` hides the stranger queue on both. Production `eas.json` does not set that flag. |
| Friends by code, chat, call | `friends.tsx`, `call_friend` | Same | None in code. Profiles `preview-friends` and `production-friends` set `EXPO_PUBLIC_FRIENDS_ONLY=1`. |
| 18+ gate | `rules.tsx` before the hub | Same | Age-rating answers in App Store Connect are still a human form. Expect 17+. |
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
- Policy, when a real detector exists: one sexy / explicit / face-absent streak blurs; 2 of the last 3 frames explicit opens skip or report and writes a local `safety_log` with reason `explicit_shadow`. `HUB_ACCEPTS_SAFETY_LOG` is **false**. The app does not send `report_user` for that hit.
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
| Report + timely response | In-call report with reasons, hub stores the report, auto-ban ladder | No published response-time. No staffed queue in this doc. AI hits are local-only until `safety_log` exists. |
| Block | `block_user` in the call, with or without a report | Block is per hub account / id, not a proven device ban across reinstalls. |
| Published contact | In-app copy of `support@ruletka.me`. `app.config.js` `supportUrl` = `{hub}/safety.html` | App Store Connect Support URL and a monitored inbox are human steps. |

## 3. Options (Anton’s choice)

**A. Friends-by-code TestFlight.** Build with `preview-friends` or `production-friends` (`EXPO_PUBLIC_FRIENDS_ONLY=1`). The home screen hides the stranger queue and keeps Friends and Call (`mobile/src/config.ts`, `mobile/app/index.tsx`). This is the product shape furthest from “random or anonymous chat.” Live video between people who exchanged a code is still user-generated content, so the four 1.2 bullets still apply. Acceptance is not promised.

**B. iPhone Safari / the site.** No App Store binary. The SEO note already recommends the public line “Нет iPhone-приложения? Работает в Safari” (`knowledge/research/seo-2026-10-08.md`, P4). The site tab’s 2026-10-10 inbox says the Android page says Safari on iPhone and does not claim a public iOS app. Schema should not list iOS as an `operatingSystem` until a real app exists (same note, T11). Caveat from the moderation note: the web NSFW filter is disabled on Safari. Safari crackle and delay are a separate web-audio issue (`ui/live.js`, `ui/webrtc.js`) and stay with the site / connect lanes.

**C. Stranger-match app on the App Store.** Same Start queue as Play. This is the case Guideline 1.2 names. Plan on rejection or later removal even with the filter stub replaced by a real model. Do not start this until Anton says the risk is accepted.

Public store Submit for Review stays blocked until Anton says yes in chat. This document does not submit anything.

## 4. Minimum path to TestFlight

Internal testing is the shortest path to a binary on a phone Anton controls. It still needs his Apple login. This Linux box cannot run Xcode. Steps below are the sequence, not work this hop did.

1. Apple Developer Program membership on the account that will own `me.ruletka.app`.
2. App Store Connect record for that bundle id. Copy the numeric Apple ID into `mobile/eas.json` → `submit.production.ios.ascAppId`. **This branch still has `REPLACE_ASC_APP_ID`.** The live connect checkout (not this branch) has an uncommitted `eas.json` value `6804910924`. Confirm which id is real before anyone submits. This hop does not edit `eas.json`.
3. EAS credentials (distribution cert, provisioning profile) via `eas` while Anton completes Apple 2FA. Expo owner in `app.json` is `courtiers-team`. Project id `1e9b8ca4-2dfc-4923-84d1-138222be372f`.
4. Export compliance is already in `app.config.js`: `ITSAppUsesNonExemptEncryption: false` and `ios.config.usesNonExemptEncryption: false`. iOS deployment target **15.1**. `supportsTablet: true` (iPad screenshots enter the conversation if that stays).
5. When Anton asks for a build: `cd mobile && eas build --profile production --platform ios` (or `production-friends` for option A). Then `eas submit --profile production --platform ios` only after the real `ascAppId` is in the file. Agents do not run these until he asks.
6. After processing, add an **internal** group. Apple: up to 100 App Store Connect users with Account Holder, Admin, App Manager, Developer, or Marketing. A build in Ready to Submit can go to internal testers. External testers (up to 10,000) need the first build approved by TestFlight App Review, plus a beta description, beta contact email, and review information. Builds last 90 days.
7. Smoke on a real iPhone: camera, mic, either a friend call (option A) or one stranger match (option C), then report and block. Write the result in chat. Agents do not mark that smoke passed.

Sources for the tester rules, fetched 2026-10-10:

- <https://developer.apple.com/testflight/>
- <https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/> (page dated 2026-10-06)
- <https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/> (page dated 2026-10-06)
- <https://developer.apple.com/help/app-store-connect/reference/app-uploads/app-build-statuses/> (Ready to Submit vs Waiting for Review)

Before a **public** listing (not required for the first internal install): 6.7" and 6.5" screenshots that meet Guideline 2.3.8 (metadata appropriate for a 4+ rating even when the app is rated higher), age-rating answers, App Privacy nutrition label, Support URL, and a monitored `support@ruletka.me`.

## 5. Sources

- Apple App Review Guidelines, 1.2, 1.1.4, 1.5, 2.2, 2.3.8: <https://developer.apple.com/app-store/review/guidelines/> (fetched 2026-10-10).
- TestFlight pages in §4.
- `knowledge/research/moderation-ui-2026-10-08.md` §10 (Play two-step filter and Apple 1.2) and open question 8.
- `knowledge/research/seo-2026-10-08.md` P4 (Safari line for iPhone) and T11 (do not advertise iOS in schema until it is real).
- This branch: `mobile/eas.json`, `mobile/app.json`, `mobile/app.config.js`, `mobile/src/config.ts`, `mobile/src/safety/logic.js`, `mobile/src/safety/ReportSheet.tsx`, `mobile/src/feedback/audioSession.ts`, `mobile/app/live.tsx`, `mobile/app/settings.tsx`.

## Status

- **Draft for Anton.** Not an implementation hop.
- Last measure: 2026-10-10, read-only on `polish/2026-10-10`. Safety policy test run recorded in `AGENT-INBOX.md`.
- Next: Anton picks A, B, or C. No EAS and no Submit for Review until he says so.
