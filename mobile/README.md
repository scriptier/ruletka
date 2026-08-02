# ruletka mobile (Expo / React Native)

Store apps for Google Play and the App Store. Talks to the same **roulette-bridge** hub as the web client.

See monorepo docs:

- [`docs/MOBILE.md`](../docs/MOBILE.md) — phases + parity checklist  
- [`docs/PROTOCOL.md`](../docs/PROTOCOL.md) — WebSocket JSON  

## Status (Phase 0 scaffold)

| Piece | Status |
|-------|--------|
| Expo app shell + 18+ rules | ✅ |
| SecureStore identity | ✅ |
| `HubClient` → `wss://hub/ws` | ✅ hello / spin / next / stop / signal / ping |
| Live debug screen | ✅ match events logged |
| `react-native-webrtc` A/V | ⏳ needs `expo prebuild` + device build |
| Friends / stars UI | ⏳ Phase 2–3 |

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

## Next milestones

1. Wire `MediaSession` with `RTCPeerConnection` + getUserMedia  
2. App ↔ web match with audio/video  
3. Stranger UX polish (Phase 1)  
4. EAS project id + internal distribution  

## License

LGPL-2.1-only (same as monorepo). Brand “ruletka.vip” is separate from the software license.
