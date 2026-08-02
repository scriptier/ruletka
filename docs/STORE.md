# App Store / Google Play checklist (ruletka mobile)

Companion to [`MOBILE.md`](MOBILE.md). Code lives in `mobile/`.

## Prerequisites

| Item | Notes |
|------|--------|
| Apple Developer Program | $99/yr · org or individual |
| Google Play Console | $25 one-time |
| Expo account + EAS | `npm i -g eas-cli` · `eas login` |
| Privacy Policy URL | https://ruletka.vip/legal/privacy.html |
| Terms / EULA URL | https://ruletka.vip/legal/terms.html · eula |
| Support email | e.g. support@ruletka.vip |
| App icons 1024 / Play feature graphic | Generated under `mobile/assets/` + `mobile/assets/store/` (from `ui/brand/`) |

## One-time EAS project setup

```bash
cd mobile
npm install
npx eas-cli login
npx eas init
# Pastes real projectId into app.json extra.eas.projectId
# Confirm bundleIdentifier / package: vip.ruletka.app
```

Optional env when not using `eas init` edit:

```bash
export EAS_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

`app.config.js` also accepts `EAS_PROJECT_ID` and `EXPO_PUBLIC_HUB_BASE`.

## Build profiles (`eas.json`)

| Profile | Use |
|---------|-----|
| `development` | Dev client + APK (device debugging, WebRTC) |
| `preview` | Internal TestFlight / internal APK share |
| `preview-friends` | Same as preview, **friends-only** stranger Start off |
| `production` | Store AAB / IPA |
| `production-friends` | Store contingency (friends-only) |

```bash
cd mobile
# Device A/V smoke (recommended before store)
npx eas build --profile development --platform android
# or local:
npx expo prebuild
npx expo run:android

# Internal distribution
npx eas build --profile preview --platform all

# Store binaries
npx eas build --profile production --platform all
npx eas submit --profile production --platform android
npx eas submit --profile production --platform ios
```

npm helpers:

```bash
npm run build:preview
npm run build:prod
npm run build:friends   # contingency binary
```

Submit secrets:

- Android: `mobile/secrets/google-play.json` (gitignored) — Play service account JSON  
- iOS: set `ascAppId` in `eas.json` after creating the app in App Store Connect  

## Native / WebRTC notes

- Classic **Expo Go cannot** load `react-native-webrtc`.
- Plugins (prebuild): `@config-plugins/react-native-webrtc@10` (Expo 52) + `expo-build-properties` (Android minSdk 24).
- First real A/V test matrix:
  1. App ↔ web (https://ruletka.vip/live.html)
  2. App ↔ app
  3. Friend Call both directions
  4. Hide IP on (TURN) if hub has TURN

## Content rating (expect high age)

Random video chat is **UGC + mature potential**:

- Apple: 17+ (Frequent/Intense Mature/Suggestive themes)
- Google: typically PEGI 18 / similar · complete questionnaire honestly (UGC, users can share video of themselves)

**18+ gate is required** before camera — already in app (`rules` screen).

## Privacy labels / Data safety

Declare at minimum:

| Category | What to say |
|----------|-------------|
| Identifiers | Device-generated user id (not sold; used for friends/stars on hub) |
| Camera / mic | Live chat only; **not** uploaded as stored media files by our hub |
| Product interaction | Optional analytics only if enabled on hub |

Do **not** claim “anonymous absolute” or “no servers” — hub sees signaling + chat text.

Store URLs (already in Settings):

- Privacy · Terms · EULA · Safety · Community → hub pages

## Review notes (paste into App Review)

1. App is 18+ peer-to-peer video chat; media is WebRTC device-to-device when possible.  
2. Matchmaking/signaling uses our open-source hub; Block + Report in every call.  
3. No accounts — device identity + optional encrypted export.  
4. Stars are free reputation cosmetics, **not** real money / IAP.  
5. Demo: two devices on same TestFlight/build, Start → match; Friends tab for codes.  
6. Encryption export compliance: **ITSAppUsesNonExemptEncryption = false** (standard HTTPS/WebRTC only).

## Safety / moderation

- Hub auto-ban + admin reports (existing bridge)  
- Ensure mobile `user_id` shows in admin report stream  
- Safety / Community / legal links in **Settings** (shipped)

## Contingency if Apple rejects stranger roulette

```bash
npx eas build --profile production-friends --platform ios
# or env:
EXPO_PUBLIC_FRIENDS_ONLY=1
```

- Home CTA → Friends  
- Live: stranger **Start** / **Next** hidden  
- Friend Call still works  

Re-submit full stranger mode after appeals or policy changes. Optionally use a different bundle id if both must stay listed.

## Listing assets (in repo)

| Asset | Path |
|-------|------|
| Expo icon / adaptive / splash | `mobile/assets/icon.png` etc. (1024) |
| App Store / Play high-res icon | `mobile/assets/store/app-icon-1024.png` |
| Play feature graphic | `mobile/assets/store/play-feature-1024x500.png` |
| Listing copy draft | `mobile/assets/store/LISTING.md` |

Regenerate from brand:

```bash
cd mobile && python3 scripts/gen-store-assets.py
# or: npm run assets:store
```

## Listing checklist (manual)

- [x] 1024×1024 icon, adaptive icon, splash (from brand)  
- [x] Play feature graphic 1024×500  
- [x] Short / long description draft (`assets/store/LISTING.md`)  
- [ ] `eas init` real `projectId` (operator login)  
- [ ] Apple: create App, set ASC App ID in `eas.json`  
- [ ] Google: create app, service account JSON under `secrets/`  
- [ ] Screenshots on device — shot list in `LISTING.md` / `docs/DEVICE_SMOKE.md`  
- [ ] Age rating questionnaires  
- [ ] Privacy questionnaire matches this doc  
- [ ] Internal test track / TestFlight smoke (A/V + friend call)  
- [ ] Production submit  

## Not automated here

- Paid **Authenticode** / Apple **notarization** for desktop helpers (separate)  
- Marketing video / screenshot design  
- Push notifications for killed-app rings (post-v1)  
- Creating the Expo/Apple/Google accounts (operator)  
