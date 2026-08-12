# RESULT: 101-webrtc-answer-side-zombie-offer-guard

## Status
DONE (code fix, uncommitted) — human-directed, not overnight-queued. Traced
directly from `tasks/admin-queue/done/20260810T083244Z-100-pair-smoke-headless-RESULT.md`
forensics (real prod FAIL, ICE stuck checking→failed, one-shot recovery
offer from side A silently dropped by side B).

## Root cause
`ui/webrtc.js` had two different policies for "is this connection already
negotiated, ignore new offers":

- **Outgoing offer gate** (`_maybeSendOffer`-style function, ~line 2190):
  already frame-aware — computes `hasPaintedRemote` (real `videoWidth`
  frames, not just track presence) and only blocks a restart while there's
  still time left on a grace window; a peer stuck with zero painted frames
  past the grace is allowed to retry.
- **Incoming remote-offer handler** (~line 2822, before this fix): had
  **no time limit and no frame check at all**. Once
  `currentRemoteDescription`/`currentLocalDescription` existed and
  `iceConnectionState` was `checking`/`connected`/`completed` (or
  `connectionState` `connecting`/`connected`), it permanently rejected any
  further incoming offer with `"skip remote offer — already negotiated"`.

This directly violates CONNECTIVITY_LOCK client rule #7 ("Don't treat ICE
checking alone as already live without remote frames") on the *receive*
side, even though the *send* side already respects it.

Effect (matches the 100-pair-smoke-headless FAIL exactly): once a peer's
ICE gets stuck in `checking` and never progresses, that peer is a zombie
— no frames, dead call — but its incoming-offer guard treats "checking"
as proof of an active negotiation and refuses the other side's legitimate
`black_watch` one-shot recovery offer forever. Both sides stay dark until
the match times out. Confirmed in the smoke log: side A rebuilt a
pure-relay PC and re-offered; side B logged
`skip remote offer — already negotiated, ICE checking` and never
recovered; zero frames on either side for the full 45s budget.

Mobile (`mobile/src/media/MediaSession.ts:3558-3567`) does **not** have
this bug — its incoming-offer handler comment explicitly says "Web always
applies remote offers (renego). Only skip exact duplicate while still
processing the first offer" — i.e. it already always accepts renegotiation
offers. So this bug is specific to `ui/webrtc.js`'s answer path, which
matters for (a) browser↔browser matches, and (b) any phone-promoted-to-
offerer recovery where web ends up as the answerer.

## What changed
`ui/webrtc.js` — incoming remote-offer guard (~line 2822): before
unconditionally skipping when `iceConnectionState`/`connectionState` look
"active", now checks whether the remote video element has actually
painted frames (`videoWidth > 8 && readyState >= 2`, mirrors the existing
`hasPaintedRemote` pattern used elsewhere in the file). If not painted and
more than 18s have passed since `_answeredAt`, the guard is bypassed and
the incoming offer is processed normally (falls through to
`setRemoteDescription` + answer). The 18s threshold matches the existing
`iceGrace` values (15000/18000ms) already used by the outgoing-offer gate
in the same file, so it doesn't introduce a new/shorter thrash window —
it only closes the "block forever with no escape" gap.

If the peer already has painted frames, or is still inside the normal
negotiation grace window, behavior is byte-for-byte unchanged — this is
strictly a widening of an existing time-boxed guard, not new restart
logic. No hub, force_relay, coturn, or offerer/answerer role code touched.

## Files
- `ui/webrtc.js` (~30 line diff, one guard block)

## Verify commands run
- `node --check ui/webrtc.js` — syntax OK
- `./scripts/test-connectivity-lock.sh` — full suite green (7 Rust
  connectivity_lock tests, mobile auto-retry schedule lock, 7 mobile
  live/media unit suites)
- Did **not** re-run `scripts/prod-pair-media.mjs` against prod as a
  verification step — prod serves the deployed `webrtc.js` from disk, not
  this working-tree edit, and no deploy was performed (hard-never #1), so
  a prod run would only test the old code. A stray run before I realized
  this returned `matched: false` on both sides (no partner found at all —
  unrelated to this fix, not a video-path failure).

## Connect risk
Low-to-moderate — this is a real behavior change on the answer path of
the primary web WebRTC client, so it touches the #1-priority connect
surface even though it doesn't touch hub/coturn/force_relay policy. It
only activates in the specific dead-end case forensics captured (stuck
≥18s, zero frames) and reuses an existing, already-proven grace constant.
Still needs the mandatory **phone+PC human smoke** per
`docs/CONNECTIVITY_LOCK.md` before merge — I have not done that (no
device access, and smoke/merge/deploy are human/Grok-gated per
CLAUDE.md). Recommend Grok/human also runs a **browser↔browser** two-tab
smoke specifically reproducing a stuck/checking ICE state (e.g. via
`scripts/prod-pair-media.mjs` after deploying to a non-prod target, or
local dev hub) since that's the topology the original forensics captured.

## Not done / open question
This fix addresses a confirmed browser↔browser (and phone-promoted-
offerer) deadlock. It does **not** by itself explain every Android↔PC
"partner doesn't see my video" report from the last 5 days — the
100-pair-smoke-headless RESULT explicitly flags that headless
browser↔browser forensics "is not necessarily representative of ... the
actual #1-priority path" (Play↔PC on separate networks). Recommend the
next diagnostic step be the same kind of instrumented pair test but with
one real Android device + one PC browser (or at minimum two browsers on
different networks/NATs, not same-host loopback), captured with hub
`force_relay`/`video_dir`/ICE-state logs per
`docs/CONNECTIVITY_LOCK.md` "If it breaks" section, to confirm whether
Play↔PC hits this same stuck-checking pattern or a different one.

## COMPLETE
