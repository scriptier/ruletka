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

### Hop10 recommendations (2026-08-12, task 450-connect-android-answer-recommend)

Read-only pass over `MediaSession.ts` answer path + `live.tsx` matched/kick, against
`artifacts/connect-loop/baseline-av-verify.md` (android fin/fout=0/0, **zero** android
`av_path` rows in a 10-min / 16-sample window while web was HOT) and the live hop9 scorecard
WARN (`force_relay mismatch hub=true android fr=1 policy=all` vs web `policy=relay`). Full
detail + DONE WHEN per item in
`tasks/admin-queue/done/450-connect-android-answer-recommend-RESULT.md`. Ranked by
impact/risk, no code changed (scorecard-gate required before any ICE-policy edit):

1. **No retry on ICE/TURN fetch failure** — `live.tsx:1763-1779` (mount `loadIce()`) and
   `live.tsx:3277-3287` (matched-immediate fetch) both swallow fetch errors with only a
   30-min `setInterval` retry. Any transient hub HTTP blip strands `hasTurn()=false` for
   up to 30 min, which fails `pcConfig()`/`desiredRelayPolicy()` open to `policy=all` on
   every force_relay=true match in that window — a direct one-way/no-media candidate.
2. **Confirm baseline APK includes hop10 before chasing "android one-way" further** —
   commit `ec89c5b` (2026-08-11 18:05 local) added the `arm_0` immediate av_path beacon
   (`MediaSession.ts:3677`, "missing av_path was misread as one-way") specifically because
   the scorecard couldn't tell "no beacon" from "no media." Baseline shows literally zero
   android av_path rows (not just fin/fout=0), which is the exact symptom hop10 targeted.
   Rebuild/bump the local APK past `ec89c5b` and re-run `av-verify` before trusting the
   current one-way reading as a live media bug.
3. **Pure-relay policy decision is `hasTurn()`-gated at PC-build time and never revisited
   after remote SDP applies** — `pcConfig():1731-1776`, `desiredRelayPolicy():1840-1845`,
   `ensureRelayPolicyPc():1787-1834` (`remoteApplied` gate at `1791-1794` blocks any later
   fix). If TURN lands after the offer is applied while hub wanted pure, the PC is
   permanently stuck `fr=1`/`policy=all` for that call — this is the literal hop9 WARN
   already called out in the file's own comments (`1781-1785`, `5093-5094`).
4. **`forceRelayRebuild()` is dead code** — `MediaSession.ts:1957-1979` is a fully-built
   TURN-only recovery path for "first path never gets media," documented for exactly this
   symptom, but has zero call sites. Wiring a gated trigger (only past the CONNECTIVITY_LOCK
   ~15s floor, one-shot, no dual-offer) would give force_relay matches an actual recovery
   path instead of silently sitting one-way for 10 minutes.
5. **`camReady` check in `startCall` doesn't match the RN-safe `trackUsable()` helper** —
   `startCall:2628-2630` uses strict `readyState === "live"`, while the newer answer-path
   check (`handleRemoteSignalInner:5048-5053`) already switched to `trackUsable()`
   (`3072-3080`) to handle RN's empty-string `readyState`. The stale strict check in
   `startCall` can spuriously skip the warm/fast path and take an avoidable GUM-wait detour
   on every RN answer. Small, safe, single-predicate fix.

