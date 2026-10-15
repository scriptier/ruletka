# RESULT: 450-connect-android-answer-recommend

## Status
DONE

## Completion promise
COMPLETE

## Plan
- Read baseline (`artifacts/connect-loop/baseline-av-verify.md`), `docs/CONNECTIVITY_LOCK.md`,
  `knowledge/specs/current-linking-speed.md` for prior hop history and hard limits.
- Trace android answer path: `live.tsx` matched→kick→startCall, `MediaSession.ts`
  `handleRemoteSignal`/`handleRemoteSignalInner` (offer ingress), `pcConfig`/
  `desiredRelayPolicy`/`ensureRelayPolicyPc` (force_relay policy), `bindAnswerOutbound`
  (replaceTrack), `forceRelayRebuild` (recovery path), ICE/TURN fetch in `live.tsx`.
- Cross-check each candidate against `git log` on `MediaSession.ts` to avoid re-suggesting
  already-tried/reverted hops (found hop10 already landed 2026-08-11: `ec89c5b`).
- Rank by (impact on match→answer speed or product one-way) × (risk / CONNECTIVITY_LOCK
  exposure), cite file:line, no code edits to MediaSession.ts/live.tsx (read-only per OWN).
- Append findings to `knowledge/specs/current-linking-speed.md` (Hop10 recommendations
  section) and this RESULT.

## Baseline read (context, not re-derived)
`artifacts/connect-loop/baseline-av-verify.md`, 2026-08-12T04:48:52Z, 10-min window:
web fin/fout=62634/62634 (HOT), **android fin/fout=0/0**, and — the more telling detail —
**zero android `av_path` rows at all** in the 16 parsed samples (all 8 shown rows are
`platform=web`). That's "android never reported in," not just "android reported zero
frames." This shapes recommendation #2 below.

## Top 5 ranked recommendations

### 1. No retry on ICE/TURN fetch failure — HIGH impact / LOW risk
**Files:** `mobile/app/live.tsx:1763-1779` (mount-time `loadIce()`), `mobile/app/live.tsx:3277-3287`
(matched-immediate `fetchIceConfig()`).

Both call sites `.catch(e => log(...))` and swallow the error. The only retry mechanism is
`setInterval(loadIce, 30 * 60 * 1000)` (`live.tsx:1779`). If the very first TURN fetch fails
(cold start network blip, hub HTTP hiccup), `MediaSession.ice` stays `null` and `hasTurn()`
(`MediaSession.ts:837-838`) stays `false` for up to 30 minutes. Since the pure-relay decision
(`pcConfig()` `MediaSession.ts:1736-1744`, `desiredRelayPolicy()` `:1840-1845`) is gated on
`hasTurn()`, every force_relay=true match in that window silently fails open to
`iceTransportPolicy=all` while the hub/web side is pure relay — a direct candidate for the
one-way symptom.

**Fix sketch:** short bounded retry with backoff (e.g. 1s/2s/4s, 3 attempts) on fetch failure
at both call sites, keep the 30-min interval as steady-state refresh only.

**DONE WHEN:** simulate one failed `fetchIceConfig()` in dev (offline hub for ~2s at app
launch) and confirm `hasTurn()` recovers within a few seconds instead of waiting for the
30-min interval; no change to force_relay policy logic itself, so no smoke gate required
beyond a normal phone+PC connect check.

### 2. Confirm baseline APK freshness before further one-way chase — HIGH leverage / ~ZERO risk
**Files:** `mobile/src/media/MediaSession.ts:3674-3699` (`armAvPathBeacons`, `arm_0` immediate
beacon), commit `ec89c5b` (2026-08-11 18:05 local / ~00:05Z 08-12).

