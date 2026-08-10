You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: /home/drakosik/freenet-roulette-claude
Grok will harvest your diffs after you finish.

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

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/056-unit-stageStreams-privacy-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
