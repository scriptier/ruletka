# Mobile device smoke checklist

Run after a **native** build (`eas build --profile development` or `npx expo prebuild && npx expo run:android|ios`).  
Expo Go is **not** enough for WebRTC.

## Build

```bash
cd mobile
npm install
npx eas-cli login && npx eas init   # once
npx eas build --profile development --platform android
# install the APK on a physical device (camera + mic)
```

Local alternative (Android Studio / Xcode installed):

```bash
npx expo prebuild
npx expo run:android
```

## Smoke matrix

| # | Test | Pass? |
|---|------|-------|
| 1 | App opens → 18+ rules → Home | |
| 2 | Settings: set name, gender, language; Save | |
| 3 | Live: local camera preview appears | |
| 4 | App ↔ web: Start both on same hub → match + A/V | |
| 5 | Mic mute / cam off / Flip | |
| 6 | In-call chat send/receive | |
| 7 | Report / Block → Next | |
| 8 | Hide IP on → rematch (TURN if hub has it) | |
| 9 | Friends: share code, second device Accept | |
| 10 | Friend Call → Answer → A/V → Hang up | |
| 11 | Outbound no-answer (30s) → history “No answer” | |
| 12 | Missed incoming → history “Missed” + Call back | |
| 13 | Post-chat ★ rate prompt (if duration ok) | |
| 14 | In-call gift (if stars > 0) | |
| 15 | Export encrypted backup → import on second install | |
| 16 | Kill network → reconnect strip → recovers | |
| 17 | (Optional) friends-only build: no stranger Start | |

Hub default: `https://ruletka.vip` (`EXPO_PUBLIC_HUB_BASE`).

## Fail common causes

| Symptom | Check |
|---------|--------|
| No camera | Not Expo Go; permissions; native build |
| Match but black video | ICE/TURN; firewall; `has_turn` in debug log |
| Friends offline both “online” on web | Same hub base; both completed hello |
| Import lost stars | Expected — stars are hub-side for `user_id` |

## After smoke

1. Capture screenshots for store (`assets/store/LISTING.md` shot list)  
2. `eas build --profile preview` → internal testers  
3. `eas build --profile production` → submit (see `STORE.md`)  
