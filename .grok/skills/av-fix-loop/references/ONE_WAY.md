# One-way video pattern (PC black, phone sees partner)

See also: `knowledge/wiki/one-way-video.md` · spec: `knowledge/specs/current-av.md`.

## Signature (av_path)

| Side | frames_in | frames_out | Healthy pure path |
|------|-----------|------------|-------------------|
| web | **0** | high | force_relay=true policy=relay |
| android | high | **0** | force_relay=1 hub_fr=1 policy=relay (after sticky fix) |

Plus: answers>0, max_rb HOT, often both relay→relay after pure fixed.

## Role

**client-ice only** (not turn-media while TURN HOT).

## Layered checklist (order matters — 2026-08-10)

### Layer A — pure path / ICE (both pure when hub force_relay)

1. Latch hub `force_relay` **before** startCall (`hubForceRelaySticky` / `forceRelayHubRef`).
2. **`closeCall({ keepLocal: true })` must keep sticky** (do not clear mid-match rebuild).
3. Answer waits for typ relay when pure; belt: re-arm pure if offer SDP is relay-only.
4. Prove: `hub_fr=1 force_relay=1 policy=relay` answer `relay_candidates≥1` pair relay→relay.

### Layer B — bind answerer video

1. `bindAnswerOutbound` by **SDP m-line order** (RN `track.kind` often empty).
2. Answerer: **replaceTrack only** after setRemote — never addTrack before.
3. No mid-nego PC rebuild (`ensureRelayPolicyPc` while answeredAsAnswerer).
4. Prove: `bind_v≥1`.

### Layer C — encoder actually sends (bind ≠ frames)

1. After every video replaceTrack: **`encodings[].active=true`** + bitrate + `generateKeyFrame`.
2. If frames_out=0 for ≥2s: fresh GUM → `replaceTrack(null)` → new track → re-bind → keyframe burst.
3. Prove: `frames_out≥10`, `bytes_out>0`, web `frames_in≥10`. Prefer av_path `enc_active`, `v_readyState=live`.

## After code

1. Bump + build APK · human install · smoke ≥20s.  
2. Expect product.status=ok with app_vc matching ship.

## Regression

Do not flip pure↔hybrid to “speed linking” without scorecard — pure same-IP is required for stable both-way video on this path.
