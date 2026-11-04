# L0: Find-3rd invite overlay on Android

## Goal
L0 assert Find-3rd Accept/Decline overlay exists and is not toast-only. Human: invite took ~3s to show, accept ~3–4s.

## OWN
- `mobile/scripts/verify-match-ux.mjs` (add one L0 block only)
- optional: `mobile/app/_layout.tsx` **only** if zIndex of findThirdIncoming scrim < 200 — raise to 400 + elevation 40 (already intended). If already 400, **do not** edit _layout.

## Must not
- MediaSession, live.js, webrtc.js, deploy, APK, ICE

## Done
L0 has find_third_incoming / findThirdIncoming / findThirdRespond. RESULT + COMPLETE
