# L78 multi-pair find-3rd scaffold — RESULT

**Status:** COMPLETE  
**Outcome:** **SCAFFOLD_DONE** (not MULTI_PASS)  
**Date:** 2026-08-12  
**Mode:** web2 only (phone keyguard locked — no phone adb)

## Command

```bash
cd /home/drakosik/freenet-roulette
MODE=web2 FIND_THIRD=1 BUDGET_MS=30000 CHROME=/usr/bin/chromium node scripts/multi-pair.mjs
```

- Exit code: **0**
- Harness final line: `[multi-pair] SCAFFOLD_DONE (not MULTI_PASS)`

## Config observed

| Key | Value |
|-----|--------|
| chrome | `/usr/bin/chromium` |
| url | `https://ruletka.vip/live.html` |
| mode | `web2` |
| peers | 2 |
| budget_ms | 30000 |
| find_third | 1 |

Harness honesty banner: `exit 0 ≠ multi product PASS; phases are observations only`

## Observed phases (SUMMARY)

```json
{
  "mode": "web2",
  "budget_ms": 30000,
  "find_third_enabled": true,
  "observed": {
    "boot": true,
    "pair_1v1_hint": true,
    "find_third_invite_sent": true,
    "find_third_accept_ui": true,
    "hunt_ui_hint": true,
    "multi_pc_hint": false,
    "third_tile_hint": false
  },
  "honesty": "SCAFFOLD_DONE only — not multi product PASS; human faces still required for GOAL_MET",
  "next": "Human: verify 3-way faces if third_tile/multi_pc observed; else re-run longer BUDGET"
}
```

| Phase | Result |
|-------|--------|
| boot | yes |
| pair_1v1_hint | yes (both MultiA/MultiB iceOk + frames, phase `pair_1v1_hint`) |
| find_third_invite_sent | yes (MultiA → `#btn-find-third` via steps `btn-match-more` → `btn-find-third`) |
| find_third_accept_ui | yes (MultiB via `btn-find-third-yes`) |
| hunt_ui_hint | yes (`stageTrio` + `stageTrioSearching` on both) |
| multi_pc_hint | **no** |
| third_tile_hint | **no** |

## Timeline (command output summary)

1. **~14:07:55** — Chromium launch; MultiA/MultiB load live, fake cam, ICE/TURN warm.
2. **~14:08:02 / 14:08:11** — MultiA then MultiB click `#btn-start-match`.
3. Match: MultiA ↔ MultiB solo; Force Relay; kickSolo; first-relay offer/answer.
4. ICE connected ~3.5–3.7s; first frame ~3.7–3.9s; `av_path` ok=1 by wave_2000.
5. **~14:08:16–19** — Stable `pair_1v1_hint` snapshots (pcCount=1, iceOk, frames).
6. **~14:08:19** — MultiA find-third invite; MultiB accept.
7. Both: “Matched Keep · keep PC” then “find-third — looking for a 3rd”.
8. **~14:08:23+** — `hunt_ui_hint` for remainder of budget; intermittent `error: not matched` (expected with only 2 web peers / no third).
9. **~14:08:45** — Budget end; screenshots:
   - `mobile/artifacts/multi-pair/MultiA-1786543724849.png`
   - `mobile/artifacts/multi-pair/MultiB-1786543725149.png`

## What this does **not** claim

- **Not MULTI_PASS**
- **Not** multi SoftBlur product PASS
- **Not** 3-way faces / third peer media (`multi_pc_hint` and `third_tile_hint` both false)
- web2-only: no third browser/peer was in the pool to complete a real trio

## Files touched

- RESULT only: this file
- Card moved: `tasks/grok-loop/running/L78-multi-pair-find3rd.md` → `tasks/grok-loop/done/`
- No product code edits (`live.js` etc.), no APK, no force-push, no phone adb

## Risks / next

- Scaffold path works through invite + accept + hunt UI on prod web2.
- Completing a real 3rd requires another peer (extra browser or longer budget with live traffic) — out of scope for this card.
- Human still owns any multi SoftBlur / faces GOAL_MET smoke.
