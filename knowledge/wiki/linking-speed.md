# Linking speed (match → offer / answer)

Spec: [`../specs/current-linking-speed.md`](../specs/current-linking-speed.md) · feel: [`../specs/current-linking-feel.md`](../specs/current-linking-feel.md) · 5s→3s plan: [`../specs/2026-08-16-link-5s-to-3s.md`](../specs/2026-08-16-link-5s-to-3s.md)

## FAIL (2026-08-20 · 1v1 PC↔Android `20260820T203346Z` · answers=0 — cite as &lt;3s blocker)

| Metric | Value |
|--------|-------|
| verdict | **FAIL** |
| matches / offers / answers | 3 / 2 / **0** — phone never sent an SDP answer |
| android av_path | `ice=new` / `cs=new` / `sig=stable` **whole window** (0/0 both ways), `force_relay=true`, `bind_v=0`, `app_vc=464` |
| TURN | **HOT** (`max_rb=641559 peer_hot=61`) — infra fine, only phone's answer leg dead |
| UI | Android **Trying relay… 122s** Retry/Rebuild; PC partner tile stuck **linking cameras** |
| Source | gotcha **70** (`gotchas.md`) · raw `../raw/20260820T203320Z-1v1-linking.md` · shots `20260820T203320Z-android-1v1.png` / `-pc-1v1.png` · spec [`../specs/current-linking-speed.md`](../specs/current-linking-speed.md) |

**Read this correctly:** this is **answers=0** (android never emits an SDP answer at all), **not** the `relayWaitBudgetMs` **480** tuning question below ("do not cut 480") — that lock is about trimming a wait on a path that *does* eventually answer. Cutting the 480 budget cannot fix a dead answer leg and is **out of scope** for this FAIL. Any &lt;3s linking-speed GOAL_MET claim must treat this stamp as an open blocker until re-verified with answers&gt;0. **No product.ok invent** from this stamp.

## Residual (2026-08-16 · laptop 1v1 `063936Z` · product.ok · SLOW)

Human: laptop↔Pixel **links** after webrtc **335**. av-verify product.**ok** web fin **663** / android fout **579** (laptop no cam). Last rematch mto **3609** / mta **4975** (SLOW). Cleaner 1v1 in same window **1082 / 2321**. ICE after answer still FRA TURN. **Do not cut 480.** Extra PC tab / rematch / 3rd join made the last hop worse. **No linking GOAL_MET.**

## Residual (2026-08-16 · av-verify `2026-08-16T03:30:11Z` · product.ok)

| Metric | Last 10 min |
|--------|-------------|
| product | **ok** · web↔android · web **401/468** · android **417/373** · app_vc **423** · bind_v=1 |
| last match | web offer **584** · android answer **1904** · ice_connected ~**3.2s** |
| window max | mto **1805** / mta **2896** |
| Human | still feels **~5s** faces (Linking + intro SoftBlur + first keyframe) |

**Not GOAL_MET.** Do **not** cut `relayWaitBudgetMs` **480**. Hop A on disk (`live.js` **674** Linking latch + `live.tsx` intro peel). Spec [`../specs/2026-08-16-link-5s-to-3s.md`](../specs/2026-08-16-link-5s-to-3s.md). **No GOAL_MET** until human clock. Do not invent p50.

## Residual (2026-08-14 · av-verify `20260814T041120Z` · product.ok + SLOW)

| Metric | Latest `at=2026-08-14T04:11:20Z` |
|--------|----------------------------------|
| verdict | **WARN** (answers 6 &lt; offers 8) |
| product | **ok** · last match **web↔web** `force_relay=true` · web **142/140** · android **67/54** (mixed 10-min window) · app_vc **385** · bind_v=1 · fr_mismatch **false** |
| max mto | **6859** **SLOW** (stretch &lt;800 warm / &lt;1500 pure) |
| max mta | **7426** **SLOW** (stretch &lt;2500) |
| platforms | last match **web ↔ web** (laptop↔PC same-LAN) — android frames in-window **≠** phone PASS |
| Source | `artifacts/av-verify/latest.md` · stamp `20260814T041120Z` |

**Honesty:** product.**ok** + **SLOW** 6859/7426 is a residual, **not** linking GOAL_MET. max ≠ p50. Same-IP `force_relay` **stays** (`CONNECTIVITY_LOCK`). Hop11 `relayWaitBudgetMs` **480** — **do not cut**.

