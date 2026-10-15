# RESULT: 452-connect-product-oneway-critic

## Status
DONE

## Diagnosis
**(A) — no Android av_path in window**, explained by a match-vs-snapshot-window race, not a
live media regression.

The baseline capture's *only* web↔android match landed at `04:48:49.326Z` (`solo matched
a=ce9951d9 b=6315d1e3 ... platform_a=web platform_b=android`), first offer sent at
`04:48:50.753Z` (`match_to_offer_ms=1426`), and the av-verify snapshot cut the 10-minute window
at `04:48:52Z` — ~2.1s after the offer, ~2.7s after the match. Android `av_path` beacons fire on
a ~4s interval (confirmed from the 16 sampled web beacons' spacing); there was no way for
android to emit even one beacon in that gap. All 16 sampled `av_path` rows are `platform=web`
from two unrelated, already-connected web↔web pairs (`780723c1`/`5078222c`,
`6701bda7`/`42fa8b78`) whose beacons span `04:48:08`–`04:48:48`, entirely before the android
match started. `product.android_frames_in/out=0`, `app_vc=null`, `bind_v=null`,
`hub_fr_beacon=null` are all *absent-value* defaults, not a measured zero — there is zero
android data in the window to support "matched but frames_out=0" (ruling out B). This isn't
random flakiness either (ruling out pure C) — it's a deterministic, explainable timing race.

Independent corroboration: `450-connect-android-answer-recommend-RESULT.md` reached the same
"android never reported in" reading on this identical baseline, and flagged a plausible
compounding factor — commit `ec89c5b` (2026-08-11 18:05) added an **immediate** `arm_0`
av_path beacon (`MediaSession.ts:3674-3679`) specifically to close this exact gap ("missing
av_path was misread as one-way"), but `docs/CONNECTIVITY_LOCK.md`'s currently-pinned smoked APK
(`0.1.309`/vc317) predates that commit (`git log -- mobile/app.json` shows `ec89c5b` bumped to
`0.1.358`/vc366). If the phone in this capture ran the older pinned build, it would lack the
immediate beacon and rely solely on the ~4s interval timer — worsening the short-window race.
Not independently confirmed (installed build on the physical phone isn't recoverable from repo
state), so flagged as secondary/compounding, not the primary cause.

## NEXT_ROLE
**verify-only**. The generic `next` routing in `baseline-av-verify.json` ("PRODUCT one-way →
client-ice") assumes a held call that stayed one-way; it doesn't fit a capture where the sole
android pairing existed for ~2s before the window closed. Only escalate to `client-ice` if a
re-run with a proper hold (checklist below) still shows android `0/0` **with android av_path
beacons actually present** — that would be a real diagnosis B.

## Human smoke checklist (next av-verify run)
1. PC hard-refresh (`live.js?v=` cache-bust) before connecting.
2. Phone: open app, Start, confirm camera preview live before queueing.
3. Hold the match open **≥20–30s** before ending/re-matching (guarantees several android
   interval beacons even without the `arm_0` immediate-fire fix).
4. Visually confirm both directions live (PC sees phone cam, phone sees PC cam).
5. Run `./scripts/av-verify.sh --min 10` (or `av-loop.sh`) only after that hold.
6. Read `product.status` **and** confirm android frames fields are non-null / at least one
   android `av_path` row was actually parsed before trusting a one-way verdict.
7. Optional: note phone's installed build stamp vs whether it's `≥` the build containing
   `ec89c5b`; flag as confound if older/unknown rather than drawing a product conclusion.

## Files touched
- `knowledge/wiki/one-way-video.md` — appended 2026-08-12 residual-note log entry only
  (RESOLVED/PASS status from 2026-08-10 left untouched). Copied from primary checkout into
  this worktree first, per the precedent in tasks 450/451 (this worktree's `knowledge/` isn't
  tracked in git on `claude/p0-connectivity`; primary checkout's copy is a shared,
  concurrently-edited file — did not touch it directly).
- `knowledge/raw/2026-08-12-connect-loop-oneway-note.md` — new, full timeline/evidence writeup.
- `tasks/admin-queue/done/452-connect-product-oneway-critic-RESULT.md` — this file.
- No code touched (read-only critic task per OWN scope).

## Verify commands run
- Read-only: `Read`/`Grep`/`python3 -c` (JSON parsing) over
  `artifacts/connect-loop/baseline-av-verify.md`/`.json`, `knowledge/wiki/one-way-video.md`,
  `knowledge/wiki/gotchas.md`, `knowledge/wiki/agent-lanes.md`,
  `tasks/admin-queue/done/450-connect-android-answer-recommend-RESULT.md`,
  `tasks/admin-queue/done/451-connect-web-kick-recommend-RESULT.md`,
  `docs/CONNECTIVITY_LOCK.md`, `git log -1 ec89c5b`, `git log -- mobile/app.json`,
  `grep -n "arm_0\|armAvPathBeacons" mobile/src/media/MediaSession.ts`.
- No build/test run — no code changed, task is docs/analysis only.

## Connect risk
**none** — docs/wiki/raw-note + RESULT only, no code changed, no APK, no deploy.

COMPLETE
