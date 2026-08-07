# Task: P1 — Play background keep-alive + reconnect banner polish

**Priority:** SHOULD after 020 (was 031; renumbered for filename order).

## Goal
User leaves app ~30s mid-call then returns: media recovers + clear reconnect banner (parity with web “reconnecting”). Audit app-state handling; fix only real gaps.

## Scope (only these)
- `mobile/app/live.tsx` — appState / reconnect UI
- `mobile/src/media/*` — only reconnect / appState paths (no offer rewrite)
- Optional small copy in i18n packs

## Done criteria
- [ ] Audit + fix gap **or** document “already OK” with file:line evidence
- [ ] Banner/copy clear when reconnecting
- [ ] RESULT: connect risk (should be low if scoped)
- [ ] No deploy / no push
- [ ] Note: full device leave-app 30s needs **human smoke** in morning — code path OK overnight

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria met.

## Do not
- Rewrite entire WebRTC stack
- Deploy / push / merge main
