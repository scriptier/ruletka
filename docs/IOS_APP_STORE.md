# Apple App Store — runbook (ruletka mobile)

Companion to [`STORE.md`](STORE.md) and [`MOBILE.md`](MOBILE.md). Same **Expo app** as Play/RuStore —
there is no separate Swift rewrite. Bundle id: **`me.ruletka.app`**.

Human owns the Apple Developer account, App Store Connect, and TestFlight/App Store submission.
Agents prepare copy, docs, and (when asked) build binaries — never submit or claim Apple review outcomes.

## Prerequisites

| Item | Notes |
|------|--------|
| Apple Developer Program | $99/yr · org or individual account holder |
| App Store Connect access | Human logs in at appstoreconnect.apple.com |
| Expo account + EAS CLI | `npm i -g eas-cli` · `eas login` (same account as Play) |
| Bundle identifier | `me.ruletka.app` (already set in `mobile/app.json` → `expo.ios.bundleIdentifier`) |
| Privacy Policy URL | https://ruletka.vip/legal/privacy.html |
| Terms / EULA URL | https://ruletka.vip/legal/terms.html |
| Data deletion URL | https://ruletka.vip/legal/delete.html |
| Child safety / CSAE URL | https://ruletka.vip/legal/child-safety.html |
| Support URL | https://ruletka.vip/safety.html (or `support@ruletka.me`) |
| Marketing URL (optional) | https://ruletka.vip |
| Support email | support@ruletka.me |
| Privacy email | privacy@ruletka.me |

## 1) Create the app in App Store Connect (human)

1. App Store Connect → **Apps** → **+** → **New App**.
2. Platform **iOS**, name **ruletka** (fall back to a suffix like `ruletka video chat` if the
   name is taken), primary language English (U.S.), bundle id `me.ruletka.app`, SKU e.g. `ruletka-ios`.
3. Copy the numeric **Apple App ID** (the "App Store Connect App ID", *not* the bundle id) —
   looks like `1234567890`.
4. Set `submit.production.ios.ascAppId` in `mobile/eas.json` to that value
   (currently a placeholder `REPLACE_ASC_APP_ID`). **This file is out of scope for this task —
   Grok/human edits it**, not this agent.

## First EAS build checklist

`submit.production.ios.ascAppId` in `mobile/eas.json` is already set (`6804910924`) — the
App Store Connect app exists. Before the human/Grok runs the first production build:

- [ ] `cd mobile && npm install` — lockfile in sync, no missing native deps.
- [ ] `npx eas whoami` — confirm logged into the same Expo account used for Android.
- [ ] `npx tsc --noEmit` and `./scripts/dev-smoke.sh --unit` pass (see §8 below).
- [ ] Bundle id `me.ruletka.app` and `NSCameraUsageDescription` / `NSMicrophoneUsageDescription`
  present in `mobile/app.json` (already set — verify only, do not edit here).
- [ ] `mobile/assets/store/ios/LISTING.md` and `WHAT-TO-TEST.md` ready to paste into App
  Store Connect once a build lands in TestFlight.
- [ ] First build has no existing iOS Distribution Certificate/Provisioning Profile — expect
  an interactive `eas credentials --platform ios` prompt (Apple 2FA, human-only).
- [ ] Run the build:

  ```bash
  cd mobile && eas build --profile production --platform ios
  ```

- [ ] After the build finishes, submit to TestFlight:

  ```bash
  cd mobile && eas submit --profile production --platform ios
  ```

- [ ] Paste `WHAT-TO-TEST.md` into TestFlight's "What to Test" field for the build.
- [ ] Run the TestFlight smoke matrix in §8 before requesting App Store review.

## 2) EAS iOS production build steps

```bash
cd mobile
npm install
npx eas-cli login

# One-time: register the iOS credentials profile (interactive; needs
# Apple Developer login + lets EAS manage certs/provisioning, or upload your own)
npx eas credentials --platform ios

# Store binary
npx eas build --profile production --platform ios

# After ascAppId is filled in eas.json:
npx eas submit --profile production --platform ios
```

- `production` profile (`mobile/eas.json`) already carries `EXPO_PUBLIC_HUB_BASE=https://ruletka.vip`
  and `autoIncrement: true` for build numbers — no manual bump needed per build.