Commit `ec89c5b` added an immediate `arm_0` av_path beacon specifically because "missing
av_path was misread as one-way" (comment at `:3677-3678`), and also landed the 280ms pure
answer relay cap (`:5391-5395`, itself a revert of a bad 150ms hop10 experiment — "never
reintroduce"). The baseline capture (2026-08-12T04:48:52Z) shows **zero android av_path
beacons** in a 10-minute window with confirmed android↔web matches — the exact hole this
commit was built to close. `docs/CONNECTIVITY_LOCK.md` pins the currently-smoked APK at
`0.1.309`/vc317; whether that build's JS bundle actually includes `ec89c5b` is not
verifiable from this worktree (native rebuild required, outside this task's scope/tools).

**Recommendation:** before spending more engineering time on "android one-way," rebuild/bump
the local APK past `ec89c5b` (Grok, per `docs/MOBILE_BUILD.md`) and re-run `av-verify`. If
android av_path rows appear (even with fin/fout still low), the scorecard-visibility bug is
what baseline caught, not necessarily a live media failure — redirects effort from #3/#4
below to just "ship + re-measure."

**DONE WHEN:** fresh `av-verify` run against an APK built after `ec89c5b` shows ≥1 android
av_path row per matched call; if fin/fout are still 0 with beacons present, that confirms a
real media-path bug and elevates #3/#4.

### 3. Pure-relay policy is `hasTurn()`-gated at build time, never repaired after remote SDP applies — MEDIUM-HIGH impact / MEDIUM risk (needs scorecard gate)
**Files:** `MediaSession.ts:1731-1776` (`pcConfig`), `:1840-1845` (`desiredRelayPolicy`),
`:1787-1834` (`ensureRelayPolicyPc`, `remoteApplied` gate at `:1791-1794`), answer-side
belt check `:5095-5133`.

`desiredRelayPolicy()` requires `hasTurn()` to be true to return "want pure relay" — so
"hub told us force_relay" and "we currently have TURN loaded" are conflated into one signal.
If TURN lands *after* the offer's PC is built (race narrowed by #1/prefetch but not
eliminated — first match of a fresh session races mount-time `loadIce()`), the PC is built
`policy=all`. `ensureRelayPolicyPc`'s `remoteApplied` gate (`:1791-1794`) then permanently
blocks any later rebuild once `setRemoteDescription` succeeds — there is no repair path. This
is exactly the hop9 WARN already documented in the file's own comments (`:1781-1785`,
`:5093-5094`): `fr=1 policy=all` vs web `policy=relay`.

**Fix sketch (do not implement without scorecard gate — this is ICE policy):** decouple "hub
wants pure" (already tracked via `forceRelayOnce`/`hubForceRelaySticky`) from "have TURN
right now." When `setIceConfig` delivers TURN late and hub wanted pure but the live PC ended
up `policy=all` with remote SDP already applied, don't silently accept it — hand off to
recommendation #4 (`forceRelayRebuild`) rather than mutating the live PC mid-negotiation.

**DONE WHEN:** `av-verify` shows the `force_relay mismatch` WARN (fr=1/policy=all vs web
policy=relay) at 0 occurrences over a fresh cold-start phone+PC smoke session, and
`product.ok` still holds (per `docs/CONNECTIVITY_LOCK.md` mandatory gate + `MUST NOT
GOAL_MET without re-smoke product.ok` in this doc).

### 4. `forceRelayRebuild()` is a fully-built but unused recovery path — MEDIUM impact / MEDIUM risk (needs scorecard gate)
**File:** `MediaSession.ts:1957-1979`. `grep` confirms zero call sites anywhere in
`MediaSession.ts` or `live.tsx` — this method only exists at its own definition.

