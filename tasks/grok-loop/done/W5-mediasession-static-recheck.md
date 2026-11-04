# W5 MediaSession multi static recheck

## Goal
Confirm secondary path no shared preview stop; pure answer budgets untouched.

## OWN
- RESULT only under tasks/grok-loop/done/ — prefer **read-only** audit of mobile/src/media/MediaSession.ts
- Code edit only if one clear multi regression with proof

## Work
1. Grep secondary clone / stopLocal / setLocalStream.
2. RESULT audit COMPLETE. No APK.

## Must not
ICE thrash, dual MediaSession rewrite, deploy
