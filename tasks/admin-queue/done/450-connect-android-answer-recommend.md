# Connect: Android answer path recommendations (read+light edit OK)

## Goal
Ranked improvements for match→answer speed and product one-way residual on Android.
Baseline: artifacts/connect-loop/baseline-av-verify.md — android fin/fout often 0 in window; web HOT.

## OWN
- mobile/src/media/MediaSession.ts (read; small comment-only or test helpers only unless clearly safe)
- mobile/app/live.tsx (read only for startCall/answer kick — no dual thrash with Grok)
- knowledge/specs/current-linking-speed.md (append hop10 recommendations section only)
- tasks/admin-queue/done/450-connect-android-answer-recommend-RESULT.md

## Must not
- deploy, APK, pool>0, wipe force_relay sticky, dual-offer thrash
- rewrite MediaSession ICE policy without scorecard gate
- invent product.ok / GOAL_MET

## Done
RESULT with Top 5 ranked fixes (impact/risk), file:line citations, DONE WHEN for each.
Status: COMPLETE or BLOCKED (session).
