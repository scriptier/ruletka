# Play day plan — ship **0.1.280 (288)**

## Package

| Item | Path / value |
|------|----------------|
| version | **0.1.280** / **288** |
| APK | `mobile/artifacts/ruletka-0.1.280-vc288.apk` → `ruletka-android-latest.apk` |
| AAB | `mobile/artifacts/ruletka-0.1.280-vc288.aab` |
| Prior AAB | `ruletka-0.1.278-vc286.aab` |

## Why this build

- **PC partner camera** — no blanket web↔android `force_relay` (CONNECTIVITY_LOCK)
- **Location** — hub `partner_geo` after match; soft “Looking up location…” until geo arrives
- **Behind bars** — PC paints jail on self-cam for ~15s (not toast-only)
- **Post-call chrome** — Start returns after hangup (clears stuck `has-remote-feed`)
- Mute badge only; blur veil default **off**; hybrid ICE
- Regression: `./scripts/test-connectivity-lock.sh` (CI job `connectivity-lock`)

## Smoke (before Console)

```bash
adb install -r mobile/artifacts/ruletka-0.1.280-vc288.apk
# hard-refresh https://ruletka.vip/live.html  (live.js?v=520+)
# Hide IP off · blur off · Start once · no Next spam 15s
# Hub: force_relay=false · 1 web offer + 1 android answer
# Pass: both cams ≥ 30s · Stop → Start returns · bars on PC self-tile 15s
```

## Build AAB + status

```bash
cd mobile
./scripts/build-aab-local.sh
./scripts/play-status.sh
./scripts/play-status.sh --notes
```

Upload: Play Console → **Internal testing** · package `me.ruletka.app`  
Guide: `docs/PLAY_UPLOAD.md` · lock: `docs/CONNECTIVITY_LOCK.md`