**“weak link”** on this path is **first-path encode low** + **FRA TURN** (same public IP → hub `force_relay=true` → coturn FRA). That is **not** a broken P2P path — host is locked off for same-LAN. Feel hops (dismiss Linking on audio/frames; weak badge only on real loss/rtt) live in [`../specs/current-linking-feel.md`](../specs/current-linking-feel.md). Herd `20260814T045854Z` · this residual **link-spec**.

## Residual (2026-08-14 later · laptop↔PC human)

Human: **laptop browser ↔ desk PC browser connects**. Static/hiss **gone** (mic boost **100** + NS). **Linking cameras still feels too long.**

- Stretch **unchanged**: p50 mto &lt;800 / mta &lt;2500. Last known mixed scores stay as written below — **do not invent** new journal / product.ok.
- Hop11 `relayWaitBudgetMs` **480** pure / **300** hybrid already on disk — **no further wait cut**.
- Feel hop: dismiss **Linking** on first media (`trio-js` / paint-first). Not ICE.
- **3-way layout FAIL** shots `20260814T043425Z` (PC 1v1-like + sliver + “Linking cameras…”; phone idle Start) is **not** a linking ICE problem — separate FAIL. **No MULTI_PASS**.
- Herd `20260814T043610Z` · this residual **link-wiki**. **No linking GOAL_MET.**

## Residual (live journal — phone desk 2026-08-14 · product.ok **1097/2153**)

| Metric | Phone desk `20260814T025100Z` | Evening `20260812T193821Z` | Phone smoke `20260812T064214Z` (historical) |
|--------|-------------------------------|----------------------------|---------------------------------------------|
| verdict | **PASS** | **PASS** | **PASS** |
| product | **ok** — web **2827/3071** · android **3050/2827** | **ok** — web **4372/5038** · android **5021/4371** | **ok** — web **670/776** · android **756/678** |
| max mto | **1097** ms (target &lt;800 warm / &lt;1500 pure) | **1498** ms | **1895** ms |
| max mta | **2153** ms (target &lt;2500) | **2685** ms | **3122** ms |
| platforms | **web ↔ android** (WEB_PAIR fake-media web + Pixel) | **web ↔ android** | **web ↔ android** |
| android av_path | **yes** app_vc **384** bind_v=1 · **0.1.376** | app_vc **383** | app_vc **382** |
| fr_mismatch | **false** · policy=**relay** | **false** | **false** |
| Source | `av-verify` `at=2026-08-14T02:51:00Z` · device-smoke **MATCHED** `20260814T024804Z` | `20260812T193821Z` | `CONN-smoke-phone-avpath-RESULT` |

**Honesty (phone desk):** stamp **`20260814T025100Z`** product.ok app_vc **384** mto **1097** / mta **2153** beats 1498/2685. **≠ linking GOAL_MET** — one window, WEB_PAIR fake-media web, mto still &gt;800 warm. No more wait cuts. No invent p50.

### Hop10 web-kick static (disk, 2026-08-12)

| Check | State |
|-------|--------|
| pure offerer connectBudget | **1100** |
| force_relay inflightGrace | **1100** (hybrid 400) |
| offerer GUM | **async SDP-first** (empty transceivers; cam later) |
| Static card | **PASS** (`CONN-hop10-web-static-RESULT`) — **not** speed GOAL_MET |
| Ship pin tip | **`live.js?v=572`** · stage **`live-stage.css?v=393`** · brand **`live-brand.css?v=16`** (morning re-read `ui/live.html`; hop10 logic still present; historical hop10 pin was 569; overnight-2 stage was 392) |

### Prior residual (2026-08-10, pre-hop3 ship)

| Metric | Pure web→android (force_relay) |
|--------|--------------------------------|
| max mto | **1749** |
| max mta | **4097** (SLOW) |

Hop9 window (historical): max mto **1264** / max mta **2700** · product.ok · web 516/764 · android 214/29 · app_vc **371**.

## Phone desk (2026-08-14)

USB Pixel as a **lab bench** (plan **A+D**). Herd `20260814T024723Z` · dump `artifacts/phone-desk/status.txt` · raw [`../raw/2026-08-14-phone-plug-measure.md`](../raw/2026-08-14-phone-plug-measure.md) · scorecard [`../raw/2026-08-14-phone-plug-av-verify.md`](../raw/2026-08-14-phone-plug-av-verify.md).

