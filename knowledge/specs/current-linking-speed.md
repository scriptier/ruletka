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

- **FAIL `20260820T203346Z` (blocker for &lt;3s GOAL_MET — read before any relayWaitBudgetMs work):** 1v1 PC↔Android av-verify **FAIL**: matches=3 offers=2 **answers=0** — phone never sent an SDP answer (not a slow-but-working relay wait). Android av_path pinned `ice=new`/`cs=new` the whole window (0/0 both ways), `force_relay=true`, `bind_v=0`, `app_vc=464`. TURN itself was HOT (`max_rb=641559 peer_hot=61`) — infra fine, only the phone's answer leg is dead. **Do not** read this as the `relayWaitBudgetMs` **480** tuning question (hop11 below) — that lock is about trimming a *working* wait; here there is no answer to wait for, so cutting 480 cannot fix it and is not in scope. See gotcha **70** (`gotchas.md`), raw `20260820T203320Z-1v1-linking.md`, residual detail in [`linking-speed.md`](../wiki/linking-speed.md). **No product.ok invent** from this stamp — this is a FAIL, not a residual.
- **Herd `20260814T045854Z` (av-verify `20260814T041120Z`):** verdict **WARN** · product.**ok** · last match **web↔web** `force_relay=true` · max_mto **6859** / max_mta **7426** (**SLOW**). Mixed 10-min window also has android fin/fout **67/54** app_vc **385** — **do not cite as phone PASS**. Stretch **unchanged**: p50 mto &lt;800 / mta &lt;2500. **“weak link”** = first-path encode **low** + same-LAN **FRA TURN**, **not** broken P2P. Same-IP `force_relay` **stays** (`CONNECTIVITY_LOCK`). Hop11 `relayWaitBudgetMs` **480** — **do not cut**. Feel hops: [`current-linking-feel.md`](current-linking-feel.md). **No linking GOAL_MET** / **no invent product.ok**.
- **Human 2026-08-14 later (herd `20260814T043610Z`):** laptop browser ↔ desk PC browser **connects**. Static/hiss **gone** (mic boost **100** + NS). **Linking cameras still feels too long** — feel hop is dismiss Linking on first media (`trio-js` / paint-first), **not** another `relayWaitBudgetMs` cut. Mixed scores stay as written (desk `025100Z` 1097/2153 · evening `193821Z` 1498/2685 · `034518Z` no-media 1538/2948). **3-way layout FAIL** shots `20260814T043425Z` is a **separate** layout FAIL (not linking ICE). **No GOAL_MET**.
- **Active** — hops 1–11 on disk. **Laptop↔Pixel 2026-08-14 `034518Z` product.no-media** (mto 1538 / mta 2948 this match; max 2194/6893; answer relay **0**; android ICE checking→**failed**; black 24s+). Morning desk product.ok `025100Z` 1097/2153 **≠** this. Disk hop: answer wait uses full `relayWaitBudgetMs()` + do not treat RN false-complete as relay-ready. **Needs APK** (vc384 still has 180/220 cap). **No GOAL_MET**.
- Hop11 `relayWaitBudgetMs` **480** pure / **300** hybrid **already on disk** — **do not cut further** without a new `product.ok` smoke.
- **This hop OUT:** MediaSession, wait cuts, ICE. Feel hops live in [`current-linking-feel.md`](current-linking-feel.md) (dismiss Linking on first media; weak badge only on real loss/rtt). (Wiki residual compound only.)
- **No GOAL_MET** — stretch still mto &lt;800 warm / &lt;1500 pure · mta &lt;2500. Window max **6859/7426** is SLOW tail, not p50. Mixed 1498/2685 / desk 1097/2153 stay historical.

### Live residual (2026-08-14 web↔web `20260814T041120Z` — product.ok + SLOW)

| Metric | Web↔web same-LAN (`force_relay=true`) |
|--------|----------------------------------------|
| verdict | **WARN** (answers 6 &lt; offers 8) |
| product | **ok** · last match **web↔web** · web **142/140** · android **67/54** (mixed window) · app_vc **385** · bind_v=1 · fr_mismatch **false** |
| max mto | **6859** **SLOW** (stretch &lt;800 warm / &lt;1500 pure) — hub: `from=925ecbfe` `video_dir=recvonly` |
| max mta | **7426** **SLOW** (stretch &lt;2500) — hub: `from=5fda140a` `video_dir=sendonly` |
| same-IP force_relay | **stays** (`CONNECTIVITY_LOCK`) — FRA TURN on same-LAN is policy, not a broken P2P path |
| “weak link” | first-path encode **low** + FRA TURN RTT — **not** broken P2P (feel: [`current-linking-feel.md`](current-linking-feel.md)) |
| hop11 | `relayWaitBudgetMs` **480** — **do not cut** |
| Source | `artifacts/av-verify/latest.md` · stamp `20260814T041120Z` · at=`2026-08-14T04:11:20Z` |

**Not GOAL_MET.** product.ok ≠ speed gate. max ≠ p50. Mixed android frames in the same 10-min window **≠** phone PASS. Feel hops are in `current-linking-feel.md`, not another wait cut.

### Prior live residual (2026-08-12 product.ok `20260812T193821Z`)