- `ios.buildNumber` in `app.json` is the CFBundleVersion seed; EAS auto-increments per submit
  when `autoIncrement` is set, same as Android `versionCode`.
- First build: EAS will prompt to create/reuse a Distribution Certificate and Provisioning
  Profile. Let EAS manage credentials unless the human already has an existing profile to reuse.
- TestFlight contingency (stranger roulette rejected on first pass):

  ```bash
  npx eas build --profile production-friends --platform ios
  ```

  Same binary with `EXPO_PUBLIC_FRIENDS_ONLY=1` — Home CTA → Friends, stranger Start/Next hidden,
  Friend Call still works. See "Contingency" in `STORE.md`.

## 3) App Store Connect metadata

Fill from [`mobile/assets/store/ios/LISTING.md`](../mobile/assets/store/ios/LISTING.md) (EN + RU).

| ASC field | Source |
|-----------|--------|
| App name | LISTING.md — App name |
| Subtitle (30 char) | LISTING.md — Subtitle |
| Promotional text (170 char, optional) | LISTING.md — What's new |
| Description | LISTING.md — Description |
| Keywords (100 char, comma-separated) | LISTING.md — Keywords |
| Support URL | https://ruletka.vip/safety.html |
| Marketing URL (optional) | https://ruletka.vip |
| Privacy Policy URL | https://ruletka.vip/legal/privacy.html |
| Copyright | current year + legal entity name |
| Version release notes | LISTING.md — What's new |

Screenshots: reuse the same devices as Play (`mobile/assets/store/screenshots/`) — App Store
needs 6.7"/6.5" iPhone + 12.9" iPad sizes if `supportsTablet: true` stays on. No iOS-specific
screenshots exist yet; regenerate from a real device/simulator before submission (out of scope
for this doc pass).

## 4) Age rating — 17+

App Store age rating questionnaire (Apple no longer uses the old "17+" content descriptors UI
verbatim, but the outcome must land at **17+** minimum):

| Question | Answer | Why |
|----------|--------|-----|
| Unrestricted web access | No (video chat, not a browser) | — |
| Mature/suggestive themes | **Frequent/Intense** | live UGC video with strangers |
| User-generated content | **Yes** | live video + chat between users |
| Contests | No | — |
| Gambling (simulated) | No — "Stars" are free cosmetic reputation, not wagered, no IAP | avoid triggering gambling flags |
| In-app purchases | No | no monetization in v1 |

Age gate (18+) is enforced in-app before camera access — `mobile/app/rules.tsx` — cite this as
evidence during review if Apple asks how minors are excluded.

## 5) Camera / mic usage strings

Already set in `mobile/app.json` (`expo.ios.infoPlist`) — **do not edit as part of this task**,
just verify at submission time:

```json
"NSCameraUsageDescription": "ruletka needs the camera for peer-to-peer video chat. Video goes device-to-device and is not uploaded to our servers.",
"NSMicrophoneUsageDescription": "ruletka needs the microphone for peer-to-peer video chat."
```

Both strings explain *why* (required by Apple review — vague strings like "Needs camera access"
get rejected).

## 6) Encryption export compliance

Set **ITSAppUsesNonExemptEncryption = false** in App Store Connect's export compliance question
during submission (or `ios.infoPlist.ITSAppUsesNonExemptEncryption` in `app.json`, owned by the
app.json lane, not this task).

- The app only uses standard HTTPS/WSS (hub signaling) and WebRTC's mandatory DTLS-SRTP —
  both qualify for Apple's standard encryption exemption (no custom/proprietary crypto).
- Answer **"No"** to "Does your app use encryption?" beyond exempt standard use, or select the
  exemption category for "uses encryption for authentication/HTTPS/standard protocols only."
- If EAS build fails App Store validation asking for this flag explicitly, add
  `ITSAppUsesNonExemptEncryption: false` under `expo.ios.infoPlist` in `app.json` — flag to
  Grok/human since `app.json` is a different lane.

## 7) App Review notes (paste into "App Review Information → Notes")

Same substance as the Play/RuStore review notes in `STORE.md`, iOS-specific framing:

