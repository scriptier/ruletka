# Play day plan — ship **0.1.283 (291)**

## Package

| Item | Path / value |
|------|----------------|
| version | **0.1.283** / **291** |
| APK | `mobile/artifacts/ruletka-0.1.283-vc291.apk` → `ruletka-android-latest.apk` |
| Web | hard-refresh live → **`webrtc.js?v=285`** |
| AAB | build with `./scripts/build-aab-local.sh` (no auto-upload) |

## Why this build

- **Same-LAN both cams** — hub does **not** force_relay on same public IP (host P2P; pure TURN hairpin was black)
- **Hide IP** still pure TURN; untrusted IP still force_relay
- **No dual-offer** — Android hub-answerer never promotes@~9s
- **Blur veil** — RTCView at **zOrder 0** under opaque mosaic
- Regression: `./scripts/test-connectivity-lock.sh`

## Smoke (before Console)

```bash
adb install -r mobile/artifacts/ruletka-0.1.283-vc291.apk
# hard-refresh https://ruletka.vip/live.html  (webrtc.js?v=285)
# Hide IP off · Start once · no Next spam 15s
# Pass: both cams ≥ 30s
# Eye / privacy: frosted mosaic (not pure black) · Show video restores face
# Same Wi‑Fi: hub force_relay=false · 1 web offer + 1 android answer · host path OK
```

## Build AAB + status

```bash
cd mobile
./scripts/build-aab-local.sh --version 0.1.283 --code 291
./scripts/play-status.sh
./scripts/play-status.sh --notes
```

Upload: Play Console → **Internal testing** · package `me.ruletka.app`  
Guide: `docs/PLAY_UPLOAD.md` · lock: `docs/CONNECTIVITY_LOCK.md` · overnight: `docs/OVERNIGHT_2026-08-10.md`
