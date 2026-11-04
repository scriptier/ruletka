# Import real connectUi in unit tests (herd lane tests)

Herd run: `20260814T020528Z` lane **tests**. Grok is director; you are the only writer on these test files.

## Goal
Stop mirroring `connectUi.ts` in unit tests. Import the **real** module (transpile on the fly like `mobile/scripts/test-geo-localize.mjs`). Lock auto-retry: **no soft@10s**; real schedule is soft ≥16s / hard ≥26s / tip ≥36s.

## OWN
- `mobile/src/media/connectUi.test.mjs`
- `mobile/scripts/test-connect-ui.mjs`
- `mobile/src/media/mediasessionMultiSafety.test.mjs` (optional: assert `attachLocalTracksFireAndForget` absent)

## Must not
- Edit `MediaSession.ts` or `connectUi.ts` behavior
- Deploy, APK, pool>0, ICE/SDP
- Dual-write files Grok lanes own (`LiveStageVideo.tsx`, `friends.tsx`, `connectRetry.ts`, etc.)

## Done
- Both tests import/transpile real `connectUi` (no stale 10s soft copy)
- `node mobile/src/media/connectUi.test.mjs` exit 0
- `node mobile/scripts/test-connect-ui.mjs` exit 0
- RESULT + COMPLETE in `tasks/admin-queue/done/479-connectui-import-real-RESULT.md`
- Fill REPORT on `artifacts/herd/20260814T020528Z/lanes/tests.md` if that path exists in the worktree; otherwise put GOAL_MET in RESULT

## Read
- `mobile/scripts/test-geo-localize.mjs` (transpile pattern)
- `mobile/src/media/connectUi.ts` (`nextAutoRetryAction` lock)
- `knowledge/specs/current-ui-dedupe-connect-cleanup.md`
