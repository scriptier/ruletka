# CONN-L4-hub-turn — RESULT

## Status
**COMPLETE** (read-only recommend; no deploy / coturn / pool / conf touch)

## Role
CONNECT-HUB-TURN recommender · freenet-roulette

## OWN
- RESULT only under `tasks/grok-loop/done/`
- Read-only code + scorecard
- **MUST NOT** edit coturn conf, restart services, pool, deploy, force_relay flip

## Source
| Item | Value |
|------|--------|
| Scorecard | `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json` |
| Human report | `artifacts/av-verify/latest.md` |
| Stamp | **20260812T044852Z** |
| At | **2026-08-12T04:48:52Z** |
| Window | last **10 min** |
| Locks | `docs/CONNECTIVITY_LOCK.md`, `docs/VIDEO_PATH_LOCK.md` |
| Wiki | `knowledge/wiki/force-relay-same-lan.md`, `one-way-video.md` |
| Bridge forensics | `bridge/src/simple.rs` offer/answer first-path logs (~L9280–9450) |
| Prior product.ok | L19e stamp `20260812T034413Z` (web↔android dual frames, app_vc=375) |

---

## 1. Media plane: **HOT** (not cold)

| Signal | Value | Read |
|--------|-------|------|
| **media_pass** | **true** | Infrastructure media plane alive |
| **max_rb** | **498789** | ≫ 5000 HOT threshold |
| **peer_hot** | **242** | Real TURN bytes flowing |
| **peer_usage_zero** | 37 | Noise vs 242 hot — not peer_usage blackhole |
| **err_437** | **0** | No mismatched-allocation storm |
| **err_403** | 10 | Low CreatePermission noise; dual-relay lock still correct |
| **alloc_ok** | 4 | Allocations succeeding |
| **external-ip** | `209.38.204.153/209.38.204.153` | **PUBLIC/PUBLIC** dual-relay lock intact |
| **coturn ports** | min=49160 max=50000 | Locked range |
| Gate | **PASS** `TURN media HOT max_rb=498789 peer_hot=242` | — |

**Verdict on media plane:** HOT. Web av_path beacons show `local_type=relay` / `remote_type=relay`, `ice=connected`, `pair=succeeded`, fin/fout ~62k both ways on concurrent web peers.

### Explicit freeze (do not thrash)

| Action | Decision |
|--------|----------|
| Restart coturn / roulette-bridge for “TURN fix” | **NO** |
| Change `external-ip` dual-relay map | **NO** (only after product.ok regression + `test-coturn-relay.sh`) |
| Flip `pair_force_relay` / pool>0 / docker coturn | **NO** |
| Treat one-way as turn-media | **NO** — skill: one-way + HOT → **client-ice** |

Per av-fix-loop / CONNECTIVITY_LOCK / VIDEO_PATH_LOCK: one-way with HOT TURN is **client-ice**, not turn-media.

---

## 2. answers < offers — root causes

### Snapshot counts
| Field | Value |
|-------|--------|
| matches | **4** |
| offers | **3** |
| answers | **2** |
| Gate | **WARN** `answers (2) < offers (3) — some pairs no answer` |
| max_mto_ms | 1999 (under 8s WARN) |
| max_mta_ms | 3368 (under 10s WARN) |
| last match | web ↔ **android**, force_relay=true, offerer_a=web |
| last offer | mto=**1426**ms, platform=web, relay_candidates=**1**, video_dir=sendrecv @ 04:48:50 |
| last answer relay_candidates | **0** (no first-answer line for newest match in tail) |
| Scorecard cut | **04:48:52** — only **~2s** after that offer |

Deltas to explain:
1. **matches − offers = 1** → one match never produced a first accepted offer  
2. **offers − answers = 1** → one first-offer without first-answer in the window  

### Ranked root causes (evidence-linked)

