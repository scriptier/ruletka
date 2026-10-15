# 547 — Critic: Android answers=0 (read-only)

Status: COMPLETE (read-only investigation)

## Evidence

1. `artifacts/av-verify/20260820T203346Z.json` — verdict **FAIL**, hard_fail=true.
   - `snapshot`: matches=3, offers=2, sig_offers=2, **sig_answers=0**.
   - gate: `"matches>0 offers>0 but answers=0 (phone not answering)"`.
   - `product`: web/android frames_in/out all **0**, `force_relay_hub=true`, `force_relay_android=1`, `android_policy=relay`, `bind_v=0`, `app_vc=464`.
   - TURN is healthy: `coturn_max_rb=641559 peer_hot=61 coturn_alloc_ok=1` — infra PASS, isolate to client.

2. `knowledge/raw/20260820T203320Z-1v1-linking.md` + shots — Android UI stuck on **"Trying relay… 122s" Retry/Rebuild**; PC stuck on **"linking cameras"**. Product FAIL, not a paint/overlay issue (no faces either side after ~2 min).

3. Android's own `av_path` beacons (hub log, `from=8b7b0b8c platform=android`) fire every ~8s for the **entire 20:31:27Z–20:33:41Z window** (`why=interval_8s / wave_12000 / zero_f_2000…zero_f_10000`) and never once change state: **`ice:"new", cs:"new", sig:"stable", offerer:0, bind_v:0`** for all ~15+ samples. This is client-emitted telemetry, so it reflects the phone's real `RTCPeerConnection` state, not a hub artifact.

4. Distinct from gotcha **407** (`knowledge/raw/2026-08-15-407-nolin-1v1.md`): that incident had **signaling OK (7/7)**, android answered with `sendrecv relay=1 bind_v=1`, and only then went `ice checking → failed` (0/0 frames) — a **post-signaling ICE/bind failure**. Tonight's case never gets an SDP answer at all (`sig_answers=0`), and ICE never leaves `new` — this is upstream of 407, not the same bug.

## Layer

**Layer A (SDP / signaling)** — not B (bind) or C (encode). The phone never reaches `setRemoteDescription`/`createAnswer` for this match: `bind_v` (only set post-`replaceTrack`-into-offer, per `MediaSession.ts:5464-5522`) stays 0, and `ice`/`sig` never move off their pre-offer defaults, for the full 2-minute window despite the hub confirming 2 offers were relayed to this android client.

## Code read (MediaSession.ts / live.tsx, no edits)

- `live.tsx:4442-4456` — inbound signal messages first pass through `routeInboundSignalTarget()` (`mobile/src/live/matchContinuity.ts:260`), which can return `"drop"` (silently `break`s, only logs `signal drop {kind} from=… (no slot)`) or misroute to `secondary`/`tertiary` session instead of `primarySess`, before `MediaSession.handleRemoteSignal` is ever called.
- Traced the plain-1v1 case through `routeInboundSignalTarget`: with `extrasCount=0` and empty `listedPeerIds`, it falls through to `return "primary"` — so a *clean* 1v1 should reach `primarySess`. The open question is whether `extrasCount`/`listedPeerIdsRef` actually were 0 on this phone at 20:31Z, or carried a stale multi-party value from a prior Find-3rd/party match (this app version has heavy multi-party churn — gotchas 20–64 in `knowledge/wiki/gotchas.md`) that would misroute this 1v1 offer to a dormant `secondarySess` instead.
- Did not find any other early-return between the WS message arriving and `MediaSession.handleRemoteSignal`'s own `kind === "offer"` handling (`MediaSession.ts:5344` onward) — the only pre-existing branch point is the router above.

## NEXT_ROLE: `android-answer`

Single next hop: pull fresh Android logcat filtered `client-ice|signal ` during a live repro of this same PC↔Android 1v1 (force_relay path), and read for:
- `[client-ice] signal recv kind=offer` — if **absent**, the offer never reached `live.tsx`'s WS handler at all (push this back to hub/transport, not client logic).
- `signal drop offer from=… (no slot)` or `signal2 ← offer` — if **present**, `routeInboundSignalTarget` is misrouting a plain 1v1 offer away from `primarySess` (stale `extrasCount`/`listedPeerIds` from prior multi-party state is the leading suspect); fix is scoped to `matchContinuity.ts` / its call site, not MediaSession/ICE.
- `[client-ice] signal offer applied ok` — if this line **is** present but `bind_v`/`ice` still never move, the break is inside `MediaSession.ts` offer handling itself (setRemote succeeding but createAnswer/send failing silently) — different, narrower fix.

This one logcat capture disambiguates the three hypotheses above without any code change.

## Files touched
None (read-only).

## Verify commands run
None (read-only investigation; no code changed, so no verify gate applies). Evidence pulled via `Read`/`grep` over `artifacts/av-verify/20260820T203346Z.json`, `knowledge/raw/20260820T203320Z-1v1-linking.md`, `knowledge/wiki/gotchas.md` (gotcha 70), `knowledge/wiki/now.md`, `mobile/src/media/MediaSession.ts`, `mobile/app/live.tsx`, `mobile/src/live/matchContinuity.ts`.

## Connect risk
none (no code touched)

COMPLETE