```
ruletka is an 18+ peer-to-peer video chat app (strangers matched randomly, or friends
called by invite code). Video/audio is WebRTC device-to-device when a direct path exists;
our open-source signaling hub (roulette-bridge) only relays connection setup, never stores
call video.

- No account/password — identity is a device-generated id (Settings → export encrypted
  backup optional).
- Every call has Block + Report; reports go to hub admin review with optional screenshot
  evidence.
- Age gate (18+) is required before camera access — see the Rules screen on first launch.
- "Stars" are free, non-purchasable reputation cosmetics — no IAP, no gambling mechanic.
- Encryption: standard HTTPS/WSS signaling + WebRTC DTLS-SRTP only (ITSAppUsesNonExemptEncryption
  = false); no custom cryptography.

Demo steps for review:
1. Launch app → accept 18+ rules gate.
2. Grant camera/mic permission when prompted.
3. Tap Start to enter the stranger queue (a second device/tester may be needed to match
   quickly — with only one reviewer device, matching may sit in "waiting" since this is a
   live peer pool; Friends tab lets you generate a code and self-test Friend Call end-to-end
   on one Apple ID via two simulators/devices if needed).
4. Friends tab → Invite → share/copy code → Add friend by code on a second device → Call.
```

## 8) TestFlight smoke vs ruletka.vip

Before requesting App Store review, run the same connectivity smoke as Play (`DEVICE_SMOKE.md`)
against the production hub:

```bash
cd mobile
./scripts/dev-smoke.sh --unit      # unit tests, no device needed
npx tsc --noEmit
```

Then on a real device via TestFlight build:

| # | Check | Notes |
|---|-------|-------|
| 1 | iPhone (TestFlight) ↔ web (`https://ruletka.vip/live.html`) | both cams + audio connect |
| 2 | iPhone (TestFlight) ↔ Android (Play internal) | cross-platform, same hub |
| 3 | Friend Call both directions (invite code) | ring, accept, decline, cancel |
| 4 | Hide IP on (TURN) if hub has TURN configured | see `CONNECTIVITY_LOCK.md` |
| 5 | Backgrounding mid-call → foreground → resumes | iOS background video suspension differs from Android — verify explicitly |
| 6 | 18+ gate blocks camera until accepted | fresh install |

Distribute via **TestFlight internal testing** first (up to 100 internal testers, no Apple
review needed for internal group) before submitting for external TestFlight or App Store review.
Follow `./scripts/test-connectivity-lock.sh` gate from `CONNECTIVITY_LOCK.md` before any hub/ICE
change that touches this path — unrelated to this doc task but load-bearing if a connect fix
lands alongside a store push.

## 9) Friends-only contingency (stranger roulette rejected)

If Apple rejects random stranger video matching on first pass (common first-round Apple concern
for UGC video apps — same risk Play flagged):

```bash
cd mobile
npx eas build --profile production-friends --platform ios
npx eas submit --profile production-friends --platform ios
```

- Ships with `EXPO_PUBLIC_FRIENDS_ONLY=1` — Home CTA routes to Friends, stranger Start/Next
  hidden, Friend Call/Chat still fully functional.
- Resubmit full stranger mode after an appeal or once moderation/reporting evidence satisfies
  the reviewer (cite Block+Report flow, admin ban bridge, screenshot evidence from §7).
- If Apple requires stranger mode to stay off permanently for one listing, consider a
  friends-only-labeled bundle id as a separate listing (mirrors the Play/RuStore fallback in
  `STORE.md` §"Contingency if Apple rejects stranger roulette") — a human/Grok decision, not
  automated here.

## Not in scope for this doc (human/Grok owns)

- Creating the Apple Developer / App Store Connect account.
- Filling `ascAppId` in `mobile/eas.json`.
- Editing `app.json` / `eas.json` iOS build config.
- Running `eas build` / `eas submit` for iOS (agent may run when explicitly asked in a future
  task; not part of this runbook-only task).
- iOS-specific screenshots (reuse/regenerate device shots separately).
- Actually claiming Apple review PASS/REJECT or GOAL_MET — human/Grok verifies in App Store Connect.
