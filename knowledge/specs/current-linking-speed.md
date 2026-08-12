# Spec: faster linking (match → first video)

> Layer 1 agentic. Do **not** regress product.ok pure/bind/encode.

```text
GOAL: Reduce time from match to usable two-way A/V without black-cam regression
DONE WHEN:
  - Hub p50 match_to_offer_ms < 800 (warm web offerer; pure same-IP may need relay wait)
  - Hub p50 match_to_answer_ms < 2500 (android answerer)
  - product.status=ok still holds on same-WiFi force_relay=true smoke
  - Human feels "linking" ends faster (no multi-second freeze after match UI)
EVAL:
  - journal: match_to_offer_ms / match_to_answer_ms last N matches
  - av-verify product.ok after speed changes
  - no pool>0, no dual-offer thrash, pure path still hub_fr=1 when hub force_relay
CHECKPOINTS:
  - Any pure-wait budget cut: require before/after product.ok smoke
  - Deploy UI/hub only with human authorize
  - **No GOAL_MET on speed** without `av-verify product.ok` after UI deploy + APK that includes the speed hops
OUT OF SCOPE:
  - SFU, redesign gifts
  - Re-opening force_relay same-IP pure requirement
LANE: client-ice (web kick + android warm) then verify-only
OWN FILES:
  - ui/webrtc.js (offer relay wait / warm)
  - ui/live.js (kickSolo timing)
  - mobile/src/media/MediaSession.ts (answer path serial waits only — careful)
  - mobile/app/live.tsx (early kick)
VERIFY:
  - Baseline: journal mto/mta + av-verify product
  - After: same + product.ok smoke
  - **Gate:** speed GOAL_MET only when `av-verify` reports `product.ok` after UI deploy + APK with those hops (journal mto/mta alone is not enough)
MUST NOT: pool>0; wipe force_relay sticky; disable encodings.active fix
MAX HOPS: 2 implementers per side without new smoke
```

### Baseline (2026-08-10 product.ok window)

| Metric | Observed (pure force_relay=true) | Stretch target |
|--------|----------------------------------|----------------|
| match_to_offer_ms (web) | ~1700–1800 | <800 warm / <1500 pure |
| match_to_answer_ms (android) | ~3800–3900 | <2500 |
| product | ok | ok |

### Status

- **Active** — hops 1–8 on disk. Residual pure path historically mto~1749 / mta~4097; hybrid smoke often mto~600 / mta~1400.
- **Web hop6–8 need UI deploy** for PC browser. **Android hop8** ships in next APK.
- Smoke + **product.ok** after deploy required before GOAL_MET.

### Live residual (2026-08-10, before hop3 ship)

| Metric | Pure web→android |
|--------|------------------|
| max mto | **1749** |
| max mta | **4097** SLOW |
| answer serial (mta−mto) | ~**2350** ms |

Explorer: mto ≈ web offer first-relay on cold pure media PC; mta ≈ double bind + answer relay wait.

### Hop 1–2 (earlier)

| Hop | Change |
|-----|--------|
| 1 | web: pure warm ALLOCATE + kick no dead wait; android: answer min(700) + warm short-circuit |
| 2 | web: pure cold second-pass 500 flat |

### Hop 3 (2026-08-10 agents)

| Side | Change | Expect | Ship |
|------|--------|--------|------|
| web | pure budget **850**; warmOk first-pass cap **500** | mto −100–400ms | code on disk — **UI deploy pending** |
| android | answer relay **450**; **post-setLocal bind fire-and-forget** (keep pre-createAnswer await bind) | mta −200–800ms post-offer | **in APK 0.1.304** |

### Hop 4 (2026-08-10 walk-hop4) — android pure force_relay poll short-circuit

| Side | Change | Expect | Ship |
|------|--------|--------|------|
| android | On inbound offer: **parse pure offer SDP first** → `setForceRelay(true)` and **skip 800ms unlatched poll** (was always after full poll). Hybrid still polls 800ms. | pure mta −0–800ms when offer races matched | **in APK 0.1.308-vc316** |

Left serial (not cut — product.ok risk): pre-createAnswer `await bindAnswerOutbound` (RN replaceTrack), answer first-relay cap 450, cold GUM races. Residual after hop4 ≈ those + TURN gather, not more force_relay poll waste.

### Hop 3c (2026-08-10) — web **answer** first-relay align

