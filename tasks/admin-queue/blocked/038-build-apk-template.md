# Task: Build local sideload APK (template for Grok / overnight)

## Goal
Produce a fresh signed release APK under `mobile/artifacts/` without deploy or Play upload.

## Command
```bash
cd /home/drakosik/freenet-roulette/mobile
./scripts/build-apk-local.sh --bump
```

Or pin:
```bash
./scripts/build-apk-local.sh --version 0.1.130 --code 138
```

## Done when
- [ ] APK at `mobile/artifacts/ruletka-<ver>-vc<code>.apk`
- [ ] `ruletka-latest.apk` and `ruletka-android-latest.apk` updated
- [ ] RESULT notes version path (no site upload)

## Do not
- `push.sh` / production deploy
- Bulk APK to public download tree
- Play Console upload unless human asked
