# Task: LiveBottomBar accessibility labels polish

## Goal
Audit `mobile/src/live/LiveBottomBar.tsx` for buttons missing `accessibilityLabel` / `accessibilityRole`. Add labels using existing `labels.*` props where possible — no new behavior.

## Scope
- `mobile/src/live/LiveBottomBar.tsx` only
- i18n only if a label string is truly missing (en+ru)

## Done criteria
- [ ] Primary actions have accessibilityLabel
- [ ] RESULT + COMPLETE

## Do not
- Connect / WebRTC / layout redesign
