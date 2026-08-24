# Play day plan — ship tip **0.1.471 (479)**

## Package

| Item | Path / value |
|------|----------------|
| version | **0.1.471** / **479** (`mobile/app.json`) |
| APK (sideload + site) | `mobile/artifacts/ruletka-0.1.471-vc479.apk` · https://ruletka.vip/download/ |
| Web | hard-refresh `https://ruletka.vip/live.html` before smoke |
| AAB (Console) | `mobile/artifacts/ruletka-0.1.471-vc479.aab` — **not** uploaded |

> **Historical:** day plans for **0.1.28x** / **0.1.22x** are obsolete as ship tip; use this file + `app.json`.

## Smoke (before Console)

```bash
adb install -r mobile/artifacts/ruletka-0.1.471-vc479.apk
# or: adb install -r mobile/artifacts/ruletka-latest.apk
# hard-refresh https://ruletka.vip/live.html
# Hide IP off · Start once · no Next spam 15s
# Pass: both cams + audio ≥ 30s (Play↔PC)
# Eye / privacy: frosted mosaic (not pure black) · Show video restores face
# Regression: ./scripts/test-connectivity-lock.sh
```

## Build AAB + status (when uploading)

```bash
cd mobile
./scripts/build-aab-local.sh   # disk: ruletka-0.1.386-vc394.aab
./scripts/play-status.sh
./scripts/play-status.sh --notes
```

Upload: Play Console → **Internal testing** · package `me.ruletka.app` — **human open**, no agent Console PASS claim.  
Guide: `docs/PLAY_UPLOAD.md` · lock: `docs/CONNECTIVITY_LOCK.md` · checklist: `docs/PLAY_INTERNAL_TEST_CHECKLIST.md`
