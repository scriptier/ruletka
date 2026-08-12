# Second critic: overnight 0.1.332 loc/name/autostart

## Goal
Read-only review of Grok overnight changes; list risks only. **No code edits** unless you find a clear one-line bug.

## OWN
- Read: `mobile/src/live/PartnerIdentityDock.tsx`, `LiveStageVideo.tsx` (stage HUD loc), `mobile/app/live.tsx` autostart effect, `PartnerChrome.tsx`
- Write: `tasks/admin-queue/done/202-claude-second-critic-332-RESULT.md` only

## Check
1. Infinite Looking up removed?
2. Autostart: spin before clear param + 500ms retry without re-spin on matched?
3. SurfaceView / crash risks from dock always-on when matched?
4. Any regression vs displayPartnerStars?

## Must not
- Edit product code unless critical one-liner; no deploy/APK/ICE

## Done
RESULT with PASS/FAIL per check + recommended next hop
