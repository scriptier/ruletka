# T3 pair-smoke FAIL wiki note — RESULT

**Status:** COMPLETE  
**When:** 2026-08-12  
**OWN:** knowledge/wiki residual only (no code, no deploy, no re-smoke)

## Goal
File local pair-smoke wire **0/0** + force_relay rebuild thrash as **harness residual** — do **not** invent product/phone GOAL_MET fail.

## Filed

| Artifact | Action |
|----------|--------|
| `knowledge/wiki/log.md` | One append-only line (see below) |
| `knowledge/wiki/gotchas.md` | Short §24 gotcha (local pair-smoke TURN=off thrash) — not a dup of same-LAN pure latch |
| T2 residual | `tasks/grok-loop/done/T2-pc-pair-smoke-rematch-RESULT.md` |

## Evidence cited

- T1 PC pair-smoke: exit **2**, 0 wire offer/answer, rematch never reached  
- Log: `/tmp/t1-pair-smoke.log` — `force_relay no TURN — fail-open all` + `offer no relay — rebuild pure-relay PC`  
- Harness: `scripts/pair-smoke.mjs` env `ROULETTE_TURN: "off"`  
- Phone: device-smoke **MATCHED** (`T1-phone-device-smoke-web-pair-RESULT.md`) — **not** failed by this note

## Explicit non-claims

- Not phone fail  
- Not multi PASS  
- Not product GOAL_MET  
- No deploy  

## COMPLETE

**COMPLETE**
