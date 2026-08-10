# Ship status — 0.1.283 (291)

**Updated:** 2026-08-10 · **Prod web:** live · **Git:** `main` @ `999081a`

## Gate results

| Gate | Status |
|------|--------|
| Hub `/health` | `ok` · TURN on |
| Live assets | `webrtc.js?v=285` · pure `force_relay` |
| APK | `mobile/artifacts/ruletka-0.1.283-vc291.apk` |

## Fixes in this build

### 1. Both cams black (PC + Android) — pure force_relay
Same-LAN `force_relay=true` no longer hybrid host-hang. Pure TURN relay +
answerer never dual-offers.

### 2. Android privacy blur black stage
Veil no longer **unmounts** partner RTCView (that left a black hole). Keeps
streams at **zOrder 0** under opaque `PartnerBlurVeil` + full-screen mosaic.

## Human smoke

```bash
adb install -r mobile/artifacts/ruletka-0.1.283-vc291.apk
# hard-refresh https://ruletka.vip/live.html  (webrtc.js?v=285)
# 1) blur OFF → both faces ≥30s
# 2) eye / privacy → frosted mosaic (not pure black) · Show video works
```
