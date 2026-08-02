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
export ROULETTE_IOS_BUNDLE_ID=vip.ruletka.app
# restart roulette-bridge
```

3. Confirm:

```bash
curl -s https://ruletka.vip/.well-known/apple-app-site-association | jq .
# details[0].appID should be TEAMID.vip.ruletka.app
```

4. Rebuild app with associated domains (already in config).

### Android

1. Get SHA-256 of the **upload or app-signing** cert (Play Console → App integrity, or `eas credentials`).  
2. On hub:

```bash
export ROULETTE_ANDROID_SHA256="AA:BB:CC:..."
export ROULETTE_ANDROID_PACKAGE=vip.ruletka.app
```

3. Confirm:

```bash
curl -s https://ruletka.vip/.well-known/assetlinks.json | jq .
```

4. Install a release/preview build; verify with:

```bash
adb shell pm get-app-links vip.ruletka.app
```

## Push for killed-app rings (post-v1)

Not wired yet. Preferred path:

1. `expo-notifications` + EAS project push credentials  
2. Client sends `register_push` with token after hello  
3. Hub stores token per `user_id`; on `call_friend` → FCM/APNs when callee offline  
4. Tap notification opens app → existing call banner if still ringing  

Until then: in-app banners while the app is open (shipped).

## Related

- [`STORE.md`](STORE.md) · [`DEVICE_SMOKE.md`](DEVICE_SMOKE.md) · [`MOBILE.md`](MOBILE.md)  
- Static templates: `ui/.well-known/`  
