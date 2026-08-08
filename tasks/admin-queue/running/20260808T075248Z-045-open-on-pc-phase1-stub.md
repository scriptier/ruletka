# Task: Open-on-PC phase 1 UI stub (unwired)

## Goal
Implement an **optional** Settings entry + modal/sheet that shows:
- QR or large link to `https://ruletka.vip` (hub from config if available)
- User friend code + Copy
**Do not** mint hub tickets or touch match/queue.

## Context
- Design: `docs/OPEN_ON_PC_QR.md` phases 0–1
- Phase 2 claim tickets are **out of scope** tonight

## Scope (only these)
- New component e.g. `mobile/src/pc/OpenOnPcSheet.tsx` (or similar)
- Wire entry from `mobile/app/settings.tsx` only
- i18n en + ru for labels
- Optional: reuse existing QR helper if already in mobile deps; if no QR lib, show copyable URL + code only (no new heavy dependency without need)

## Done criteria
- [ ] Settings row opens sheet/modal
- [ ] Shows hub URL + friend code + copy actions
- [ ] **Not** called from Start / match / offer path
- [ ] RESULT + **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done criteria met.

## Do not
- Hub protocol `pc_claim*`
- WebRTC / spin / match changes
- Deploy / push
