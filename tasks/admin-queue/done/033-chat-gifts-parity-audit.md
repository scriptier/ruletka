# Task: P2 — Chat + typing + gifts parity audit (Play vs browser)

**Priority:** NICE — after **001b** (if still open, skip this) and **023**. Safe non-connect.

## Goal
Confirm chat, typing indicator, and gift effects work on Play same as web. Fix **only real gaps** (missing effect, wrong cost, typing not sent). No economy redesign.

## Context
- Source: roadmap X4 + `docs/PARITY_MATRIX.md` gift/chat rows
- Prefer audit-first: list event names web emits vs mobile handles
- **Caution:** modular `mobile/app/live.tsx` + many `mobile/src/live/*` / stars modules may be **untracked WIP on main** — if mobile gift path doesn’t typecheck, **audit + document** is enough; do not land the whole modular tree in this ticket

## Scope (only these)
- `mobile/src/stars/gifts.ts`, `mobile/src/stars/GiftFxOverlay.tsx` (if present)
- `mobile/app/live.tsx` / live chat-gift surfaces — chat/typing/gift send-receive only
- Web reference: gift list / chat handlers in `ui/live.js` (grep only — no big rewrite)
- `docs/PARITY_MATRIX.md` — update rows after audit

## Done criteria
- [ ] Table in RESULT: feature × web × android × status (works / gap / N/A)
- [ ] Fix only **clear** gaps with **file:line**; else document “no gaps” or “blocked by untracked modular live”
- [ ] No solo-match offer / ICE / MediaSession connect path edits
- [ ] Connect risk = low
- [ ] No deploy / no push
- [ ] RESULT contains **`COMPLETE`**

## Completion promise
Put **`COMPLETE`** in RESULT when audit finished and gaps fixed or documented with evidence.

## Do not
- New gift economy / pricing redesign
- WebRTC / match path changes
- Bulk-commit entire untracked modular live tree (human/Grok hygiene)
- Deploy / push / merge main