| Rank | Cause | Evidence | Hub fault? |
|------|-------|----------|------------|
| **1** | **Dual concurrent web↔web** sessions dominate journal | 4 web short-ids in av_path (`6701bda7`, `42fa8b78`, `780723c1`, `5078222c`); two healthy relay↔relay pairs with fin≈fout ~61–62k; last platforms often web↔web in earlier stamps | **No** — multi-tab / multi-pair harness noise |
| **2** | **Android no-answer / no beacon** on newest web↔android | Last solo match 04:48:49 web↔android; offer 04:48:50; **no** `first answer after match` in recent_lines; **zero** android av_path in by_platform; app_vc/bind_v/android_policy **null** | **Unlikely** — answerer client path; hub already delivered match + accepted offer |
| **3** | **Stranger hangup / Next pre-answer** | Historical pattern answers lag offers by 1 across L15b/L18; roulette strangers leave before answer completes | **No** — product UX; not coturn |
| **4** | **Match without first offer** (matches>offers) | One of 4 matches never logged first offer — leave/requeue before offerer SDP, or debounce drop of thrash only (not first-offer) | Only if debounce wrongly drops *first* offer (code path only drops when `last_offer_at` set within 3.5s — first offer exempt) |
| **5** | **Window cut mid-handshake** | Scorecard at +2s after offer; healthy mta often 2–4s (L19e mta≈2514–4072) | **Measurement** — re-run `--min 10` after phone stays linked ≥20s |

### Not root causes here
- Coturn cold / peer_usage≈0 — **refuted** (max_rb~5e5, peer_hot=242)
- 437 pool thrash — **refuted** (err_437=0)
- force_relay mismatch — **false** (android never reported; no hub=true vs phone=all beacon pair)
- Dual-relay external-ip wrong — **refuted** (PUBLIC/PUBLIC, media HOT)

### Product one-way vs infrastructure
```text
product.status = one-way  (PC→phone weak)
web fin/fout   = 62634/62634   ← dual-web healthy encode/decode
android fin/fout = 0/0         ← no android beacon in window
phone_to_pc=true  (web_fin≥10 from web↔web, not phone proof)
pc_to_phone=false (and_fin=0)
```
Script classifies one-way when web has frames but android fin=0. With **no android platform slot**, this is often **dual-web pollution + missing phone beacons**, not proof that TURN failed for phone. Prior L19e in same day proved product.ok on web↔android with app_vc=375 when phone actually answered and beaconed.

---

## 3. Hub-side improvements (only if real) — ranked

Implement only as **observability / soft lifecycle**, not media-plane thrash. None required to “fix” HOT TURN.

| Rank | Improvement | Why real | Risk | Priority |
|------|-------------|----------|------|----------|
| **P1** | **Per-match terminal reason metric** on leave: `complete` \| `hangup_pre_offer` \| `hangup_pre_answer` \| `answer_timeout` \| `drop_debounce` \| `drop_answerer_grace` + `platform_a/b` | Distinguishes stranger hangup vs android no-answer vs dual-web noise; answers&lt;offers WARN becomes actionable | Low — log/event only | **Do when next hub hop allowed** |
| **P2** | **Export connect-journal counters** already partially present (`kind=offer|answer|drop`) as rate: unanswered_offer_rate by platform pair | av-verify can stop treating dual-web as product one-way; optional filter last non-web↔web match for product | Low | **Do** |
| **P3** | **Log `first answer missing`** when match ends after first offer with no answer (include match age, answerer platform) | Closes forensic gap when scorecard window cuts mid-mta | Low | Nice |
| **P4** | Soft **answer-wait timeout rematch** (e.g. ≥12–15s after offer, no answer → end match with reason, requeue offerer) | Only if product shows stuck “linking” with phone still online; do **not** ship without smoke | Medium — can thrash Next | **Defer** until client-ice + human smoke |
| **P5** | Coturn metrics scrape (alloc rate, 403, 437, peer_usage histogram) | Already grepped by av-verify; err_403=10 is fine | Low | Optional ops |

