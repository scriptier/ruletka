# W4b Android hunt layout static audit

## Goal
Verify (code only) huntingWithPartner keeps partner RTCView mounted; looking pane separate; flex column phone.

## OWN
- write RESULT only under `tasks/grok-loop/done/`
- **read-only** on mobile/app/live.tsx LiveStageVideo liveStyles — **no code edits** unless one-line bug with proof

## Work
1. Trace lookingForThird / huntingWithPartner / multiRemote paths.
2. RESULT: PASS audit or one minimal fix + COMPLETE.
3. No APK.

## Must not
- Dual thrash MediaSession, deploy, ICE
