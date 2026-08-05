# Store submit secrets (never commit real keys)

## Google Play

1. Play Console → Setup → API access → link a Google Cloud project  
2. Create a service account with **Release to testing tracks** (or Admin)  
3. Download JSON key → save as:

```text
mobile/secrets/google-play.json
```

4. Then:

```bash
cd mobile
npx eas-cli submit --profile production --platform android --latest
# or after AAB finishes:
npx eas-cli submit --profile production --platform android --id <BUILD_ID>
```

`eas.json` already points at `./secrets/google-play.json` and track `internal`.

## iOS

Set `ascAppId` in `eas.json` after creating the app in App Store Connect.
