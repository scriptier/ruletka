# Android tap-face — second critic (read-only)

## Goal
Read-only review of Android tap-a-face partner actions after herd `20260815T214106Z`. Spec: `knowledge/specs/2026-08-15-android-partner-actions.md`.

## OWN
- write only `tasks/admin-queue/done/535-android-actions-critic-RESULT.md`

## Must not
- edit any product file
- APK, deploy, MediaSession, invent MULTI_PASS / product.ok

## Check
1. 1v1 tap partner (swipe path + non-swipe Pressable) opens more sheet for primary.
2. 3-way tap extra0/extra1 opens sheet for THAT person (name in title). Extra tap must not only toggle focus.
3. Extra sheet hides Find 3rd / debate / browse. Extra report/block calls keep-pair (`finishExtraSafetyKeepPair` / `dropExtraKeepPrimary`) and does **not** call `next()`.
4. `actionSlot` / `actionSlotRef` / `extraPartnerActionTarget` declared and imported — no undeclared identifier that would throw on Report.
5. First VideoView `key="live-first-remote"` stays. No MediaSession / hunt remount.
6. Run: `node mobile/src/live/matchContinuity.test.mjs` and `node mobile/scripts/verify-match-ux.mjs`.

## Done
Verdict SHIP or FIX with file:line evidence. RESULT + COMPLETE.
