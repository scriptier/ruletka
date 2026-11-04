# T5b gotcha24 lint — RESULT

**Status:** COMPLETE  
**When:** 2026-08-12  
**OWN:** `knowledge/wiki/gotchas.md` §24 only (read/lint; fix only if stale)

## Verdict

**§24 still accurate — no edit.**

Phone **MATCHED** ≠ local pair-smoke **FAIL** (harness residual). Gotcha text matches live harness + product thrash path + evidence RESULTs.

## Claims checked (gotcha 24)

| Claim | Status | Evidence |
|-------|--------|----------|
| `scripts/pair-smoke.mjs` hardcodes `ROULETTE_TURN=off` | **true** | `pair-smoke.mjs` L3–4 header + L631 `env: { … ROULETTE_TURN: "off" }` |
| Same-IP / force_relay thrash: `force_relay no TURN — fail-open all` + `offer no relay — rebuild pure-relay PC` | **true** | `ui/webrtc.js` L548, L2865–2867 (`n===0` + `isRelayMediaMode` rebuild) |
| Many `localSdp offer`, **zero** `wsOut` offer/answer | **true** | T1/T2 logs + `T5-pair-smoke-forensics-RESULT.md` counts (wsOut 0) |
| Hub mto/mta null; rematch never reached; T1 EXIT 2 | **true** | `T1-pc-pair-smoke-RESULT.md` exit **2**, m2 not reached; T2 `m2: null` |
| Phone WEB_PAIR can still be **MATCHED** | **true** | `T1-phone-device-smoke-web-pair-RESULT.md` + `T4-phone-device-smoke-recheck-RESULT.md` MATCHED |
| Do not invent product/phone FAIL from harness residual alone | **still correct guidance** | SMOKE-NEXT agent notes; wiki log residual line; T3 pair-smoke-fail-note |

## Cross-wiki consistency

- `knowledge/specs/SMOKE-NEXT.md` — local pair-smoke **FAIL** wire 0/0 separate from phone MATCHED  
- `knowledge/wiki/log.md` — residual line: TURN=off thrash ≠ phone MATCHED  
- `gotchas.md` log line: "gotcha **24** … not phone MATCHED fail"  
- No later RESULT fixed harness TURN (still hardcoded off)

## Edit

**None.** File not stale.

## Explicit non-claims

- No product ICE rewrite  
- No harness TURN fix  
- No re-smoke  
- No invent GOAL_MET / product PASS  

## COMPLETE

**COMPLETE** — lint only; §24 accurate as written.
