# AUTO: slow match→offer (max 72466ms)

## Goal
Target match_to_offer_ms < 2000 (see docs/CONNECTIVITY_LOCK.md).

## Scope
- Browser kickSolo / startPreview
- Mobile startCall fast path
- Hub web-vs-android offerer

## Done criteria
- Latency budget + small safe fix or checklist
- Do **not** deploy
