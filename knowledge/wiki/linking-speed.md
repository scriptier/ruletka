# Linking speed (match → offer / answer)

Spec: [`../specs/current-linking-speed.md`](../specs/current-linking-speed.md)

## Residual (pre-ship journal, 2026-08-10)

| Metric | Pure web→android (force_relay) |
|--------|--------------------------------|
| max mto | **1749** |
| max mta | **4097** (SLOW) |

Hub idle when no human smoke. **No GOAL_MET** from journal alone — need UI deploy + APK + `av-verify product.ok`.

## Hops on disk (unverified until smoke)

| Hop | Side | Change | Ship |
|-----|------|--------|------|
| 3 | web offer | pure budget 850; warm first-pass 500; pure cold second 500 flat | UI deploy pending |
| 3c | web answer | same schedule as offer | UI deploy pending |
| 3 | android answer | relay wait min 450; post-setLocal bind fire-and-forget | APK ≥0.1.304 |
| 4 | android inbound | pure offer SDP → force_relay; **skip 800ms poll** | APK ≥0.1.308 / **0.1.309** |

## Belts (MUST NOT)

- pool>0 · wipe force_relay sticky · dual-offer thrash · pure-promote warm PC without belts
- More pure-wait cuts while MAX implementer hops reached without product.ok
- Do **not** invent mto/mta numbers — only cite journal / scorecard after real smoke

## Gameplan (2026-08-11 session — no pure-wait thrash)

| Prefer | Avoid |
|--------|--------|
| **PC paint-first** / frames-gated media-OK when “PC feels slow” (chrome/paint lag ≠ more force_relay) | Cutting pure-wait budgets without `product.ok` after UI deploy + APK |
| Weak / existing belts already in ship path (`live.js` ~`?v=550`+) | New ICE thrash or dual-offer “speed” hacks |
| Ship pending hops **3 / 3c / 6–8** (hard-refresh) then measure | GOAL_MET from journal residual alone |

Skill note: `av-fix-loop` § Linking speed. Spec gate: `../specs/current-linking-speed.md`.

## Related

- [force-relay-same-lan](force-relay-same-lan.md) · [gotchas](gotchas.md) · [connect-scorecard](connect-scorecard.md)

### Log

- 2026-08-11 walk-loop: page created from hop residual (smoke pending).
- 2026-08-11 session: paint-first + weak-belt gameplan filed (`live.js?v=550`+); **no pure-wait cuts** without product.ok; residual mto/mta unchanged until smoke.
