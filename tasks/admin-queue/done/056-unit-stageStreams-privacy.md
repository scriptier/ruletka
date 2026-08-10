# Task: Unit tests for stage privacy stream picking

## Goal
Extend pure unit tests so privacy-related stage layout stays covered (partner stream present vs null, swapViews) without RN.

## Context
- Existing: `mobile/src/live/stageStreams.test.mjs` (duplicates pure pick logic)
- Production: `mobile/src/live/stageStreams.ts` + LiveStageVideo unmounts partner RTCView when blurred (not in pure pick — still test swap/main/pip matrix)
- Pattern: pure functions inlined in `*.test.mjs` under `mobile/src/live/`

## Scope (only these)
- `mobile/src/live/stageStreams.test.mjs` and/or new `mobile/src/live/privacyStage.test.mjs`
- Optionally mirror cases against real `stageStreams.ts` logic by keeping the test copy in sync (document in comment)

## Done criteria
- [ ] Tests cover: matched+remote, matched+no remote, swapViews main/pip, multiRemote flag
- [ ] `node mobile/src/live/stageStreams.test.mjs` passes
- [ ] `./scripts/dev-smoke.sh --unit` still passes from repo root
- [ ] No app runtime code changes required (tests only preferred)
- [ ] RESULT + **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done.

## Do not
- Change MediaSession / live.tsx / WebRTC
- Deploy / APK