| | |
|--|--|
| Device | Pixel 9 Pro serial **`45141FDAP0004F`** USB |
| Keyguard | **off** |
| Stay-awake | `stay_on_while_plugged_in=15` · USB |
| Installed APK | **0.1.376 / vc384** |
| hide_ip warm | on disk — **NOT in this APK** |
| Measure | **done** `20260814T025100Z` · device-smoke **MATCHED** · **product.ok** mto **1097** / mta **2153** |
| GOAL_MET | **no** — single window; mto 1097 still &gt;800 warm; not p50 |

### Playbook A+D

| Lane | What | Command |
|------|------|---------|
| **A** | av-verify + logcat **while** a match | `./scripts/av-verify.sh` · `./scripts/phone-desk.sh logcat` |
| **D** | plugged phone = bench (no APK install; refuse SoftBlur / unlock spam if keyguard) | `./scripts/phone-desk.sh status\|stay\|guard\|dump\|logcat` |

- `guard` exits **2** if keyguard — callers **must stop** (no F17-style unlock spam).
- `dump` writes `artifacts/phone-desk/status.txt`. Dump snapshot: ruletka **not-running**, focus Lawnchair.
- Script **does not install APK**. This hop is SKIP_INSTALL only. Raw: device-smoke `SKIP_INSTALL=1 WEB_PAIR=1` `20260814T024804Z` still mid-start (`matched:false`, no `last-verdict.txt`).
- After match `025100Z`: mto **1097** / mta **2153** product.ok app_vc **384** (WEB_PAIR fake-media web). Beats 1498/2685. **Still not GOAL_MET** (p50 mto &lt;800).
- `preferRelayWarm` hide_ip hop is **not** in vc384.

## Brainstorm (2026-08-14)

Source: [`../raw/2026-08-14-linking-brainstorm.md`](../raw/2026-08-14-linking-brainstorm.md) · herd `20260814T021956Z` · **not** product FAIL · **not** linking GOAL_MET · **no** MediaSession this hop.

```
match → web kickSolo (GUM/SDP) → first typ relay wait → emit offer (mto)
      → android startCall EARLY → setRemote → bindAnswer → createAnswer
      → answer relay wait → emit answer (mta)
      → ICE + first frames (feel)
```

| Prefer | Avoid |
|--------|--------|
| Honest harness (gotcha 24: `ROULETTE_TURN=off` + same-IP `force_relay` → pair-smoke 0/0) | Cut `relayWaitBudgetMs` again (already **480** pure / **300** hybrid) |
| Compound this residual **6859/7426** SLOW web↔web (`041120Z`) + keep mixed **1498/2685** historical | Dual-write MediaSession + `live.js` |
| Static reconfirm hop10/11 survived iOS `webrtc.js` sampleRate gate | pool&gt;0 · dual-offer · sticky wipe · SFU |
| Human hard-refresh + one phone match → new av-verify **before** any budget / MediaSession hop | Invent linking GOAL_MET from brainstorm or this compound |

Hop11 wait already below old floor (`relayWaitBudgetMs` **480** / **300**) — plan said do not cut &lt;520 without re-smoke. Android EARLY kick already on `live.tsx`. Feel/paint-first later, not this hop.

## Hop9 lanes (on disk / next smoke)

| Lane | OWN | Focus |
|------|-----|--------|
| **web-kick** | `ui/live.js` | kickSolo emit race, offerKick early waves, match→offer locks, paint-first media-OK (feel) |
| **web-relay** | `ui/webrtc.js` | pure budget 600→**520**; warm first-pass **350**; early-exit; **no** pool; rebuild-if-n=0 stays |
| **android-answer** | `MediaSession.ts` | answer serial: bind pre-createAnswer; pure relay cap **350→280**; hybrid poll trim; **policy=all→relay** when hub force_relay sticky |
| **android-ui** | `mobile/app/live.tsx` | earliest startCall/answer on matched; don't block primary on secondary; forceRelayHub latch re-apply |

## Hops on disk (history)

| Hop | Side | Change | Ship |
|-----|------|--------|------|
| 3 | web offer | pure budget 850; warm first-pass 500; pure cold second 500 flat | UI |
| 3c | web answer | same schedule as offer | UI |
| 3 | android answer | relay wait min 450; post-setLocal bind fire-and-forget | APK ≥0.1.304 |
| 4 | android inbound | pure offer SDP → force_relay; **skip 800ms poll** | APK ≥0.1.308 |
| 6–8 | web + android | stuck-offer, pure/hybrid budget trims, denser offerKick, answer pure 350 | UI + APK |
| **9** | residual + lanes | live **mto 1264 / mta 2700** + product.ok; further cuts in lanes above | smoke after ship |
| **10** | web-kick | pure offerer **connectBudget 1100**; force_relay **inflightGrace 1100** (hybrid 400); offerer **GUM async SDP-first**. **pool=0** + dual-offer guards unchanged. Static re-read **PASS**. Latest product.ok mto/mta **1498 / 2685** (app_vc **383**); historical phone smoke **1895 / 3122** (app_vc **382**); overnight **1633 / 3697**; after-MX no-phone WARN **1342 / 5793**. | disk tip **`live.js?v=572`** · APK historical smoke **0.1.374-vc382** · **linking-speed GOAL_MET still no** |

