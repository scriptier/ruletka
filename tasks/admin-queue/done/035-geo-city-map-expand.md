# Task: P2 — Expand geo city map (RU + common cities)

**Priority:** NICE filler — only after **001b COMPLETE** (or smoke-handoff) and preferably after **023**. Zero connect risk. Safe if rate-limited on connect forensics but **do not skip 001b** while hub is YELLOW unless SSH forensics already done this session.

## Goal
Add more city localizations for live partner chrome. Focus high-traffic cities missing RU names (and any EN→RU gaps already partially done: Canada/Calgary).

## Scope (only these)
- `ui/geoLocalize.js`
- `mobile/src/i18n/geoLocalize.ts` (keep parity if both exist)
- Do not touch match / WebRTC

## Done criteria
- [ ] ≥15 new city mappings **or** documented list of additions in RESULT
- [ ] Geo unit smoke still passes:
  - `node mobile/scripts/test-geo-localize.mjs` if present
  - or existing geo test mentioned in repo scripts
- [ ] Canada / Calgary still correct
- [ ] No deploy / no push
- [ ] RESULT contains **`COMPLETE`**

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria met.

## Do not
- Deploy / push / merge main
- Connect-path edits
- MediaSession / offer / ICE