### Explicit non-improvements (do **not** do)
1. **Do NOT restart coturn** — media plane HOT  
2. **Do NOT change dual-relay** `external-ip=PUBLIC/PUBLIC` without product.ok **regression** + `./scripts/test-coturn-relay.sh` PASS  
3. **Do NOT** force `pair_force_relay=true` for all web↔android (CONNECTIVITY_LOCK regression)  
4. **Do NOT** raise pool / re-enable docker coturn  
5. **Do NOT** treat answers&lt;offers alone as hub SDP bug when max_mto&lt;2s and offer relay_candidates=1  

Hub first-path code already healthy:
- Offer debounce 3.5s (thrash only)  
- Answerer first-path grace 30s  
- Logs `match_to_offer_ms` / `match_to_answer_ms` / `relay_candidates` / `video_dir`  
- Warn on answer `recvonly`/`inactive`  

No evidence those need code change this hop.

---

## 4. Explicit freeze line

> **Do NOT restart coturn / change dual-relay without product.ok regression.**  
> TURN HOT + product one-way (android 0/0, dual web) → **client-ice**, not turn-media.

---

## 5. NEXT_ROLE for parent

| Field | Value |
|-------|--------|
| **NEXT_ROLE** | **`client-ice`** |
| Why | media_pass=true, max_rb HOT, err_437=0; product one-way / android absent beacons; av-loop already has NEXT_ROLE=client-ice, PRODUCT=one-way |
| Not | `turn-media` (media not cold) |
| Not | `smoke` only (need client diagnosis after human Start, but human still required for product.ok) |
| After client-ice ship | **smoke** — PC hard-refresh + phone Start once ≥20s; `./scripts/av-verify.sh --min 10`; demand android av_path + fin/fout both ≥10 |

Aligns with:
- `.grok/skills/av-fix-loop` decision tree (one-way + HOT → client-ice)  
- `artifacts/av-loop/NEXT_ROLE` = `client-ice`  
- `knowledge/wiki/one-way-video.md` agent lane  

---

## Scorecard table (this hop)

| Field | Value |
|-------|--------|
| **verdict** | **WARN** |
| **product.status** | **one-way** |
| product.done | false |
| hard_fail | false |
| signaling_ok | true |
| media_pass | **true** |
| matches / offers / answers | 4 / 3 / 2 |
| max_mto / max_mta / max_mti | 1999 / 3368 / 3526 ms |
| last platforms | web ↔ android |
| last_force_relay | true |
| force_relay_mismatch | false |
| app_vc / bind_v | **null** / null |
| web fin/fout | 62634 / 62634 |
| android fin/fout | **0 / 0** |
| TURN max_rb | **498789** |
| peer_hot / err_437 / err_403 | 242 / 0 / 10 |
| coturn_lock | skip (not re-run this hop) |

### Gates
| Level | Message |
|-------|---------|
| WARN | answers (2) &lt; offers (3) — some pairs no answer |
| **PASS** | TURN media HOT max_rb=498789 peer_hot=242 |
| WARN | PRODUCT one-way (PC→phone weak): web 62634/62634 android 0/0 |

---

## Connect risk

**None this hop** — pure recommend + RESULT write. No conf, no service restart, no client ICE edit, no deploy.

## Files
- Session RESULT: `/home/drakosik/tasks/grok-loop/done/CONN-L4-hub-turn-RESULT.md`
- Repo RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/CONN-L4-hub-turn-RESULT.md`
- Scorecard: `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json` (stamp **20260812T044852Z**)
- Task card (running): `/home/drakosik/freenet-roulette/tasks/grok-loop/running/CONN-L4-hub-turn.md`

## COMPLETE

**media plane HOT · answers&lt;offers = dual-web + stranger/android no-answer (+ window cut) · hub thrash forbidden · NEXT_ROLE=client-ice.**
