# RESULT: 010-parity-followups

## Status
DONE

## Completion promise
COMPLETE

## What changed
Expanded `docs/PARITY_MATRIX.md` top gaps (+ roadmap connect P0) into three pending tickets for overnight/Claude:

| Ticket | Gap | Priority |
|--------|-----|----------|
| `020-cam-mute-parity.md` | Cam mute means different things web vs Android | P2 matrix |
| `021-web-friend-call-notify.md` | Web friend-call notify when tab unfocused | P1 matrix |
| `022-match-offer-budget.md` | match_to_offer budget + hub asserts | P0 roadmap C1/C5 |

Note: matrix has only one true P1; tickets prioritize **Play↔browser compatibility** (not branding).

## Files
- `tasks/admin-queue/pending/020-cam-mute-parity.md`
- `tasks/admin-queue/pending/021-web-friend-call-notify.md`
- `tasks/admin-queue/pending/022-match-offer-budget.md` (also completed in same session — see 022 RESULT)

## Verify ran
- Manual review of PARITY_MATRIX top gaps
- No connect-path code edits

## Connect risk
safe to merge after smoke — docs/tasks only

## Handoff for morning
- Overnight can pick 020/021
- 022 implemented by Grok in same batch (hub-match-speed + DEVICE_SMOKE)
- Do not: deploy without Play↔PC check
