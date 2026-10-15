# 860 — iOS App Store Connect listing checklist — RESULT

**Status:** COMPLETE (doc only — human still has to click through ASC; nothing submitted)

## Files touched

- `docs/IOS_ASC_CHECKLIST.md` (new) — ordered ASC click-through: App Information → Pricing →
  Prepare for Submission metadata → Age Rating → App Privacy → App Review Information →
  Screenshots → Export Compliance → Submit for Review.

## Notes

- `knowledge/specs/current-ios-app-store.md` cited in the task does not exist in this worktree
  (only `knowledge/specs/2026-08-20-ru-reach.md` is present) — proceeded directly from the task's
  own Goal/OWN/Must-not/Done block and the four `Read` files listed, which were all present and
  current.
- Confirmed `mobile/app.json` version `0.1.477` / iOS `buildNumber "1"` and
  `mobile/eas.json` `ascAppId: "6804910924"` match the task's stated TestFlight 0.1.477 b5 upload
  — checklist references build **0.1.477 (5)** as the one to select in ASC.
- Screenshot sizes (6.7" 1290×2796, 6.5" 1284×2778) pulled from existing
  `mobile/assets/store/ios/SCREENSHOTS.md` rather than re-verified against Apple's current
  published spec, per the task's read-only scope.
- `docs/IOS_APP_PRIVACY.md` references a paste-ready
  `mobile/assets/store/ios/APP-PRIVACY.md` condensed file that does not exist yet — checklist
  points reviewers at `IOS_APP_PRIVACY.md`'s full table instead; flagging for Grok/human in case
  that condensed file was expected to exist already.
- Did not claim App Review was submitted anywhere in the new doc, per task instruction.

## Verify commands run

None — doc-only change, no code/build touched (task Must-not: app code, eas build, deploy,
MediaSession).

## Connect risk

**none** — no touch to hub, ICE, TURN, MediaSession, or app code.

COMPLETE
