# Operator next steps (store apps)

Code for **web + mobile** is on `main` and the hub is deployed. Remaining work needs **your** Expo / Apple / Google accounts.

## 0. Machine

- Node **20+** (this repo now has nvm Node 20 available: `source ~/.nvm/nvm.sh && nvm use 20`)
- Xcode (iOS) and/or Android Studio
- Expo account: https://expo.dev/signup

## 1. EAS project + first native build

```bash
source ~/.nvm/nvm.sh && nvm use 20
cd mobile
npm install
npm run preflight         # tsc, assets, hub, eas login status
npx eas-cli login          # interactive browser/device
npx eas init              # writes projectId into app.json
npm run preflight         # should show projectId OK
npx eas build --profile development --platform android
# install APK → work through docs/DEVICE_SMOKE.md
```

## 2. App Links (after first signing cert)

On the **hub** systemd env (or `/opt/ruletka` env file) after you have Team ID + Play SHA256:

```bash
ROULETTE_IOS_TEAM_ID=XXXXXXXXXX
ROULETTE_ANDROID_SHA256=AA:BB:...
# restart roulette-bridge
./scripts/verify-app-links.sh
```

See [`APP_LINKS.md`](APP_LINKS.md).

## 3. Offline friend-call push (optional)

| Piece | Status |
|-------|--------|
| Hub `register_push` + `push_tokens.json` | Shipped |
| Offline call → `ROULETTE_PUSH_WEBHOOK_URL` | Shipped |
| Mobile Settings “Friend call alerts” | Shipped (registers when expo-notifications linked) |
| Real FCM/APNs via Expo | **You**: `npx expo install expo-notifications` after EAS project |

```bash
# Optional custom relay (ntfy, worker that calls Expo Push API, etc.)
export ROULETTE_PUSH_WEBHOOK_URL=https://your-relay.example/ruletka-push
```

## 4. Store submit

[`STORE.md`](STORE.md) · assets in `mobile/assets/store/` · listing copy `LISTING.md`.

```bash
npx eas build --profile production --platform all
npx eas submit --profile production --platform android
```

## 5. Smoke

[`DEVICE_SMOKE.md`](DEVICE_SMOKE.md)

---

**Blocked without interactive login:** `eas login` (not possible unattended from CI/agent).  
Everything else for the product loop is implemented and production hub is current.