| Metric | Pure web→android (force_relay=true) |
|--------|-------------------------------------|
| max mto | **1498** (stretch &lt;800 warm / &lt;1500 pure) |
| max mta | **2685** (stretch &lt;2500) |
| answer serial (mta−mto) | ~**1187** ms |
| product | **ok** · app_vc **383** · bind_v=1 · fr_mismatch **false** |
| frames | web **4372/5038** · android **5021/4371** |
| Source | `artifacts/av-verify/latest.md` · stamp `20260812T193821Z` |

**Not GOAL_MET.** Explorer: mto ≈ web offer first-relay on cold pure; mta ≈ android bind + answer relay + ICE feel. Residual is answer serial + gather, **not** more `relayWaitBudgetMs` cuts.

### Historical residual (2026-08-10, before hop3 ship)

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

### Hop 9 (2026-08-12) — residual after product.ok smoke

**Live scorecard (same session, human match):**
| Metric | Value |
|--------|-------|
| product | **ok** web fin/fout 516/764 · android 214/29 |
| max_mto | **1264** ms (target &lt;800 warm / &lt;1500 pure) |
| max_mta | **2700** ms (target &lt;2500) |
| serial answer (mta−mto) | ~**1436** ms |
| WARN | force_relay mismatch hub=true android fr=1 **policy=all** (web policy=relay) |
| app_vc | 367 |

**Prefer (no pure thrash without re-smoke):**
| Lane | OWN | Focus |
|------|-----|--------|
| link-web-kick | `ui/live.js` | kickSolo emit race, offerKick early waves, match→offer locks, paint-first media-OK (feel) |
| link-web-relay | `ui/webrtc.js` | hop9: pure budget 600→**520**; warm first-pass **350**; early-exit already; **no** pool; rebuild-if-n=0 stays |
| link-android-answer | `MediaSession.ts` | answer serial: bind pre-createAnswer, pure relay cap **350→280**, hybrid poll trim; policy=all→relay when hub force_relay sticky |
| link-android-ui | `mobile/app/live.tsx` | earliest startCall/answer on matched; don't block primary on secondary; forceRelayHub latch re-apply |
| link-docs | wiki `linking-speed.md` + SMOKE-NEXT | residual table + smoke steps for hop9 |

**MUST NOT:** pool&gt;0, dual-offer thrash, wipe force_relay sticky, GOAL_MET without re-smoke product.ok.

### Hop 10 (2026-08-12) — web-kick on disk (historical)

| Side | Change | Expect | Ship |
|------|--------|--------|------|
| web kick | pure offerer `connectBudgetMs` **1100**; force_relay `inflightGrace` **1100** (hybrid 400) | cover first-path gather; less tear-mid-gather | on disk |
| web offerer GUM | **async SDP-first** (empty transceivers; cam later) | mto not blocked on cold GUM | on disk |

Kept: pool=0, no dual-offer thrash. Static re-read PASS. **Not** speed GOAL_MET.

### Hop 11 (on disk) — `relayWaitBudgetMs` already **480**

| Side | Change | Expect | Ship |
|------|--------|--------|------|
| web pure | `relayWaitBudgetMs` **520→480**; hybrid first-pass **300**; warm first-pass **320**; second pure cold **320** | last wait trim | **on disk** |
| web answer | same schedule as offer hop11 | mta when web answers | same |

**Floor:** hop11 wait is **already below** the old “do not cut &lt;520 without re-smoke” plan. **Do not cut `relayWaitBudgetMs` further** without a **new** `product.ok` smoke. This hop **OUT:** MediaSession, wait cuts, ICE.

### This hop (2026-08-14 · herd `20260814T045854Z`) — spec residual only

| In | Out |
|----|-----|
| Record av-verify `20260814T041120Z` product.**ok** · max_mto **6859** / max_mta **7426** **SLOW** · last match **web↔web** `force_relay=true` | **MediaSession** / wait cuts / ICE |
| **“weak link”** = first-path **low** + FRA TURN same-LAN, **not** broken P2P | Invent linking **GOAL_MET** / invent a new product.ok |
| Same-IP `force_relay` **stays** (`CONNECTIVITY_LOCK`) · hop11 **480** **do not cut** | Undo same-IP relay |
| Feel hops → [`current-linking-feel.md`](current-linking-feel.md) | Cut `relayWaitBudgetMs` |

**No linking GOAL_MET.** product.ok + SLOW 6859/7426 is a residual, not a gate.

### Prior hop (2026-08-14 later · herd `20260814T043610Z`) — residual only

Human: laptop↔PC **connects**; hiss gone (mic **100** + NS); linking still **slow** (feel). Stretch p50 mto &lt;800 / mta &lt;2500 **unchanged**. Hop11 **480** already on disk — **no further relayWait cut**. Feel hop = dismiss Linking on first media (`trio-js`). 3-way layout FAIL `20260814T043425Z` is **not** ICE. Last known mixed scores stay as written — **no new journal / product.ok invent**. **No GOAL_MET.**

### Prior hop (2026-08-14 herd) — spec residual only

| In | Out |
|----|-----|
| Status + live residual → product.ok **1498 / 2685** (`20260812T193821Z`, app_vc **383**) | **MediaSession** |
| Note hop11 **480** already on disk — no further wait cut | **wait cuts** (`relayWaitBudgetMs` / android answer cap) |
| Keep hops 1–11 historical tables | **ICE** (policy, pool, dual-offer, sticky) |

**No GOAL_MET.** Next implementer needs a new human hard-refresh + phone match → new `av-verify` before any budget / MediaSession hop. Feel (Linking dismiss) is `trio-js`, not a wait cut.
