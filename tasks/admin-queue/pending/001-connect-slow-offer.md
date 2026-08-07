# Task: P0 — Fix slow match→offer (Play↔PC)

## Goal
Hub saw **max match_to_offer ~25s** (timestamp delta). Target **< 2000ms** (ideally <1000ms with warm cam) per `docs/CONNECTIVITY_LOCK.md`.

Find why offer is late and land a **minimal** safe fix.

## Context
- Offers ≈ answers (path works) — speed is the bug
- Web is preferred offerer vs Android
- Do not enable always-on force_relay / docker coturn / double-offer

## Scope (prefer only these)
- `ui/live.js` — `kickSoloWebRtc`, `handleMatched`, startPreview
- `ui/webrtc.js` — connect, offer watchdog, createOffer path
- `mobile/src/media/MediaSession.ts`, `mobile/app/live.tsx` — startCall timing if phone is offerer
- Optional log-only if code fix too risky

## Done criteria
- [ ] Root cause with file:line in RESULT
- [ ] Minimal fix **or** precise handoff if blocked
- [ ] Note how to verify: `./scripts/hub-match-speed.sh 30`
- [ ] No deploy / no push
- [ ] COMPLETE if fix landed

## Do not
- Rewrite whole WebRTC stack
- Touch coturn / production
