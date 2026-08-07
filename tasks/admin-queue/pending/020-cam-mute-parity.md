# Task: P1 — Align cam mute semantics Play ↔ browser

## Goal
Cam "mute" currently means different things: web shows privacy overlay but keeps the track live (`ui/live.js` toggleCam no-op / Hide overlay); Android disables the track (`mobile/app/live.tsx`). During a **Play↔browser** call this surprises users. Align **behavior or labels** so both sides share the same guarantee.

## Context
- Source: `docs/PARITY_MATRIX.md` gap #2 (P2)
- Do **not** rewrite WebRTC connect path
- Prefer copy + one-side behavior fix, not dual architecture change

## Scope (only these)
- `ui/live.js` (cam mute / Hide UX labels + tooltip)
- `mobile/app/live.tsx` (cam toggle labels / optional overlay parity)
- `docs/PARITY_MATRIX.md` (update row after change)
- Optional: shared i18n keys for "camera hidden (still streaming)" vs "camera off"

## Done criteria
- [ ] Same user-visible promise on web and Android (either both hard-mute track, or both label as hide/overlay)
- [ ] No CONNECTIVITY_LOCK regression
- [ ] RESULT with Status + files + connect risk
- [ ] No production deploy

## Completion promise
Put `COMPLETE` in RESULT when done criteria are met.

## Do not
- Deploy / push / merge main
- force_relay / offer path changes
