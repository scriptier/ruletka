# Task: Point Play smoke docs at 0.1.283

## Goal
Update human smoke docs so morning install uses the right APK + webrtc stamp.

## Scope (only these)
- docs/PLAY_TODAY.md
- docs/DEVICE_SMOKE.md (smoke section only if present)
- docs/PLAY_INTERNAL_TEST_CHECKLIST.md version lines if present
- Mention: APK 0.1.283-vc291, webrtc.js?v=285, pure force_relay, blur mosaic not black

## Done criteria
- [ ] Docs reference 0.1.283 and hard-refresh webrtc v285
- [ ] No product code changes
- [ ] COMPLETE, connect risk none

## Do not
- Deploy, change MediaSession/webrtc.js, rewrite whole docs trees
