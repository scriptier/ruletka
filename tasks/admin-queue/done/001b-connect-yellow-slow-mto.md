# Task: P0 — Residual slow match→offer (hub YELLOW)

**Priority:** **START / FIRST** for Claude. Hub live traffic is **YELLOW_slow** — connect beats all P1/P2 until this is COMPLETE or proven smoke-only.

**Status note (manager 2026-08-07 ~14:40):**  
`scripts/admin-agent/logs/last-hub-metrics.env` → `ADMIN_HUB_VERDICT=YELLOW_slow`, max MTO **24300ms**, matches=8, offers=11, answers=11, drops=6, slow=5.  
Prior `001` was audit-only COMPLETE (no residual client stall found; blamed double-`matched` rematch gap). `003` thrash fix shipped. **Do not re-open 001–004 admin branches.** This ticket is **fresh forensics + one minimal fix if proven**.

**Supersedes:** thin auto ticket `006-auto-slow-offer-2026-08-07.md` (removed this pass).

## Goal
Explain **why live max `match_to_offer_ms` is still ~24s** after connect keepers on `main`, and either:
1. land **one** minimal safe fix that reduces first-offer delay / false MTO, **or**
2. document with evidence that the 24s is measurement/rematch artifact (not a client stall) and hand human a smoke checklist.

Target (CONNECTIVITY_LOCK): match→offer **&lt; 2000ms** warm cam; offer→answer **&lt; 1s**.

## Context (do not undo)
- Lock: `docs/CONNECTIVITY_LOCK.md` — no always-on `force_relay`, no docker coturn, no double-offer thrash revival
- Prior 001 RESULT: client paths already capped ~1s; 20–25s looked like **second solo matched ~12s later**
- Ship/connect keepers already on tip: `0d61dbb`, `7769c32`, `52bcb92`, `85c5017`, `44136c9`, lock baseline APK **0.1.126 / vc134**
- Drops=6 with offers≈answers → likely debounce / rematch, not silent answer path

## Scope (only these — pick the smallest proven path)
- **Read-only hub forensics first** (preferred): `./scripts/hub-match-speed.sh 30` (or 60); journal grep for `match_to_offer_ms`, `solo matched`, `offer dropped`, `platform_a/b` if present
- **If** proven client stall after a *single* `matched` (not rematch gap):
  - Browser: `ui/live.js` (`handleMatched` / `kickSoloWebRtc` only — no bulk live.js rewrite)
  - Browser: `ui/webrtc.js` offer watchdog / early offer path only
  - Mobile: `mobile/src/media/MediaSession.ts` `startCall` / offer arm only
- **If** proven hub MTO accounting bug (timestamp from earliest of two matches):
  - `bridge/src/simple.rs` match→offer timer only — minimal, with file:line in RESULT
- Update `docs/CONNECTIVITY_LOCK.md` speed-notes **only** if you change a budget constant

## Done criteria
- [ ] Fresh hub evidence in RESULT: max MTO, drops, sample lines (or SSH-fail note)
- [ ] Root-cause class stated: **true first-offer stall** vs **rematch/thrash MTO** vs **hub accounting** vs **stale client build**
- [ ] Either one minimal patch with file:line **or** explicit “no code change — smoke handoff” with why
- [ ] Explicit: did **not** re-enable force_relay / docker coturn / multi-offer spam
- [ ] Connect risk rating in RESULT
- [ ] No deploy / no push / no merge main
- [ ] RESULT contains **`COMPLETE`**

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria are met (audit-only is OK if evidence shows no residual client stall).

## Do not
- Re-open empty/superseded admin branches 001–004 as merge candidates
- Always-on `force_relay`, docker coturn, peer allowlist, SFU default
- Bulk rewrite `ui/live.js` or MediaSession
- Prefer Direct / ICE policy (that is blocked `034`)
- Deploy / push / merge main / bulk APK upload
