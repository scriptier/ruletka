# Store secrets (never commit real keys)

This directory is gitignored except `.gitkeep` and this README.

## Google Play upload keystore (local AAB builds)

Same keystore EAS uses for `me.ruletka.app`. Required for local `bundleRelease`
so Play accepts the AAB as an update of previous releases.

Expected files (mode `600`):

```text
secrets/ruletka-upload.jks
secrets/keystore.properties   # storeFile / storePassword / keyAlias / keyPassword
secrets/credentials.json      # optional, eas-style
```

### How we populate them

While logged into Expo (`npx eas-cli whoami`):

```bash
# GraphQL download (agent did this once) — or interactively:
npx eas-cli credentials -p android
# → credentials.json → Download credentials from EAS
```

`android/app/build.gradle` release signing reads `../secrets/keystore.properties`.

### Local AAB

```bash
cd mobile
./scripts/build-aab-local.sh          # uses versionCode in android/app/build.gradle
./scripts/build-aab-local.sh 10     # bump versionCode for next Play upload
```

Output: `artifacts/ruletka-<version>-vc<N>.aab`

Needs:

- `~/Android/Sdk` (platform 35, build-tools 35, NDK 26.1)
- `~/.local/jdk-17` (Temurin 17 with `javac`)

## Google Play API submit (optional)

1. Play Console → Setup → API access → link a Google Cloud project  
2. Create a service account with **Release to testing tracks**  
3. Download JSON key → save as:

```text
mobile/secrets/google-play.json
```

4. Then:

```bash
cd mobile
npx eas-cli submit --profile production --platform android --path artifacts/ruletka-0.1.1-vc9.aab
```

## iOS

Set `ascAppId` in `eas.json` after creating the app in App Store Connect.
