# 540 — Linking speed to ~3s — critic RESULT

## Verdict: PLAN (read-only)

Evidence given: av-verify `2026-08-16T03:30:11Z` product.**ok** max_mto **1805** /
max_mta **2896**; last match web offer **584ms**, android answer **1904ms**,
ice_connected **~3.2s** after match. No new numbers invented below — code trace
against those figures only.

Read against `knowledge/wiki/linking-speed.md` (hop9–hop11 history) and specs
`current-linking-speed.md` / `current-linking-feel.md` (main tree
`/home/drakosik/freenet-roulette`, since this worktree has no `knowledge/specs/`
copy). Wire timings (offer 584ms, answer 1904ms) are already inside or close to
the spec's own stretch targets (`<800` warm offer, `<2500` answer) — the
**~1.8s residual between ice_connected (~3.2s) and the human's felt ~5s is a
feel/chrome gap, not a wire gap**. That reframes the ask: most client-side wire
waits are already trimmed (hop9–11) and locked; the lowest-risk lever left is
UI, not ICE.

## 1. Web path (kickSolo / GUM / first-relay / recvonly leftover)

| Wait | Where | Cost | Necessary? |
|------|-------|------|------------|
| `handleMatched` → `kickSoloWebRtc` dispatch | `ui/live.js:29511` (`handleMatched`) → `:29996` (SPEED kick) → `:31803` (`kickSoloWebRtc`) | sync, event-driven | **Necessary** — already bypasses heavy `joinPeers` |
| GUM (camera open) | `ui/live.js:31909-31940` (`kickSoloWebRtc`, offerer) | async, off critical path | **Necessary but already non-blocking** — hop10 made GUM async/SDP-first; offer does not await it |
| First-relay wait (pure) | `ui/webrtc.js:296-321` (`shouldWaitForFirstRelay`/`relayWaitBudgetMs`, hop11: pure **480**, hybrid **300**), two-pass wait at `:3144-3226` | up to ~480–800ms worst case, **early-exits on first `typ relay`** | **Necessary — LOCKED.** Task says do not cut; matches wiki "hop11 floor, do not cut further without new product.ok" |
| kickSolo connect-budget poll | `ui/live.js:32306-32374` (`Promise.race` vs `pc.connect()`, `setTimeout(poll, 40)`) | ≤40ms, first check only fires after 40ms even if offer already emitted synchronously | **No / minimal** — not on the wire path (offer emits synchronously inside `_createAndSendOffer`), only delays `kickSoloWebRtc._inflight` release. Still open from the 2026-08-12 hop10 recommendation (finding #5), unfixed. Lowest priority, matches task's "lowest product.ok risk" bar but near-zero payoff (≤40ms) |
| First-offer `recvonly` leftover | `knowledge/raw/2026-08-15-407-rematch-works.md` (407) / `2026-08-15-laptop-last-3way-score.md` (413) | N/A | **OPEN, out of scope** — this is a 1v2/3-way first-join residual (stranger offer racing the preview map), not a 1v1 linking-speed item. Confirmed by reading both raw notes; do not conflate with this hop |

## 2. Android path (startCall EARLY / bindAnswer await / answer relay / paint)

| Wait | Where | Cost | Necessary? |
|------|-------|------|------------|
| `startCall EARLY` (answerer fast path) | `mobile/app/live.tsx:2812-2853` | ~0 — fires before geo/UI/warm polls, no pre-`startCall` await | **Necessary, already optimized** — background ICE refresh is fire-and-forget, comment confirms "no pre-startCall awaits" |
| `bindAnswerOutbound` pre-`createAnswer` await | `mobile/src/media/MediaSession.ts:5539` | real serial ms (RN `replaceTrack`) | **Necessary** — comment: "product.ok depends on this await... Do not remove" |
| Answer-path relay wait (pure) | `mobile/src/media/MediaSession.ts:4164-4168` (`relayWaitBudgetMs()` returns **1200**, no cap) applied at `:5640-5665` | up to **1200ms** serial, early-exits on first `typ relay`, but **uncapped** | **Maybe — flag, do not touch this hop.** This is a *different* function from the locked web `relayWaitBudgetMs` in `ui/webrtc.js` (hop11 480/300) — same name, different file, never hop-tightened. The android **offerer** path already caps this to `Math.min(1200, 400)` (`:4306`), but the **answerer** path (the common web→android direction) uses the full uncapped budget. Given the task's "Must not: cut relayWaitBudgetMs" names the exact function this touches, this is called out as an open finding for a dedicated `MediaSession` lane with its own product.ok gate — **not** picked as this hop's recommendation |
| First paint / keyframe request | `ui/webrtc.js:2489-2497` (`oniceconnectionstatechange`) | kicks keyframe at ICE **checking**, not waiting for **connected** — comment: "TURN path often sits in checking 1–3s before first frame" | **Necessary, already optimized**; the 1-3s is TURN RTT (same-LAN → Frankfurt relay), not app code, and out of scope (infra) |

## 3. Feel: Linking chrome after ICE connected

- `dismissLinkingIfMediaLive()` (`ui/live.js:12076-12158`) already dismisses on
  live audio **or** video frames (not gated on `videoWidth` alone), and frame
  detection uses `requestVideoFrameCallback` (`ui/live.js:17924-17937`) —
  event-driven, not polled. **No waste found here** — this already matches
  `current-linking-feel.md`'s DONE WHEN #1.
- Gap found: `handleMatched` (`ui/live.js:29511`) runs ~600 lines of
  peer-management/layout logic before `kick()` is invoked at `:30122`, and
  **no `setStatus`/`setConnStrip` call fires anywhere in that span** (confirmed
  by grep — zero hits between `29511` and `30044`). The first user-visible
  "linking" feedback still only arrives later, driven by
  `onConnectionState`/`hasFrames` (`handleWebrtcConnectionState`,
  `ui/live.js:12335+`). This is the same gap flagged in the 2026-08-12 hop10
  critic (finding #3) and it is **still unfixed** on current disk (`live.js?v=673`).
  It costs 0 wire-ms but leaves the chrome blank/unchanged for however long the
  offer/ICE/answer sequence takes (up to the full ~3.2s to ice_connected) before
  anything on screen communicates "in progress."

## Recommended hop

**Paint "Linking cameras…" synchronously at the top of `handleMatched`
(`ui/live.js:29511`), before the peer-management logic and the async `kick()`
chain — one `setConnStrip("warn", linkingCamerasLabel(), "")` call, reusing the
existing helper already called elsewhere (`ui/live.js:12143-12150`,
`:12718-12719`, `:13054-13055`).**

- Lowest product.ok risk of anything checked: UI-only, no offer/ICE/relay wait
  touched, no `MediaSession`/`webrtc.js` edit — matches the wiki's own note that
  this needs "no `product.ok` gate... since no wire-path code changes."
- Targets the actual residual: wire time (offer 584ms, answer 1904ms,
  ice_connected ~3.2s) is already near/inside spec stretch targets; the
  ~1.8s gap to the human's felt ~5s is much more likely explained by "nothing
  visibly changes on screen" for the first chunk of that window than by
  cuttable wire waits — all the wire waits currently on disk are either already
  event-driven/async (GUM, frame paint, keyframe-at-checking) or explicitly
  locked (hop11 480/300).
- Does not touch the flagged Android answer-path `relayWaitBudgetMs` (1200,
  uncapped) — that stays parked for a dedicated `MediaSession` lane per the
  task's must-not list, since it's the same function name the lock refers to
  even though it's a different value in a different file.

## Files touched
None (read-only review). RESULT only.

## Verify commands run
- `grep -n` sweeps of `ui/webrtc.js` (`shouldWaitForFirstRelay`,
  `relayWaitBudgetMs`, `warmIcePool`, offer wait sequence) in main tree
  `/home/drakosik/freenet-roulette`
- `grep -n` sweeps of `ui/live.js` (`kickSoloWebRtc`, `handleMatched`,
  `dismissLinkingIfMediaLive`, `partnerVideoHasFrames`, connect-budget poll)
- `grep -n` sweeps of `mobile/app/live.tsx` (`startCall EARLY`) and
  `mobile/src/media/MediaSession.ts` (`bindAnswerOutbound`,
  `relayWaitBudgetMs`, `desiredRelayPolicy`, answer-path relay wait)
- Read `knowledge/raw/2026-08-15-407-rematch-works.md` and
  `2026-08-15-laptop-last-3way-score.md` to confirm the "407/413" recvonly
  reference is a 3-way residual, not 1v1
- Confirmed disk pin `live.js?v=673` / `webrtc.js?v=332` in `ui/live.html`

## Connect risk
none — read-only, no product files edited, no numbers invented.

COMPLETE
