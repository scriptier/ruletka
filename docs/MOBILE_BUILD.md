# Mobile APK build (local, automated)

## Standing rule (Grok)

After **any meaningful `mobile/` change** (Live chrome, MediaSession, prefs, i18n that ships in app):

```bash
cd /home/drakosik/freenet-roulette/mobile
./scripts/build-apk-local.sh --bump
```

Then report the artifact path. **Do not wait** for the human to ask “build apk”.

### Never auto
- Play Console upload  
- Bulk APK to public site download tree  
- `push.sh` unless human authorized deploy  

## Commands

| Command | Effect |
|---------|--------|
| `./scripts/build-apk-local.sh` | Build current `app.json` version |
| `./scripts/build-apk-local.sh --bump` | Patch version + versionCode, then build |
| `npm run build:apk` / `npm run build:apk:bump` | Same from `mobile/` |
| `./scripts/build-aab-local.sh` | Play AAB (upload separately) |

## Output

- `mobile/artifacts/ruletka-<ver>-vc<code>.apk`
- `mobile/artifacts/ruletka-latest.apk`
- `mobile/artifacts/ruletka-android-latest.apk` → latest named APK  

## Human phrases

- **build apk** → run script (default: current version; use `--bump` if version not yet bumped)
- **always bump apk after mobile** → this doc’s standing rule (already on)
