# Android find-3rd hunt split polish

## Goal
When user is still connected to first conversationalist and hunting for a 3rd, Android shows **top = partner live video · bottom = looking brand + caption** — never full-screen brand search alone.

## Context
- Skill: `.grok/skills/multi-party-stage/SKILL.md`
- Already on main: `huntingWithPartner`, `enterHuntingWithPartner`, `lookingForThird` wrap in LiveStageVideo
- Human smoke: screenshot was full brand only before fix; polish residual UX

## OWN (only)
- `mobile/app/live.tsx`
- `mobile/src/live/LiveStageVideo.tsx`
- `mobile/src/live/liveStyles.ts`

## Done criteria
- [ ] Looking caption visible (trio.slotEmpty / Looking for a 3rd)
- [ ] Partner tile min ~45% height; looking min ~35%; neither collapses
- [ ] remoteStream2 clears hunt cleanly
- [ ] huntingWithPartner cleared on hangup/next/stop audit
- [ ] No MediaSession.ts edits
- [ ] RESULT with Status + files
- [ ] No production deploy
- [ ] COMPLETE word in RESULT

## Must not
- Deploy / push / APK build
- ICE thrash / pool / force_relay flip
- Dual-write webrtc.js / live.js

## Completion promise
When done, put `COMPLETE` under **Completion promise** in RESULT.
