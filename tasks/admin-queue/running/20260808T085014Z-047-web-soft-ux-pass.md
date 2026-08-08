# Task: Web residual soft UX (no connect edits)

## Goal
Quick pass on web live UI for remaining ugly blocking dialogs that should be soft toasts/banners (parity with mobile soft toasts). **Skip** if already clean.

## Context
- Stop confirm already removed on web+phone.
- Do not touch offer / kickSolo / match_to_offer path.

## Scope (only these)
- `ui/live.js` UI-only toast/banner helpers already in file
- `ui/style.css` only if toast needs a class
- Docs note in RESULT if nothing left

## Done criteria
- [ ] Either small soft-UX fixes **or** RESULT says “no residual blocking dialogs” with evidence (grep notes)
- [ ] Zero edits to SDP/offer/ICE/force_relay
- [ ] RESULT + **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done criteria met.

## Do not
- CONNECTIVITY_LOCK violations
- Deploy / push
