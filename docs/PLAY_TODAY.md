# Play day plan — ship **0.1.283 (291)**

## Package

| Item | Path / value |
|------|----------------|
| version | **0.1.283** / **291** |
| APK | `mobile/artifacts/ruletka-0.1.283-vc291.apk` → `ruletka-android-latest.apk` |
| Web | hard-refresh live → **`webrtc.js?v=285`** |
| AAB | build with `./scripts/build-aab-local.sh` (no auto-upload) |

## Why this build

- **Same-LAN both cams** — hub `force_relay` → pure `iceTransportPolicy=relay` (not hybrid host-hang)
- **No dual-offer** — Android hub-answerer never promotes@~9s
- **Blur veil** — RTCView stays at **zOrder 0** under opaque mosaic (not pure black unmount hole)
- **CONNECTIVITY_LOCK** — still **no** blanket web↔android force_relay; hide_ip pure only for privacy
- Regression: `./scripts/test-connectivity-lock.sh`

## Smoke (before Console)

```bash
adb install -r mobile/artifacts/ruletka-0.1.283-vc291.apk
# hard-refresh https://ruletka.vip/live.html  (webrtc.js?v=285)
# Hide IP off · Start once · no Next spam 15s
# Pass: both cams ≥ 30s
# Eye / privacy: frosted mosaic (not pure black) · Show video restores face
# Same Wi‑Fi: hub force_relay=true · 1 web offer + 1 android answer · peer_usage rising
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
