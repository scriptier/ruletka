# Second critic (read-only): Android ↔ browser 3-way parity

## Goal
Read-only review of disk vs `knowledge/specs/2026-08-14-android-browser-parity.md`. No MULTI_PASS.

## OWN
- RESULT only under `tasks/admin-queue/done/`

## Check
1. LiveStageVideo: 2 remotes = column top/bottom + PiP you; hunt wraps 1v1 VideoView
2. live.tsx: startCall2/3 on 2nd/3rd peer; no partnerCamHidden on audio-first
3. Stop/Next: live.tsx passes Leave 3rd / Leave call when extras live (or note if still generic)
4. 2×2 only when stream3 + extraPeerCount>=2
5. pool=0 in MediaSession; no force_relay policy edit this hop
6. No MULTI_PASS invent

## Done
- [ ] RESULT with file:line per check
- [ ] COMPLETE
- [ ] No product file edits

## Must not
- Edit mobile/ or ui/
- Deploy, APK, ICE
