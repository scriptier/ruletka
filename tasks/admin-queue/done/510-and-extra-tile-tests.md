# Android extra-tile unit lock (3-way split)

## Goal
When extras≥1, stage pickers expose a second remote so LiveStageVideo can split (top/bottom). Cover the 221222Z FAIL: phone stayed 1v1 Laptop-only.

## OWN
- `mobile/src/live/stageStreams.ts`
- `mobile/src/live/stageStreams.test.mjs`
- `mobile/src/live/LiveStageVideo.tsx` (only if a prop default blocks extras≥1 split)
- `mobile/src/live/liveStyles.ts` (split styles only if missing)

## Must not
- MediaSession.ts, live.js, deploy, APK, pool>0, force_relay, live.tsx match handler

## Done
- [ ] extras≥1 ⇒ second remote stream slot / layout flag in tests
- [ ] `node mobile/src/live/stageStreams.test.mjs` passes
- [ ] RESULT + COMPLETE
- [ ] no MULTI_PASS invent
