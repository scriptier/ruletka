# Mobile apps (React Native / Expo)

Store apps for **Google Play** and **Apple App Store**.

| Decision | Value |
|----------|--------|
| Stack | React Native + **Expo** (dev client / prebuild; not pure Expo Go for WebRTC) |
| v1 product | Full: strangers + friends + stars |
| Hub | Existing `roulette-bridge` (`wss://…/ws`, `GET /config.json`) |
| Location | `mobile/` in this monorepo |

Web client (`ui/`) remains the **product reference**. Mobile reimplements the protocol; it does not load `live.js`.

## Architecture

- **HubClient** — JSON WebSocket client (`docs/PROTOCOL.md`)
- **MediaSession** — `react-native-webrtc` + ICE from `/config.json`
- **Identity** — SecureStore `user_id` + password export compatible with web envelope
- **Stars / friends** — hub-authoritative; never trust client-forged balances

## Phases

| Phase | Goal | Exit |
|-------|------|------|
| **0** Foundations | Scaffold, HubClient, MediaSession A/V | App ↔ web or app ↔ app match works (native build) |
| **1** Stranger loop | Start/Next/Stop, safety, chat | Internal TestFlight / Play testing |
| **2** Friends | Codes, call ring, miss | Friend call loop store-testable |
| **3** Stars + export | Gifts, spend, backup | Parity checklist green |
| **4** Store | Listings, privacy forms, review | Public listing |

Push for friend rings while killed is **post-first-submit** unless schedule allows (prefer in-app rings for v1).

## v1 parity checklist

### Safety

- [ ] 18+ rules gate before camera
- [ ] Block + Report (hub `report_user` / `block_user`)
- [ ] In-app safety / community links (existing legal pages)
- [ ] No claim that video is stored on our servers

### Strangers

- [ ] Hello + soft gender prefs
- [ ] Start / Next / Stop
- [ ] Alone / quiet pool invite share
- [ ] Matched WebRTC A/V
- [ ] Mute mic / flip camera
- [ ] Hide IP relay preference (TURN)
- [ ] In-call text chat
- [ ] Reconnect / ICE soft recovery

### Friends

- [ ] Friend code display + add by code
- [ ] Accept / decline
- [ ] Online presence
- [ ] Call / answer / decline / cancel
- [ ] No-answer + missed in-app

### Stars

- [ ] Balance + trust from `hello_ok` / events
- [ ] Mid-chat unlock timing (early ramp + 15m)
- [ ] Post-chat gift
- [ ] Spend at least Heart + one mid-tier gift
- [ ] Never import stars from profile file

### Account-less identity

- [ ] Stable device `user_id`
- [ ] Encrypted export / import (web-compatible)
- [ ] Hub failover via directory

### i18n

- [ ] Reuse packs under `ui/i18n/*.json` (or subset) for EN/RU + major langs

## Explicit non-goals (v1)

- Trio / find-third, rooms, admin UI  
- Full gift FX stack parity  
- Capacitor / store PWA wrap  
- LAN PeerRoulette protocol  
- Multi-hub stars  

## Store notes

- Age rating high (UGC video). Expect **multiple App Store review cycles**.
- Contingency: friends-only binary if stranger roulette blocked.
- Camera/mic purpose strings; Data safety / App Privacy questionnaires.

## Dev

```bash
cd mobile
npm install
npx expo prebuild   # when native WebRTC linked
npx expo run:android
npx expo run:ios    # macOS + Xcode
```

Default hub: `https://ruletka.vip` (override with env `EXPO_PUBLIC_HUB_BASE`).

## Related docs

- [`PROTOCOL.md`](PROTOCOL.md) — wire format  
- [`SELF_HOST.md`](SELF_HOST.md) — run a hub  
- [`HELPERS.md`](HELPERS.md) — desktop island helpers (not the store apps)  