Web **offer** hop3 budgets already: pure `relayWaitBudgetMs` **850**; warm first-pass `Math.min(budget, 500)`; pure cold second-pass **500 flat**.

Web **answer** path was still on older caps (`Math.min(budget, 700)` first; pure cold `budget+400`). **Hop3c** aligns answer with offer:

| Pass | Before (answer) | After (answer = offer hop3) |
|------|-----------------|-----------------------------|
| pure budget | 850 (already) | 850 |
| warm first-pass | `min(budget, 700)` | `min(budget, 500)` |
| pure cold second | `budget+400` (~1250) | **500 flat** |
| pure warm second | (same branch) | 400 |
| hybrid second | 400 | 400 |

Kept: early-exit on first `typ relay`, fail-open, pool=0, no dual-offer thrash. Offer rebuild-if-n=0 belt unchanged (answer has no rebuild). No mobile edit. No deploy.

**Implemented:** `ui/webrtc.js` answer path matches offer hop3 wait schedule (walk-loop 2026-08-10T23:37Z). `node --check` OK. Still needs human UI deploy before journal can improve.

**MUST smoke before GOAL_MET:** human UI deploy (offer hop3 + answer hop3c) + APK **0.1.304+** → beat **1749/4097** + `av-verify product.ok`.

### Hop 6 (2026-08-11) — web stuck-offer / 25s MTO

Hub forensics: **mto max ~25618ms** with first ICE at ~0.3s then silence until offer — classic **setLocal without emit** (ICE trickles, SDP never leaves wire) + 20s match-offer skip.

| Fix | Detail |
|-----|--------|
| `_offerSentOnce` only after emit | Was set before createOffer → blocked re-emit |
| kickSolo re-emit stuck local offer | Immediate wire if have-local-offer && !emitOk |
| offerKick waves denser | Clear stale MatchOfferAt before re-emit |
| match offer skip 20s→12s | Only when `_offerEmitOk` |

**Requires UI deploy.** Also flicker soft-bind from earlier same session.

### Hop 7 (2026-08-11) — pure budget trim + hybrid first-pass

**Hop6 verify (intact on disk):** `_offerSentOnce` only after emit; kickSolo re-emit stuck local offer; offerKick re-emit + denser waves; match-offer skip 12s gated on `_offerEmitOk`. Android answer pure cap 450 / hybrid no wait (unchanged).

| Side | Change | Expect | Ship |
|------|--------|--------|------|
| web pure | `relayWaitBudgetMs` **850→700** (offer + answer) | cold pure mto −0–150ms when relay late | code on disk — **UI deploy pending** |
| web hybrid | first-pass budget **700→400** (still wait when TURN present) | hybrid cold mto −0–300ms | same |
| pure belt | rebuild-if-n=0 on offer **unchanged**; second-pass pure cold 500 / warm 400 | product.ok risk low | same |
| android | no change (answer pure 450; hybrid `shouldWaitForFirstRelay`=false) | — | — |

Kept: early-exit on first `typ relay`, fail-open, pool=0, no dual-offer thrash, no pure warm promote, no sticky wipe. `node --check` webrtc.js + live.js OK.

**MUST NOT GOAL_MET** without human UI deploy + APK with prior hops + `av-verify product.ok`.

### Hop 8 (2026-08-11) — trim pure/hybrid first-relay + denser offerKick

| Side | Change | Expect | Ship |
|------|--------|--------|------|
| web pure | `relayWaitBudgetMs` **700→600**; warm first-pass **500→400**; second pure cold **500→400** / warm **400→300** | mto −0–150ms cold pure | code — **UI deploy** |
| web hybrid | first-pass **400→350**; second **400→300** | hybrid mto slightly tighter | same |
| web answer | same wait schedule as offer hop8 | mta when web answers | same |
| web offerKick | waves **[250,600,1200,2500,5000]** (was 400…) | stuck-offer recovery sooner | same |
| android answer pure | relay wait cap **450→350** | mta −0–100ms pure | **next APK** |
| android hybrid | force_relay poll **120→80** when offer-before-matched | mta −0–40ms race | same |

Kept: early-exit first `typ relay`, fail-open, pool=0, pure rebuild-if-n=0, no sticky wipe, no dual-offer thrash.

**Gate:** UI deploy + APK + `av-verify product.ok` before GOAL_MET.

