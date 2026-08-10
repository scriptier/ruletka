# Task: P1 — Align cam mute semantics Play ↔ browser

**Priority:** SHOULD after P0 001–004. Safe non-connect polish.

## Goal
Cam “mute” means different things today: web privacy overlay (track often still live) vs Android hard-disables track. Align **behavior or labels** so Play↔browser users share one promise.

## Context
- Source: `docs/PARITY_MATRIX.md` gap (cam mute)
- Prefer copy + one-side behavior fix — not dual architecture rewrite
- Do **not** touch offer/ICE paths

## Scope (only these)
- `ui/live.js` — cam mute / Hide UX labels + tooltip
- `mobile/app/live.tsx` — cam toggle labels / optional overlay parity
- `docs/PARITY_MATRIX.md` — update row after change
- Optional: shared i18n keys (“camera hidden (still streaming)” vs “camera off”)

## Done criteria
- [ ] Same user-visible promise on web and Android
- [ ] No CONNECTIVITY_LOCK regression (no offer path edits)
- [ ] RESULT: Status + files + connect risk = low
- [ ] No production deploy / push

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria are met.

## Do not
- force_relay / offer path changes
- Deploy / push / merge main