## Belts (MUST NOT)

- pool>0 · wipe force_relay sticky · dual-offer thrash · pure-promote warm PC without belts
- More pure-wait cuts without before/after `product.ok` — **no more wait cuts this hop** (relay already 480)
- Dual-write MediaSession + live.js this hop
- Do **not** invent mto/mta / GOAL_MET — only cite journal / scorecard after real smoke

## Smoke (web↔web SLOW residual open · mixed scores historical · no GOAL_MET)

1. **Lead residual (cite this until a newer `at=`):** stamp **`20260814T041120Z`** · verdict **WARN** · **product.ok** · last match **web↔web** `force_relay=true` · web **142/140** · android **67/54** (mixed window — **≠** phone PASS) · app_vc **385** · max_mto **6859** **SLOW** · max_mta **7426** **SLOW** (`artifacts/av-verify/latest.md`) — **≠ linking-speed GOAL_MET**
2. **Phone desk (2026-08-14):** USB Pixel **`45141FDAP0004F`** keyguard off · APK **0.1.376 / vc384** · A+D playbook above · desk product.ok **`025100Z`** mto **1097** / mta **2153** app_vc **384** — still not p50 / not GOAL_MET. hide_ip warm on disk is **not** in that APK.
3. **Historical evening mixed:** stamp **`20260812T193821Z`** · **product.ok** · app_vc **383** · android **5021/4371** · web **4372/5038** · mto **1498** · mta **2685** · web↔android — keep as mixed residual, not the lead
4. **Historical phone smoke:** stamp **`20260812T064214Z`** · **product.ok** · app_vc **382** · tip APK **0.1.374** · android **756/678** · web **670/776** · mto **1895** · mta **3122** — do not cite as “the” residual
5. **PC:** hard-refresh so **`live.js?v=572`** + stage **`?v=393`** + brand **`?v=16`** + **`webrtc.js?v=315`** load if re-measuring speed (hop10 web-kick still on disk)
6. **Verify residual speed:** re-run `./scripts/av-verify.sh` after a desk match (or any budget/MediaSession hop); compare mto/mta vs lead **6859 / 7426**, desk **1097 / 2153**, evening **1498 / 2685**, morning **1895 / 3122**, overnight **1633 / 3697**, hop9 **1264 / 2700**. Cite a new residual **only** if `at=` is newer than `2026-08-14T04:11:20Z`.
7. **No linking-speed GOAL_MET** from hop10 static alone, from product.ok with SLOW 6859/7426, from product.ok with mto at 1500 stretch / mta still above 2500, from Soft 1v1 matrix, from F17 multi soft **BLOCKED**, from multi harness SCAFFOLD, from the 2026-08-14 brainstorm, from **phone desk plug / A+D harness**, or from “weak link” UI (first-path low + FRA TURN ≠ broken P2P)

## Gameplan (prefer over pure thrash)

| Prefer | Avoid |
|--------|--------|
| Honest **harness** (gotcha 24) so agents stop “fixing” fake 0/0 | Cutting `relayWaitBudgetMs` / pure-wait without re-smoke product.ok |
| Static reconfirm hop10/11; wiki residual **6859/7426** SLOW (`041120Z`) | Dual-write MediaSession + live.js this hop |
| Human hard-refresh + one phone match → new av-verify before budget hop | Pool, dual-offer, sticky wipe, SFU |
| **web-kick** paint-first / emit race; **android-ui** earliest answer (later hops) | Inventing GOAL_MET from residual table or brainstorm |

Skill note: `av-fix-loop` § Linking speed. Spec gate: `../specs/current-linking-speed.md`.

## Related

- [force-relay-same-lan](force-relay-same-lan.md) · [gotchas](gotchas.md) · [connect-scorecard](connect-scorecard.md)

### Log

