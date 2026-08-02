# `.well-known` (mobile app links)

| Path | Purpose |
|------|---------|
| `apple-app-site-association` | iOS Universal Links |
| `assetlinks.json` | Android App Links |
| `security.txt` | Security contact (existing) |

The **bridge** serves AASA + assetlinks with `Content-Type: application/json`.

## Enable after store signing

On the hub process / systemd env:

```bash
# Apple Developer → Membership → Team ID (10 chars)
export ROULETTE_IOS_TEAM_ID=ABCDE12345
export ROULETTE_IOS_BUNDLE_ID=vip.ruletka.app

# Play App signing cert SHA-256 (colon-separated hex)
# eas credentials / Play Console → App integrity
export ROULETTE_ANDROID_SHA256=AA:BB:CC:...
export ROULETTE_ANDROID_PACKAGE=vip.ruletka.app
```

Verify:

```bash
curl -sI https://ruletka.vip/.well-known/apple-app-site-association | head
curl -s https://ruletka.vip/.well-known/assetlinks.json
```

Mobile claims hosts in `mobile/app.config.js` (`associatedDomains` / `intentFilters`).
