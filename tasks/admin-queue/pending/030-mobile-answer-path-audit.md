# Task: Mobile answer-path / offer-promote audit (Play side)

## Goal
Reduce slow Play↔PC connect when phone is answerer. Audit `MediaSession` + `live.tsx` for: delayed startCall, promote-to-offerer if web silent ≤300ms path, GUM before match. Propose **minimal** fix or document exact bottleneck with file:line. Target match_to_offer_ms < 2000 when web offers.

## Context
- Roadmap C3; hub saw ~27s MTO via timestamp delta
- Respect docs/CONNECTIVITY_LOCK.md
- Prefer measurement + tiny safe fix over rewrite

## Scope
- `mobile/src/media/MediaSession.ts`
- `mobile/app/live.tsx`
- Optional: `docs/CONNECTIVITY_LOCK.md` note only

## Done criteria
- [ ] Root cause written in RESULT (file:line)
- [ ] Minimal fix OR explicit "needs human" with plan
- [ ] No deploy / no push
- [ ] COMPLETE if fix landed and verify notes

## Do not
- force_relay always-on, docker coturn, double-offer
