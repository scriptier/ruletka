# Task: P1 — Friend call ring / miss UI parity on Play

**Priority:** SHOULD after **021** and **021b**. Defer if 021 not COMPLETE.

## Goal
Play friend-call: ringtone, accept → live video, missed-call path as clear as browser. Fix obvious UX gaps only (copy, auto-navigate to Live, miss card).

## Scope (only these)
- `mobile/app/friends.tsx`, `mobile/app/live.tsx`, `mobile/app/index.tsx`
- `mobile/src/push/*` only if ring path is broken (local ring / pending call — not full FCM stack)
- Docs note if a web-only gap remains (`docs/PARITY_MATRIX.md` row)

## Done criteria
- [ ] Short gap table in RESULT: ring / accept / miss × current vs fixed
- [ ] At least one real UX fix **or** documented “already OK” with file:line (no empty COMPLETE)
- [ ] RESULT: connect risk = friend-call only; **no** solo-match offer / ICE edits
- [ ] No deploy / no push

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria met.

## Do not
- Full FCM redesign
- Solo-match WebRTC rewrite / MediaSession offer path
- Deploy / push / merge main