It's documented for exactly the baseline's symptom ("first path never gets media / same-NAT
hairpin / UDP blocked") and already preserves `answeredAsAnswerer`/offer-sent state to avoid
the re-offer thrash `docs/CONNECTIVITY_LOCK.md` forbids (comment `:1965-1966`). Currently a
force_relay=true match that ends up one-way has no automatic recovery — it just sits at
fin/fout=0 until the user hits Next.

**Fix sketch:** wire a single, gated trigger — after answering a hub `force_relay=true`
match, if `gotRemoteVideo` is still false and own outbound frames are still 0 past the
CONNECTIVITY_LOCK ~15s floor (e.g. a 15-20s window, one-shot, never earlier), call
`forceRelayRebuild()` once.

**DONE WHEN:** phone+PC smoke on a deliberately-broken force_relay pairing shows recovery to
live video within ~20s of answer, with hub logs showing **0** additional answerer offer
drops (CONNECTIVITY_LOCK's explicit anti-thrash gate) — required before shipping per "Must
not: rewrite MediaSession ICE policy without scorecard gate."

### 5. `camReady` check in `startCall` doesn't use the RN-safe `trackUsable()` helper — LOW impact / LOW risk
**Files:** `MediaSession.ts:2628-2630` (`camReady`, strict `readyState === "live"`) vs
`:5048-5053` (`camLive`, already uses `trackUsable()`) vs `:3072-3080` (`trackUsable`
definition, explicitly treats RN's empty-string `readyState` as usable — comment: "readyState
may be empty on RN — still bind").

The newer inbound-offer fast path was already fixed to tolerate RN's empty `readyState`; the
older `startCall` camera-ready check (used by both the isOfferer and answerer entry points)
was not updated to match. On devices where RN reports `readyState=""` for a perfectly live
track, `camReady` evaluates `false` and `startCall` takes an avoidable
`ensureLocalStream()`/ICE-wait detour (`:2632-2650`) instead of the zero-await warm path.

**Fix sketch:** replace the inline predicate at `:2628-2630` with
`this.trackUsable(t as never)`, matching `:5050-5052`. Single-line, no policy change, no
CONNECTIVITY_LOCK exposure.

**DONE WHEN:** `tsc --noEmit` clean; journal shows no regression in match_to_answer_ms on a
short phone+PC smoke (this is a latency-neutral-or-better change, not correctness-risk, so a
light smoke is enough — not a full product.ok gate).

## Files
- `knowledge/specs/current-linking-speed.md` (appended "Hop10 recommendations" section only,
  in the task worktree — not yet in `main` or in the separate uncommitted hop9 edit sitting
  in the primary checkout's working tree; merge/reconcile both when this branch lands)
- `tasks/admin-queue/done/450-connect-android-answer-recommend-RESULT.md` (this file, written
  to the shared host path per wrapper instructions)
- No changes to `mobile/src/media/MediaSession.ts` or `mobile/app/live.tsx` (read-only per task OWN scope)

Correction note: an early pass of this task accidentally wrote the Hop10 section into the
primary checkout's live working copy (`/home/drakosik/freenet-roulette/knowledge/specs/...`,
which had unrelated uncommitted hop9 edits from another in-progress session) instead of this
worktree. That was caught and reverted before finishing — the primary checkout's file was
restored to its exact prior (still-dirty, not-mine) state, and the Hop10 section now lives
only in this worktree's copy as intended.

## Verify ran
- Read-only: `grep`/`git log`/file reads only. No build/test run (no code changed).
- Cross-checked recommendations against `git log -- mobile/src/media/MediaSession.ts` to
  confirm none duplicate already-shipped/reverted hops (hop9, hop10 150ms cap revert).

## Connect risk
safe to merge after review — **no code changed**, docs/RESULT only. Items #3 and #4 above
explicitly require a scorecard-gated implementation + phone+PC smoke before any future PR
touches ICE policy; do not implement directly from this RESULT without that gate.

## Handoff for morning
- merge branch: `admin/20260812T063106Z-450-connect-android-answer-recommend` (docs-only diff)
- smoke: none required for this branch itself (no code changed); before acting on #1/#5, a
  light phone+PC connect check suffices; before acting on #3/#4, follow
  `docs/CONNECTIVITY_LOCK.md` mandatory smoke gate
- do not: deploy without Play↔PC check; do not implement #3/#4 without a scorecard gate and
  product.ok re-smoke; check APK build freshness (#2) before trusting the current one-way
  reading
