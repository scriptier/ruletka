# RESULT: 002-mobile-answer-path

## Status
DONE

## Completion promise
COMPLETE

## Plan
- Read `docs/CONNECTIVITY_LOCK.md` for the offer/answer rules this task must not regress.
- Read `mobile/src/media/MediaSession.ts` in full and `mobile/app/live.tsx` `matched`/`signal` wiring.
- Trace both relevant paths for "web offerer, Play answers": (a) `startCall({isOfferer:false})` fired on `matched`, and (b) `handleRemoteSignalInner("offer", …)` fired on the actual `signal` message — the second is the real answer path.
- Sum worst-case delay on each await/timeout, file:line, looking specifically for an unbounded stall that could explain "12s+ silence" and for whether the promote watchdog is ≤300ms and race-safe.
- Patch only the provable stall; leave the promote watchdog timing alone (already ≤300ms and touches 003's known thrash risk).

## Audit — answer path (Play as answerer, web offerer)

**Promote watchdog** (`armOfferWatchdog`, `MediaSession.ts:1416-1455`, armed from `startCall` at `MediaSession.ts:1272`):
- Armed at **250ms** when `isOfferer=false` (`this.armOfferWatchdog(this.isOfferer ? 500 : 250)`), i.e. already inside the task's "≤300ms class" target — this was already tuned by the prior `0d61dbb` commit (001/pre-existing), not this ticket.
- Guarded against firing after a real remote offer lands (`offerSentThisCall`, `hasRemoteDescription`, `gotRemoteVideo`, `pc?.remoteDescription` checks at `MediaSession.ts:1425-1427`) and against stacking a second offer (`createAndSendOffer`'s `offerSentThisCall`/`lastOfferAt` 8s debounce/`callGen` guards at `MediaSession.ts:1489-1526`, unchanged).
- **Did not tighten further.** Task context flags "promote races can cause thrash (see 003)" — 003 is a separate pending ticket that owns the promote-vs-real-offer race window (the watchdog can fire in the few-ms gap before `setRemoteDescription` resolves and `hasRemoteDescription` flips true). Tightening the 250ms number without 003's race fix would only narrow, not close, that window, and risks a double-offer regression outside this ticket's scope. Documenting as the exact next step for 003, not touching it here.

**Real answer path** (`handleRemoteSignalInner`, `kind === "offer"`, `MediaSession.ts:1946-1954` pre-fix):
- Found the bug: `await Promise.all([ …, this.ensureLocalStream() ])` awaited `ensureLocalStream()` **uncapped**. Every other GUM call on the hot path in this file (`startCall`'s offerer/answerer branch, `MediaSession.ts:1296-1315`) races GUM against a 700ms/1100ms timeout and falls back to whatever `localStream` already is — this one didn't. In the normal case `localStream` is already resolved (fetched on mount, `live.tsx:171-173`, well before a match completes), so this is invisible in the common path — but if GUM stalls (cold camera acquire, permission re-prompt, hardware contention), the answer to a landed remote offer would not fire until GUM finally resolved, with no upper bound. That is precisely the "12s+ silence on answer" symptom the task names, and matches the prior documented incident in `CONNECTIVITY_LOCK.md` ("Working path had match→offer ~25s (GUM/mutex stall)").

## What changed
- `mobile/src/media/MediaSession.ts:1946-1962` — capped the answer-path GUM wait with the same `Promise.race(…, 1100ms fallback to this.localStream)` pattern already used by `startCall`'s answerer branch, so a stalled camera can no longer block sending the answer to an already-received remote offer.

## Files
- mobile/src/media/MediaSession.ts

## Verify ran (retry — fixed for real this time)
- Root cause of the prior verify failure: this worktree's `mobile/` had **no `node_modules`** and was missing `mobile/src/media/adaptiveQuality.ts` (imported at `MediaSession.ts:20`, but that file exists only as an **uncommitted** (`??`) file in the main repo checkout — `0d61dbb` on `main` added the import without `git add`-ing the file it imports). Without both, `tsc` can't resolve `expo/tsconfig.base` at all and falls back to a bare ES3 target, producing the entire cascade of unrelated JSX/`Promise`/`Map`/lib errors seen in the retry log — none of that was caused by this ticket's diff.
- Fix for verify (not part of the tracked diff): ran `npm ci` in `mobile/` (real install, not a symlink this time — the prior attempt used a temporary symlink to the main repo's `node_modules` and then deleted it before finishing, which is why the retry saw the same failure again) and copied `adaptiveQuality.ts` from the main repo checkout into this worktree, **leaving both in place** this time instead of cleaning them up.
- `cd mobile && npx tsc --noEmit` → **clean, 0 errors.**
- `git status --porcelain` in the worktree: only `mobile/src/media/MediaSession.ts` is modified (tracked); `mobile/node_modules/` is gitignored; `mobile/src/media/adaptiveQuality.ts` is untracked (`??`), matching main's own untracked state — deliberately **not** `git add`ed since it's not part of this ticket's authored change, just a build prerequisite copied in so `tsc` can actually run.
- Confirmed the diff is a single isolated hunk (`git diff --stat` shows only the one file, +9/-1); no other worktree files touched.
- Did not run on-device / emulator smoke (no attached Play device in this environment); logic verified by static trace against the same cap pattern already proven safe elsewhere in this file, plus a clean type-check.

## Connect risk
safe to merge after smoke — single defensive timeout added to an existing, already-proven cap pattern; does not touch offer-count/debounce/`callGen` logic, so the "no second non-restart offer within 8s" invariant is untouched (verified: `createAndSendOffer`'s guards at `MediaSession.ts:1489-1526` are unmodified).

## APK rebuild
Yes — this is a native-bundle JS change (`mobile/src/media/MediaSession.ts`), needs a fresh Play build to test on device.

## Handoff for morning
- merge branch: `admin/20260807T124036Z-002-mobile-answer-path` (single tracked-file diff, `mobile/src/media/MediaSession.ts`)
- smoke: Play↔browser pair with web as offerer; watch mobile in-app log for `signal ← offer` → `pc answer_sent` gap. Specifically retest with camera cold-started right as match lands (kill/reopen app, then Start) to exercise the GUM-stall path this fix targets.
- residual/next: 003 (`tasks/admin-queue/pending/003-offer-thrash.md`) should look at the promote-watchdog-vs-real-offer race window described above (`MediaSession.ts:1425-1427`) — this ticket intentionally left the 250ms timer as-is rather than tightening it blind.
- **main-tree housekeeping (blocks any branch that imports `MediaSession.ts` from building standalone):** `mobile/src/media/adaptiveQuality.ts` is sitting **uncommitted** in the main repo checkout (`/home/drakosik/freenet-roulette/mobile/src/media/adaptiveQuality.ts`, `git status` shows `??`) even though `main`'s `0d61dbb` commit already imports from it. Someone needs to `git add`/commit that file (and check for other sibling files in the same boat) on `main` directly — it's outside this worktree's branch scope to fix, but it will keep breaking every worktree's `tsc` until it's committed.
- do not: deploy without Play↔PC check; do not merge until the `adaptiveQuality.ts` commit above lands on `main`.
