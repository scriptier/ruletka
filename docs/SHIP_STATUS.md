# Ship status — 0.1.280 (288)

**Updated:** 2026-08-10 · **Prod:** healthy · **Git:** `main` on origin

## Gate results

| Gate | Status |
|------|--------|
| `./scripts/test-connectivity-lock.sh` | Pass (7 cargo + 7 mobile units) |
| Hub `/health` | `ok` · TURN on |
| Live assets | `live.js?v=520` · `live-stage.css?v=373` · brand/web-push 200 |
| `play-status.sh` | 19 OK · 1 WARN (no auto-submit JSON) |
| AAB / APK | `mobile/artifacts/ruletka-0.1.280-vc288.{aab,apk}` |

## What’s in this build

- Play↔PC video: no blanket web↔android `force_relay` (CONNECTIVITY_LOCK)
- Hub `partner_geo` (late IP lookup) · soft “looking up location…” on Android
- Behind bars: PC paints jail on **self** tile ~15s (not toast-only)
- Post-call: Start returns (clears stuck `has-remote-feed`)
- Mute badge only · blur veil default off · hybrid ICE

## Human-only remaining

1. **Play Console → Internal testing**  
   Upload: `mobile/artifacts/ruletka-0.1.280-vc288.aab`  
   Notes: `cd mobile && ./scripts/play-status.sh --notes`
2. **Device smoke** (one real phone + PC)  
   ```bash
   adb install -r mobile/artifacts/ruletka-0.1.280-vc288.apk
   # hard-refresh https://ruletka.vip/live.html
   # match ≥30s both cams · Stop → Start · optional 🔒 bars on PC self-cam
   ```

## Agent stop line

No further product code required for this ship slice. Next “proceed” without a new bug report = maintenance only (docs, ignore noise, optional Play notes paste).
