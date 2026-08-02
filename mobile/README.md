# ruletka mobile (Expo / React Native)

Store apps for Google Play and the App Store. Talks to the same **roulette-bridge** hub as the web client.

See monorepo docs:

- [`docs/MOBILE.md`](../docs/MOBILE.md) — phases + parity checklist  
- [`docs/PROTOCOL.md`](../docs/PROTOCOL.md) — WebSocket JSON  

## Status (Phase 1 stranger loop)

| Piece | Status |
|-------|--------|
| Expo app shell + 18+ rules | ✅ |
| SecureStore identity | ✅ |
| `HubClient` + auto-reconnect | ✅ |
| Soft gender prefs / hide IP | ✅ Settings screen |
| Live: Start/Next/Stop + A/V path | ✅ native build for camera |
| Alone-pool invite share | ✅ |
| In-call chat | ✅ |
| Report + Block | ✅ |
| Friends list + Call | ✅ Phase 2 |
| Incoming/outbound call banners | ✅ |
| Stars rate prompt + in-call gifts | ✅ Phase 3 |
| Profile export/import (web-compatible) | ✅ |
| ICE soft-restart | ✅ |
| Hub directory failover | ✅ |
| Mid-chat ★ progress | ✅ |
| EAS / store checklist | ✅ `eas.json` + `docs/STORE.md` |
| Missed / no-answer call history | ✅ Friends tab |
| Safety / legal links | ✅ Settings |
| 30s outbound ring timeout | ✅ |
| i18n (web packs + mobile overlay) | ✅ Settings → Language |

### First A/V call (device)

```bash
cd mobile
npm install
npx expo prebuild
npx expo run:android   # physical device or emulator with camera
# second peer: web https://ruletka.vip/live.html  OR another device
```

Both must reach the same hub (`EXPO_PUBLIC_HUB_BASE`). Signal kinds match web: `offer` / `answer` / `ice` / `bye`.

## Requirements

- Node 20+ recommended (Node 18 may fail on newest `create-expo-app`)  
- For real WebRTC: Android Studio and/or Xcode  
- Hub: default `https://ruletka.vip` (`EXPO_PUBLIC_HUB_BASE`)

## Setup

```bash
cd mobile
cp .env.example .env
npm install

# JS-only smoke (no camera):
npx expo start

# Native WebRTC (required for A/V):
npx expo install expo-build-properties
npx expo prebuild
npx expo run:android
# or: npx expo run:ios
```

`react-native-webrtc` is listed in `package.json` but **must be linked via prebuild** — it will not work inside classic Expo Go.

## Project layout

```
mobile/
  app/                 # Expo Router screens
  src/hub/             # HubClient + types
  src/identity/        # SecureStore identity + rules flag
  src/media/           # MediaSession (WebRTC — Phase 0 stub → full PC)
  src/config.ts
```

## i18n

Packs are copied from `ui/i18n/*.json` into `src/i18n/packs/`:

```bash
./scripts/sync-i18n.sh   # after editing web strings
```

Mobile-only keys live in `src/i18n/mobile-overlay.ts` (EN + RU). Other langs use web packs and fall back to EN for `mobile.*` keys. Language: Settings → System or force EN/RU/DE/ES/…

## Next milestones

1. Native device smoke: app ↔ web A/V + friend Call  
2. `eas init` projectId + internal TestFlight / Play track  
3. Store assets (1024 icon, screenshots, feature graphic)  
4. Optional: push for killed-app rings  

## License

LGPL-2.1-only (same as monorepo). Brand “ruletka.vip” is separate from the software license.
