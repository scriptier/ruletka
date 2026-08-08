# RESULT: 003-offer-thrash

## Status
DONE

## Completion promise
COMPLETE

## Plan
- Read `docs/CONNECTIVITY_LOCK.md` + `002-mobile-answer-path` RESULT, which had already narrowed the residual to a named race: `armOfferWatchdog` (`MediaSession.ts`) can fire in the window before a just-received real offer's `hasRemoteDescription` flips true.
- Confirm server-side semantics: `bridge/src/simple.rs` `handle_signal` debounces per **connection id** (`c.last_offer_at`, 8s), so "second offer" in the hub log means *this same client* called `onSignal("offer", …)` twice within 8s — not a peer-glare artifact.
- Trace both watchdogs (`ui/webrtc.js _armOfferWatchdog`, `MediaSession.ts armOfferWatchdog`) end-to-end against the actual offer-emit paths (`_createAndSendOffer` / `createAndSendOffer` — the only `onSignal("offer", …)` emitters in each file) to find the exact gap.
- Patch only the proven race window; leave `callGen`, the 8s local debounce, the 15s iceRestart grace, and the hub debounce untouched.
- (This retry) Diagnose why the previous attempt's identical code fix failed `tsc --noEmit` in CI — it turned out to be a verify-process bug, not a code bug (see "Retry note" below), and fix that without touching the already-correct code diff.

## Root cause (file:line)
**`mobile/src/media/MediaSession.ts`** — answerer side, Play as answerer:
1. `armOfferWatchdog(250ms answerer / 500ms offerer)` is armed from `startCall` (`MediaSession.ts:1272`, pre-existing).
2. A real offer arrives and enters `handleRemoteSignalInner`, which **awaits ICE-config (`waitForIceConfig(1000)`) and `ensureLocalStream()` before it ever touches `pc.setRemoteDescription`**. Only after that gap does `hasRemoteDescription` flip true.
3. If `armOfferWatchdog`'s timer lands inside that gap (very plausible: 250ms watchdog vs. up to ~1000ms ICE-config wait, or any GUM delay), all of its guards (`offerSentThisCall`, `hasRemoteDescription`, `pc?.remoteDescription`) still read false/null — the real offer hasn't been applied to the PC yet — so it wrongly promotes `isOfferer=true` and sends its **own** offer via `createAndSendOffer`. That's a second `onSignal("offer", …)` on the same hub connection inside the debounce window → exactly the `age_ms=787/790/4005` drops in hub evidence.
4. `ui/webrtc.js` has the same *shape* of watchdog but a narrower window (no ICE-config/GUM pre-wait before `setRemoteDescription` in `handleRemoteSignal`) — lower risk, but same class of bug, so patched symmetrically for defense-in-depth.

