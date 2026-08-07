# Task: P1 — Friend call ring / miss UI parity on Play

**Priority:** SHOULD after 021 (was 032; renumbered for filename order).

## Goal
Play friend-call: ringtone, accept → live video, missed-call path as clear as browser. Fix obvious UX gaps only (copy, auto-navigate to Live, miss card).

## Scope (only these)
- `mobile/app/friends.tsx`, `mobile/app/live.tsx`, `mobile/app/index.tsx`
- `mobile/src/push/*` only if ring path is broken
- Docs note if a web-only gap remains

## Done criteria
- [ ] List gaps found + fixes (or follow-up tickets)
- [ ] RESULT: connect risk (friend-call path only; do not change solo match offer logic)
- [ ] No deploy / no push

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria met.

## Do not
- Full FCM redesign
- Solo-match WebRTC rewrite
- Deploy / push / merge main
