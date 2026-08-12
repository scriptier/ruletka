# Overnight device loop (human asleep) 2026-08-11

## Device
- Pixel 9 Pro serial 45141FDAP0004F via USB adb
- APK path: 0.1.331-vc339 → **0.1.332-vc340**

## Live match evidence (0.1.331, stranger match ~1min)
- **PASS:** A/V two-way (TURN relay), Stop/Report/Next, gifts strip, brand ruletka.me, PartnerIdentityDock (short id)
- **FAIL:** Location stuck "Looking up location…" forever (top HUD + dock)
- **FAIL:** Top name "Partner" while dock had hex short-id
- **OK/N/A:** ★0 may be real for stranger; no crash

## Fixes in 0.1.332
- No infinite "Looking up location…" — only show loc when known or hide_ip
- Treat hub placeholder name "Partner" as empty → use short peer id
- Autostart race harden (agent): spin before clear param + 500ms retry
- displayPartnerStars helper wiring

## Automation landed
- mobile/scripts/device-smoke.sh
- scripts/phone-web-pair.mjs

## PC web
- live.js?v=542 chrome autohide already deployed

## Still open for human morning
- Confirm real partner_geo when partner has public IP (may be hub/geo empty not UI)
- Blur/gift mid-match manual taps
- product.ok av-verify after PC↔phone