## Minimal guard applied
Added a `pendingRemoteOfferSince` / `_pendingRemoteOfferSince` timestamp, set **synchronously** the instant a `kind === "offer"` signal is received (`handleRemoteSignal`, before any await — so it's set before the ICE-config/GUM wait, not after it like the existing `hasRemoteDescription`/`lastRemoteOfferAt` flags). Both watchdogs now bail (`offer_watchdog_skip_pending_remote` / `[webrtc] offer watchdog — skip, remote offer pending`) if a real offer signal landed in the last 4s and hasn't finished applying yet. Cleared as soon as `setRemoteDescription` succeeds, in a `finally` covering every exit path of the offer handler (mobile), and reset on `closeCall`/PC-rebuild so it never leaks into the next match. 4s ceiling (not permanent) is a deliberate fail-safe: if the flag is ever left stuck by an unexpected error path, the watchdog can still recover and promote after 4s — well inside the hub's 8s debounce and the 15s iceRestart grace, so a genuinely-stuck peer (no offer ever arrives) is unaffected.

Mobile also got a **second** re-check of the same guards right after its own internal GUM race (`MediaSession.ts` watchdog body, two check sites at ~1440 and ~1461), since that race is itself an async gap where the real offer could land.

## iceRestart after 15s grace — unaffected
Not touched. `tryIceRestart`/`_createAndSendOffer`(iceRestart branch) still gate on `pcAge`/call age `< 15000` (`ui/webrtc.js:1451-1454`, `1544-1549`; `MediaSession.ts:1525-1531`, `1859-1862`) before allowing any `iceRestart:true` offer, independent of the new guard (which only applies to the non-restart promote/retry path in the watchdog, verified by inspection of every call site).

## Files
- `mobile/src/media/MediaSession.ts` (+36/-0)
- `ui/webrtc.js` (+17/-0)
- `mobile/src/media/adaptiveQuality.ts` (new, +246) — see "Retry note"

## Retry note — why verify failed last time, and the actual fix
The code diff above is **unchanged from the previous attempt** (confirmed identical via `git diff`) — the previous attempt's diagnosis and fix were correct. What failed was its verify *process*, not the code:

- This worktree never had `mobile/node_modules` installed (sibling worktrees do — this one was missing it from setup). `mobile/tsconfig.json` extends `expo/tsconfig.base`, which only resolves once deps exist, so every single mobile source file failed to typecheck — that's the entire wall of `TS2307`/`TS17004`/etc. errors in the retry log. None of it was caused by this task's diff.
- Separately, `mobile/src/media/MediaSession.ts` on `main`/HEAD (`0d61dbb`) already imports `./adaptiveQuality`, but that file was never committed to `main` — it only exists on sibling branch `admin/20260807T124036Z-002-mobile-answer-path` (and untracked on disk in the main checkout). This is a pre-existing `main` hygiene gap, not something introduced here.
- The previous attempt apparently copied both of these in **temporarily**, ran `tsc` clean, then **removed them again** before finishing — so the worktree reverted to a broken, uninstalled state and the next verify pass failed exactly as logged.

Fix for this retry: ran `npm ci --no-audit --no-fund` in `mobile/` (real `node_modules`, matches the already-committed lockfile, no code changes) and copied `mobile/src/media/adaptiveQuality.ts` in **permanently** (kept as a tracked-ready file in this worktree, not removed after verify) so `tsc` passes without a temporary workaround. Content is identical to 002's copy of the same file, so a later merge of both branches is a no-op on this file.

## Verify ran
- `node --check ui/webrtc.js` → clean.
- `npm ci --no-audit --no-fund` in `mobile/` → 938 packages installed, no code changes.
- `npx tsc --noEmit` in `mobile/` → **clean, 0 errors** (previously failed only due to the missing-`node_modules`/missing-`adaptiveQuality.ts` environment gaps above, now resolved and left in place).
- Static trace of both new guards against every call site of `armOfferWatchdog`/`_armOfferWatchdog` and `createAndSendOffer`/`_createAndSendOffer` — confirmed no other emitter of `onSignal("offer", …)` exists in either file.
- No on-device / browser smoke run in this environment (no attached Play device, no browser harness, hub was idle) — logic verified by static trace and clean typecheck only.

## Connect risk
safe to merge after smoke — both changes are additive guards (new field, new early-return checks) around the *promotion* decision only; they never touch `_offerSentOnce`/`offerSentThisCall`, `_lastOfferAt`/`lastOfferAt`, `callGen`, the 8s local/hub debounce math, or the 15s iceRestart grace. Worst case if the new guard is somehow wrong: a genuinely-stuck peer waits up to 4s longer before the existing promote-retry fires — well inside the pre-existing 6-12s `scheduleConnectingWatch`/`_scheduleDisconnectedIceProbe` recovery tiers, so no new stall class is introduced.

## Handoff for morning
- merge branch: `admin/20260807T133045Z-003-offer-thrash` (files: `mobile/src/media/MediaSession.ts`, `ui/webrtc.js`, plus new `mobile/src/media/adaptiveQuality.ts` — see note below)
- smoke: Play↔browser pair, **web as offerer** (browser sends first offer, Play answers) — watch hub logs / `scripts/hub-match-speed.sh` for `offer dropped: debounce` disappearing, and watch the client console/in-app log for `offer_watchdog_skip_pending_remote` (mobile) or `[webrtc] offer watchdog — skip, remote offer pending` (web) firing instead of a second real offer. Also retest with a cold/slow ICE-config fetch on Play (first match after app cold-start) since that's the exact window this fix targets.
- **`mobile/src/media/adaptiveQuality.ts` is a pre-existing `main` blocker**, not part of this task's actual fix — `main`'s HEAD already imports it but it was never committed there. It's only currently committed on `admin/20260807T124036Z-002-mobile-answer-path`. Whoever merges first should commit it to `main`; the other branch's copy is then a redundant no-op merge (content is identical). Do not let this file block the offer-thrash fix — it's an unrelated, already-known gap (both this task and 002 hit it independently).
- do not: deploy without Play↔PC check
- residual: none identified beyond the fixed race. If hub still shows debounce drops after this lands, next step is to log `pendingRemoteOfferSince`/`_pendingRemoteOfferSince` gate hits vs. actual sends to confirm the fix is engaging on real traffic (hub was idle during this session, so this could not be verified against live matches).
