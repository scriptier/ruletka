# Task: P0 — Mobile answer / promote path (Play as answerer)

**Priority:** MUST after 001 (or in parallel if 001 is web-only).

## Goal
When **web is offerer** and Play answers: answer fires quickly; no 12s+ silence. Promote-to-offerer only if web is **truly** silent (≤300ms class watchdog — tighten only if safe and does not cause double-offer).

## Context
- Web preferred offerer vs Android (`matched.is_offerer`)
- Hub still shows occasional second offers + drops — promote races can cause thrash (see 003)
- CONNECTIVITY_LOCK: one offer per match; `callGen` invalidates in-flight work

## Scope (only these)
- `mobile/src/media/MediaSession.ts` — answer path, promote/watchdog, offerSent
- `mobile/app/live.tsx` — match → startCall / answer wiring only
- Cross-check `docs/CONNECTIVITY_LOCK.md` + `docs/MOBILE.md` if needed

## Done criteria
- [ ] Audit findings with **file:line** (answer path + promote timer)
- [ ] Minimal fix if clear bug; else RESULT with exact next step
- [ ] Explicit: does not send second non-restart offer within 8s
- [ ] RESULT: connect risk, APK rebuild yes/no
- [ ] No deploy / no push

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria met (fix **or** audit-only with proven “already correct” evidence).

## Do not
- Always-on force_relay / iceRestart spam
- Deploy / push / merge main
