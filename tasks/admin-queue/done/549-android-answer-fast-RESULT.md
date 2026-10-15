# 549 — Android answer-fast (read-only critic)

**Status:** COMPLETE (map only — no edits made, per OWN)
**Scope:** MediaSession.ts / live.tsx / webrtc.js read for citations only. Zero diffs.

## 1. What can delay createAnswer ~20s after rematch

Ruled **out** as the 20s source (all capped low, cannot alone account for 20s):
- `mobile/src/media/MediaSession.ts:5310-5334` — inbound-offer GUM/ICE-config prep: capped `waitForIceConfig(200)` / `ensureLocalStream` race vs 150ms timeout.
- `mobile/src/media/MediaSession.ts:3382-3394` — `bindAnswerOutbound` cold-cam GUM: capped 150ms.
- `mobile/src/media/MediaSession.ts:3422-3428` — transceiver-empty retry: capped 40ms.
- `mobile/src/media/MediaSession.ts:5577-5579` — `flushPendingIce` runs parallel with `createAnswer()`, not serial.

**Prime suspect — offer dropped at ingress, not delayed in-flight:**
- `mobile/src/media/MediaSession.ts:5179-5193` (`offer_reject_answered`, primary session) and `:5194-5199` (`hasLiveAnsweredIce` variant) — if `this.inAnsweredCall()` (`hasRemoteDescription || answeredAsAnswerer`, line 2084-2086) is still `true` on the **reused primary `MediaSession`** when a fresh rematch offer lands, the new offer is returned/dropped with **zero retry on the Android side**. `resetStuckExtraPc()` (the only escape hatch, `mobile/src/media/MediaSession.ts:2146-2175` → `mobile/src/live/matchContinuity.ts:351-360`) explicitly `return false` unless `opts.secondary` — **it only ever resets media2/3, never the primary session** (`matchContinuity.ts:356`).
- Recovery in that scenario depends entirely on the **web side's** grace timers: `ui/webrtc.js:3339-3345` (`iceGrace = 20000` while `!hasRemote`) and `ui/webrtc.js:3933-3953` (`_stuckIceTimer3`, fires once at exactly `20000`ms, re-offers/restarts only if ICE is `failed|disconnected|closed`). That 20000ms constant is the literal "~20s" in the symptom name.
- Whether the primary session is actually stale at rematch time depends on ordering: both known reset points — user-initiated Next (`mobile/app/live.tsx:5717-5719`, `mediaRef.current?.closeCall({keepLocal:true, sendBye:true})`) and hub-pushed partner-left (`mobile/app/live.tsx:2527-2530`, `media.closeCall({keepLocal:true, sendBye:false})`) — run **synchronously before** the next `hub.next()` / requeue, so in the straight-line case `hasRemoteDescription`/`answeredAsAnswerer` are already `false` before a new offer can arrive. The exposure is a **race**, not a guaranteed hit: if the hub's `matched` (carrying the new offer) is processed by the client before/interleaved with the `status: partner-left` branch that calls `closeCall` (WS message reordering, or a leave-detail string that doesn't match the `leaveDetail` regex at `live.tsx:2460-2463`), the primary session's stale flags survive into the new offer and it's silently rejected.
- Secondary contributor once `setRemoteDescription` *does* succeed: `mobile/src/media/MediaSession.ts:5436-5443` (`offer_skip_inflight`) drops any second offer for the same PC while `signalingState === "have-remote-offer"`. Not itself a 20s stall (nothing serial between setRemote and createAnswer takes that long today), but it means a duplicate/retried offer arriving mid-flight is silently swallowed rather than re-checked after the in-flight one resolves — if the in-flight one ever throws past its try/catch and leaves `hasRemoteDescription=true` with no answer sent, there is no watchdog on the Android side to recover; only the web 20s timer above notices.
- Structural amplifier: `handleRemoteSignal` serializes all signals through `this.signalChain` (`mobile/src/media/MediaSession.ts:5131-5150`). Any earlier-queued signal whose handler hangs blocks every later signal — including a fresh rematch offer — until it resolves. Nothing in the current chain has an uncapped await for the offer path itself (confirmed above), but this is the mechanism that would turn any *future* uncapped await into a full-queue stall, not just a slow single signal.

## 2. Smallest disk hop to apply a new offer immediately after rematch

Two independent one-line-shaped candidates, ranked by blast radius:

- **Smallest, safest:** give the primary session the same non-destructive escape hatch media2/3 already have. In `mobile/src/media/MediaSession.ts:5179-5193`, before returning on `offer_reject_answered`, check the same ICE-derived signal `shouldResetStuckExtraPc` uses (`ice === "new" | "failed" | ""` and `!gotRemoteVideo`) against the **primary** `this.pc`, not just secondary. Concretely: extend `matchContinuity.ts:351-360` with a primary-safe variant (or drop the `if (!opts.secondary) return false` gate and instead gate on "no live frames ever seen on this pc", which `gotRemoteVideo` already encodes) so a primary session that is flagged `answeredAsAnswerer=true` but has no live ICE and never painted a frame can be torn down and re-armed for the new offer instead of permanently rejecting it. This mirrors logic that's already proven safe for media2/3 — smallest possible diff, no new state.
- **Alternative, larger:** close the ordering race directly — make the `matched` handler in `live.tsx` (case `"matched"`, `~2664-2977`) unconditionally call `closeCall({keepLocal:true, sendBye:false})` on the primary session whenever the incoming peer is **not** the one `keepPrimary`/`samePrimary` logic decided to keep (i.e. right at the `keepPrimary=false` branch, `live.tsx:2975-2978`), rather than relying on the earlier `status:partner-left` branch having already run. This removes the ordering dependency entirely but touches the paint/veil sequencing that's already heavily tuned (see the surrounding `firstPaintWon`/`shouldClearRemoteUi` logic at `live.tsx:3963-3999`) — higher regression risk, not recommended as the first move.

Neither was applied — OWN for this task is read-only.

## 3. What stays APK-gated

- Any change to `mobile/src/media/MediaSession.ts` or `mobile/app/live.tsx` (both candidates in §2) is **mobile client code** — per `CLAUDE.md` these are Grok-owned edits, and per `docs/MOBILE_BUILD.md` they only reach a phone after `cd mobile && ./scripts/build-apk-local.sh --bump` + reinstall. No amount of server/hub change makes a `MediaSession.ts` fix live without a new APK.
- `ui/webrtc.js:3339-3345` / `:3933-3953` (the 20000ms web-side grace/watchdog) is **not** APK-gated — it's browser JS, live on next `live.html` hard-refresh per the existing smoke doc (`docs/CONNECTIVITY_LOCK.md` "Smoke" section, `webrtc.js?v=NNN` cache-bust). If the fix instead targeted lowering that 20000ms grace (not recommended without re-proving — it exists specifically to avoid renegotiating mid-check, see `webrtc.js:3324-3338`), it would ship faster than any Android-side fix.
- Hub/server-side same-pair skip (12s, referenced in the task brief) is out of scope for this critic — not reviewed, lives outside `mobile/`/`ui/`.

## Files touched
None (read-only critic).

## Verify commands run
None — no code changed, no task-local verify script was cited in the task body.

## Connect risk
**none** — no edits made.

COMPLETE