- 2026-08-16 hop A on disk: spec `2026-08-16-link-5s-to-3s` · live.js **674** latch Linking off after first audio/frames · Android intro peel on frames (not 2.8s sit) · last card `033011Z` 584/1904 ice~3.2s · **no GOAL_MET** · **no p50 invent** · do not cut 480.
- 2026-08-14 herd `20260814T045854Z` (this **link-spec**): av-verify **`20260814T041120Z`** product.**ok** · verdict **WARN** · last match **web↔web** `force_relay=true` · max_mto **6859** / max_mta **7426** **SLOW** · web **142/140** · android **67/54** mixed **≠** phone PASS · **“weak link”** = first-path **low** + FRA TURN same-LAN, **not** broken P2P · same-IP `force_relay` **stays** · hop11 **480** **do not cut** · feel hops in `current-linking-feel.md` · **no linking GOAL_MET / no product.ok invent**.
- 2026-08-14 later (herd `20260814T043610Z`): laptop↔PC **connects** · hiss gone (mic **100** + NS) · linking still slow (feel) · stretch p50 mto &lt;800 / mta &lt;2500 **unchanged** · hop11 **480** **do not cut** · feel hop = dismiss Linking on first media (`trio-js`) · 3-way layout FAIL `20260814T043425Z` **≠** ICE · last known mixed scores stay as written · **no linking GOAL_MET / no product.ok invent**.
- 2026-08-14 phone desk A+D: USB Pixel **`45141FDAP0004F`** keyguard off stay_on=15 · APK **0.1.376/vc384** (hide_ip warm **not** in this APK) · residual still **1498/2685** `193821Z` · **measure in flight** · **no linking GOAL_MET / no product.ok invent**.
- 2026-08-14 evening compound: lead residual **product.ok** `20260812T193821Z` app_vc **383** web **4372/5038** android **5021/4371** mto/mta **1498/2685**; morning **1895/3122** kept historical; brainstorm prefer/avoid filed (no more wait cuts; harness; no MediaSession this hop) · **linking-speed GOAL_MET no**.
- 2026-08-12 morning compound: product.ok phone smoke stands (app_vc **382** tip **0.1.374** mto/mta **1895/3122**); Soft 1v1 agent matrix **closed** (F11–F16b) blur-only; multi SoftBlur **F17+F18 BLOCKED** keyguard (**no multi PASS**); brand P0–P5 pin **v=16** landed Claude/Grok; disk pins re-read **`live.js?v=572`** / stage **393** / brand **16** · **linking-speed GOAL_MET no**.
- 2026-08-12 phone smoke: **`20260812T064214Z`** verdict **PASS** · **product.ok** · app_vc **382** · tip **0.1.374-vc382** · android **756/678** · web **670/776** · mto **1895** · mta **3122** · web↔android · fr match relay (`CONN-smoke-phone-avpath-RESULT`) · **≠ linking-speed GOAL_MET** · **no multi PASS invent**.
- 2026-08-12 overnight-2 compound: after-MX **`20260812T062732Z`** verdict **WARN** product.**one-way** · no android av_path · web↔web · mto **1342** · mta **5793** · NEXT_ROLE=**smoke** (`CONN-verify-after-mx-RESULT`); overnight product.ok stamp still stands for dual-frame window only · tip pin **`live.js?v=572`** · **linking-speed GOAL_MET no**.
- 2026-08-12 overnight compound: hop10 static **PASS** still on disk; av-verify **product.ok** `20260812T051553Z` · mto **1633** · mta **3697** · android fout **6** · tip pin then **`live.js?v=571`** · **linking-speed GOAL_MET no**.
- 2026-08-12 hop10 verify-docs: web-kick **connectBudget pure 1100** · **inflightGrace 1100** · offerer GUM async SDP-first on disk; historical pin **`live.js?v=569`**; residual then **1264/2700**; **pool=0** · no dual-offer thrash; **GOAL_MET still needs product.ok + stretch**.
- 2026-08-12 polish: install stamps → APK **0.1.363-vc371**, web **`live.js?v=559`** / **`webrtc.js?v=315`** (residual mto/mta table unchanged; **no GOAL_MET**). Historical pin — hop10 ship was **569**, tip now **571**.
- 2026-08-12 hop9 residual: product.ok · max_mto=**1264** · max_mta=**2700** · fr_mismatch policy=all vs hub pure; lanes web-kick / web-relay / android-answer / android-ui. **No GOAL_MET.**
- 2026-08-11 walk-loop: page created from hop residual (smoke pending).
- 2026-08-11 session: paint-first + weak-belt gameplan filed (`live.js?v=550`+); **no pure-wait cuts** without product.ok.
