# Operator next steps (store apps)

Code for **web + mobile** is on `main` and the hub is deployed. Remaining work needs **your** Expo / Apple / Google accounts.

## 0. Machine

- Node **20+** (`source ~/.nvm/nvm.sh && nvm use 20` if you use nvm)
- Xcode (iOS) and/or Android Studio
- Expo account: https://expo.dev/signup

## 1. EAS project + first native build

### Interactive login (normal)

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

### Non-interactive (CI / agent) via access token

1. Expo dashboard → **Access tokens** → create token with build rights  
2. Export and run (token is a secret — never commit):

```bash
export EXPO_TOKEN=xxxxxxxx   # or EAS_ACCESS_TOKEN
cd mobile
npx eas-cli whoami           # should print your account
npx eas init --id <project-uuid>   # if project already created on expo.dev
# or: npx eas init             # may still need one interactive confirm
npx eas build --profile development --platform android --non-interactive
```

Agents/automation **cannot** complete `eas login` without `EXPO_TOKEN`.

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

### Android production AAB (current)

Package: **`me.ruletka.app`**. Production profile no longer ships `expo-dev-client` or OTA `channel` (no `expo-updates` yet). RN aligned to **0.76.9**; WebRTC `pickFirst` packaging set for EAS Gradle.

| Build | Version code | Status | Notes |
|-------|--------------|--------|--------|
| [c6bcf3de…](https://expo.dev/accounts/courtiers-team/projects/ruletka/builds/c6bcf3de-894e-4ecb-b1dc-fd44aa43c319) | **3** | finished | Older AAB |
| [3e43e238…](https://expo.dev/accounts/courtiers-team/projects/ruletka/builds/3e43e238-cb1d-44ae-adc4-e40367cb23c3) | **4** | finished | [AAB download](https://expo.dev/artifacts/eas/1Zg9q_UtLbeKCEmXeyY4rVKZMStgPOne51jZS36NQKE.aab) · `mobile/artifacts/ruletka-0.1.0-vc4.aab` |
| [9d626558…](https://expo.dev/accounts/courtiers-team/projects/ruletka/builds/9d626558-8b8c-465b-b7e1-4b2f05e0d101) | **5** | building | Latest `main` (liquidity + layout polish) |

**Two-person web test (friend_calls):** see [`LIQUIDITY_TEST.md`](LIQUIDITY_TEST.md). Today’s hub may show `matches > 0` but `friend_calls: 0` until you complete Path A once.

```bash
cd mobile
npm run preflight
npx eas-cli build --profile production --platform android --non-interactive
# when FINISHED:
npx eas-cli submit --profile production --platform android --latest
```

**Submit is blocked until you add** `mobile/secrets/google-play.json` (Play service account). See `mobile/secrets/README.md`.

**Manual path (no JSON yet):** Play Console → **me.ruletka.app** → Testing → **Internal testing** → Create release → upload the AAB (vc3 file above, or vc4 when finished).

```bash
npx eas build --profile production --platform all
npx eas submit --profile production --platform android
```

### iOS (blocked on App Store Connect)

1. Create app in App Store Connect (bundle `me.ruletka.app`).
2. Put numeric **Apple ID** into `mobile/eas.json` → `submit.production.ios.ascAppId` (replace `REPLACE_ASC_APP_ID`).
3. `npx eas-cli build --profile production --platform ios` (Apple login / certs may prompt).

## 5. Smoke

[`DEVICE_SMOKE.md`](DEVICE_SMOKE.md)

---

**Blocked without interactive login:** `eas login` (not possible unattended from CI/agent).  
Everything else for the product loop is implemented and production hub is current.

## Play Internal (manual)

See [`PLAY_UPLOAD.md`](PLAY_UPLOAD.md) for AAB links and Console steps.
