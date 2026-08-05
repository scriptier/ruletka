# Universal Links / App Links (mobile)

Open `https://ruletka.vip/live.html?friend=CODE` in the **installed app** when possible.

## Pieces

| Layer | What |
|-------|------|
| Hub | `GET /.well-known/apple-app-site-association` · `GET /.well-known/assetlinks.json` |
| Env | `ROULETTE_IOS_TEAM_ID`, `ROULETTE_ANDROID_SHA256`, … |
| App | `associatedDomains` + Android `intentFilters` in `mobile/app.config.js` |
| Client | `FriendInviteHandler` parses `?friend=` / `ruletka://friend/` |

Custom scheme **`ruletka://friend/CODE`** works without these files (Share sheet includes both).

## Live on production

Deployed with the hub: `https://ruletka.vip/.well-known/…` returns **200** + `application/json`  
(empty applinks until Team ID / SHA256 env are set).

```bash
./scripts/verify-app-links.sh
# or: ./scripts/verify-app-links.sh https://ruletka.me
```

## Operator setup (after first store / EAS signing)

### iOS

1. Apple Developer → Membership → **Team ID**  
2. On hub:

```bash
export ROULETTE_IOS_TEAM_ID=XXXXXXXXXX
export ROULETTE_IOS_BUNDLE_ID=me.ruletka.app
# restart roulette-bridge
```

3. Confirm:

```bash
curl -s https://ruletka.vip/.well-known/apple-app-site-association | jq .
# details[0].appID should be TEAMID.me.ruletka.app
```

4. Rebuild app with associated domains (already in config).

### Android

1. Get SHA-256 of the **upload or app-signing** cert (Play Console → App integrity, or `eas credentials`).  
2. On hub:

```bash
export ROULETTE_ANDROID_SHA256="AA:BB:CC:..."
export ROULETTE_ANDROID_PACKAGE=me.ruletka.app
```

3. Confirm:

```bash
curl -s https://ruletka.vip/.well-known/assetlinks.json | jq .
```

4. Install a release/preview build; verify with:

```bash
adb shell pm get-app-links me.ruletka.app
```

## Push for killed-app rings

| Layer | Status |
|-------|--------|
| Protocol `register_push` / `push_registered` | Hub + mobile types |
| Store `data/push_tokens.json` | Hub |
| Offline `call_friend` → webhook | `ROULETTE_PUSH_WEBHOOK_URL` |
| Mobile Settings toggle | “Friend call alerts” |
| `expo-notifications` + Expo Push API | After `eas init` (optional install) |

Until OS notifications are linked: **in-app banners** while the app is open (shipped).

Preferred full path:

1. `npx expo install expo-notifications` in `mobile/` after EAS project  
2. Client registers token (Settings save already calls `tryRegisterPush`)  
3. Hub stores token; offline call fires webhook with Expo token  
4. Relay or Expo Push API delivers; tap opens app  

See [`OPERATOR_NEXT.md`](OPERATOR_NEXT.md).

## Related

- [`STORE.md`](STORE.md) · [`DEVICE_SMOKE.md`](DEVICE_SMOKE.md) · [`MOBILE.md`](MOBILE.md)  
- Static templates: `ui/.well-known/`  
