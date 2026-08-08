# Task: P3 — Design-only “Open on PC” QR

**Priority:** **LAST** — only if 001b done, P1 empty (023 done), and P2 (033/035/036) done or deliberately skipped.

## Goal
Design doc (+ optional unwired stub) for phone showing QR/link to open session on PC. **No production protocol change.**

## Scope (only these)
- `docs/` design note (e.g. `docs/OPEN_ON_PC_QR.md`)
- Optional mobile stub **not** wired to match / hub

## Done criteria
- [ ] Design written (flow, room/friend-code options, risks)
- [ ] Explicit non-goals: no hub protocol rewrite overnight; no deploy
- [ ] No deploy / no push
- [ ] RESULT contains **`COMPLETE`**

## Completion promise
Put **`COMPLETE`** in RESULT when design is reviewable.

## Do not
- Implement live QR match protocol
- Touch WebRTC / offer path
- Deploy / push / merge main
