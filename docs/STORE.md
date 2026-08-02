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
| App icons 1024 / Play feature graphic | Replace `mobile/assets/*` placeholders |

## EAS setup

```bash
cd mobile
npm install
npx eas-cli login
npx eas init          # writes projectId into app.json extra.eas
# Edit app.json: bundleIdentifier / package, projectId
eas build --profile development --platform android
eas build --profile preview --platform all
eas build --profile production --platform all
```

Config: `mobile/eas.json`  
Permissions strings: `mobile/app.json` (camera / mic purpose text).

## Content rating (expect high age)

Random video chat is **UGC + mature potential**:

- Apple: 17+ (Frequent/Intense Mature/Suggestive themes, unrestricted web access if any)
- Google: typically PEGI 18 / similar · complete questionnaire honestly (UGC, users can share video of themselves)

**18+ gate is required** before camera — already in app.

## Privacy labels

Declare at minimum:

- Identifiers (device-generated user id — not sold)
- Product interaction (optional analytics if enabled)
- Photos/camera/mic (for live chat only; **not** uploaded as stored media files)

Do **not** claim “anonymous absolute” or “no servers” — hub sees signaling + chat text.

## Review notes (paste into App Review)

Suggested talking points:

1. App is 18+ peer-to-peer video chat; media is WebRTC device-to-device when possible.  
2. Matchmaking/signaling uses our open-source hub; Block + Report in every call.  
3. No accounts — device identity + optional encrypted export.  
4. Stars are free reputation cosmetics, not real money / IAP.  
5. Demo: two devices on same TestFlight build, Start → match; Friends tab for codes.

## Safety / moderation

- Hub auto-ban + admin reports (existing bridge)  
- Ensure mobile `user_id` shows in admin report stream  
- Keep Safety / Community links reachable from Settings (add if missing)

## Contingency if Apple rejects stranger roulette

Ship a **friends-only** build (hide Start stranger queue; keep Call friends). Re-submit stranger mode after appeals or policy changes.

## Not automated here

- Paid **Authenticode** / Apple **notarization** for desktop helpers (separate)  
- Store screenshot sets · marketing video  
- Push notifications for killed-app rings (post-v1)  
