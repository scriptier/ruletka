# Multi-party 3-way / 4-way — cross-platform matrix

**Status:** active · **Spec:** [`../specs/current-multi-party.md`](../specs/current-multi-party.md) · **See-everyone (layout lock):** [`../specs/2026-08-14-3way-see-everyone.md`](../specs/2026-08-14-3way-see-everyone.md) · **Android parity:** [`../specs/2026-08-14-android-browser-parity.md`](../specs/2026-08-14-android-browser-parity.md) · **Cross plan:** [`../specs/MULTI-CROSS-IMPROVE-PLAN.md`](../specs/MULTI-CROSS-IMPROVE-PLAN.md) (P5 = this page) · **Finish residual:** [`../specs/FINISH-PLAY-MULTI.md`](../specs/FINISH-PLAY-MULTI.md) · **Smoke:** [`../specs/SMOKE-NEXT.md`](../specs/SMOKE-NEXT.md) § Multi-party  
**Product:** mesh P2P (not SFU). Cap: **you + 3 remotes = 4 people** (`MAX_EXTRA_PEERS = 2` extras on Android). Find-3rd hunt: **2v1** (party2↔solo) **or** **2v2** (party2↔party2, including two stranger 1v1s that both accepted). Live 3-way does **not** queue a random 4th — Call / Invite 4th only. **No MULTI_PASS.**

Do **not** re-learn thrash from chat. Read this matrix + gotchas before touching multi outbound.  
**Skill:** `multi-party-stage` — `.grok/skills/multi-party-stage/SKILL.md`

## Find-3rd 2v1 or 2v2 (2026-08-22) — **NO MULTI_PASS**

Two 1v1s that both tap Find 3rd used to wait forever (`stranger_party_blocks_2v2`). Hub now matches them as **2v2**. Seat map on PC 2×2: **their pair top, your pair bottom**. Stop copy = Leave (not Leave 3rd). Next = Next pair. Phone landscape **column stack** on disk (not a row) — needs APK. Per-person tap/gift/friend **PARTIAL** (gotcha **75**). `start_party_vs_party` uses `pair_force_relay`. Spec [`2026-08-21-party-shapes.md`](../specs/2026-08-21-party-shapes.md).

## Layout lock (2026-08-14) — tile count = people

Human locked. Spec [`2026-08-14-3way-see-everyone.md`](../specs/2026-08-14-3way-see-everyone.md). One person per tile. **No empty extra tile.** **No MULTI_PASS.**

| People | Tiles | 2×2 |
|--------|-------|-----|
| **2** (1v1) | **2** | **No** |
| **3** (3-way) | **3** | **No** |
| **4** | **4** | **Yes** (optional; same four people, one per cell) |

- Tile count **equals people**. 2×2 switch exists **only** when there are 4 people.
- 1v1 and 3-way: **no 2×2 control at all**.
- 4-way 2×2 = the four people, one per cell. No fifth/empty cell. Default stays the 4-tile non-grid until human says otherwise.
- Android 3-way **on disk** (herd `20260814T083341Z`): big 1v1 window splits **top/bottom remotes**; small PiP = you. Hunt wrap: do **not** unmount the first partner RTCView. **2×2 only at 4**. Device on latest FAIL `223218Z` is **0.1.392** (session disk **vc400**) — extra-tile split **not** on this phone. Do not invent another APK this hop. **No MULTI_PASS.**
- Browser 3-way: columns **person \| person \| you**.
- Laptop **double-PC** (same stream on two tiles, no Android cam) = FAIL. See gotcha **41**.
- MATCHED 3-way with hunt **Find 3rd** as the middle column + you sliver + no cams = FAIL. See gotcha **43** · `084504Z`.
- Latest desk: **FAIL `201649Z`** — hunt-keep **HELD** (do not remount); Android two-stack OK; PC cam then **no-cam cover** on top Драконов; laptop same Chrome sees PC not Android. See gotcha **59**. Earlier **FAIL `234930Z`** Courtier black from ended tracks. **No MULTI_PASS.**

## Hunt-keep held; no-cam covered live PC; laptop misses Android (2026-08-15 · `201649Z`) — **FAIL · NO MULTI_PASS**

Hunt-keep **HELD** while searching 3rd — do **not** remount RTC (WIN). After 3rd: Android two-stack OK; PC cam painted then **NoCamPortrait covered** the live tile (top Драконов). Laptop same Chrome sees PC **not** Android — role / unanswered 3rd (`answers < offers`, web `ice=new` 0/0), **not** a Chrome-version bug. Distinct from **38** (rematch tear), **40** (hub debounce), **48** (muted ≠ dummy). Leftover product.ok is **1v1**. Next: overlay routing + diagnose 3rd link — not ICE / force_relay / hunt remount. See gotcha **59**. Spec [`2026-08-15-3way-held-nobreak.md`](../specs/2026-08-15-3way-held-nobreak.md). Raw [`../raw/2026-08-15-3way-held-nocam-cover.md`](../raw/2026-08-15-3way-held-nocam-cover.md).

## Ended tracks + leftover WxH = black, first-ok PC dropped on 3rd-join ice_failed (2026-08-14 · `234930Z`) — **FAIL · NO MULTI_PASS**

New failure mode distinct from empty/no-cam tiles: `#remote` still reports `has-remote-feed` with leftover `427×320`, but both audio and video tracks are **ended** — `setNoCamPortrait` treated the stale WxH as live pixels and painted a black slab instead of the no-cam cylinder. Root cause traced to the 3rd-join path: when the 3rd peer's `ice_failed`, `dropOnePeerKeepRest` tore down the **first**, already-good PC and left its dead stream bound to `#remote`. Phone stayed **1v1** no-cam (extras split on disk, not installed — still **0.1.392**). 1v2 first offer also came back `video_dir=recvonly` because the preview map lagged `#local`. See gotcha **53**.

| Field | Evidence |
|-------|----------|
| Stamp | `20260814T234930Z` (prior `234600Z`) |
| Shots | [cdp-live 234600Z/234930Z](../../artifacts/shots/20260814T234930Z-cdp-live.png) · [phone 234751Z/234903Z](../../artifacts/shots/20260814T234903Z-cam3b-phone.png) · [pc 234903Z](../../artifacts/shots/20260814T234903Z-cam3b-pc.png) |
| Debug Chrome (tab `634/328`) | 3-col: Courtier **black slab** \| mid no-cam cylinder \| you (Razer) live. Banner Connection weak |
| CDP `#remote` | w=427 h=320 paused=false **has-remote-feed** — but tracks audio **ended**, video **ended** |
| CDP `#remote-third` | w=0, no tracks, has-no-cam-portrait tile |
| Console | skip promote (328 worked), then Partner left + keep-pair drop |
| User paste | live.js **632** / webrtc **326** — stale tab, not `634/328` |
| Phone | Pixel **1v1** Partner no-cam cylinder + self PiP — no 3-way split. App **0.1.392** |
| Score `234754Z` | product.ok is **prior 1v1** (web 240/299, android 282/237, app_vc 400); the 1v2 hop shows android arm_0 bind_v=0 **0/0** with first offer `video_dir=recvonly` — that 1v2 miss, not the stale 1v1 product.ok, is this gate |
| Raw | [`../raw/2026-08-14-3way-ended-tracks-black.md`](../raw/2026-08-14-3way-ended-tracks-black.md) |
| Spec | [`../specs/2026-08-14-3way-cameras-plan.md`](../specs/2026-08-14-3way-cameras-plan.md) |
| Hop (disk + rsync) | `live.js?v=635` · `webrtc.js?v=329` · stamp `20260814T235308Z-cam3-635` — ended-tracks paint fix + no-drop of first-ok PC on 3rd-join ice_failed + recvonly→sendrecv renegotiate. **Needs hard-refresh to score.** Phone extras still APK **0.1.392** (disk-only, no bump this hop) |

Do not treat this leftover-WxH black as a "no camera" cylinder case — it is a distinct paint bug (gotcha **53**), separate from muted live dummy width=0 (**51**) and watchdog promote (**52**). **No MULTI_PASS.**

## After 3-col then black (2026-08-14 · `223218Z`) — **FAIL · NO MULTI_PASS**

After-shot: Laptop tile dies, phone stays 1v1 with no video. **3-col layout ≠ faces.** **Do not invent MULTI_PASS** / **do not invent product.ok**.

| Field | Evidence |
|-------|----------|
| Stamp | `20260814T223218Z` (~16:32) · prior `223139Z` (~16:31) |
| Shots | [after-pc-ruletka](../../artifacts/shots/20260814T223218Z-after-pc-ruletka.png) · [after-phone](../../artifacts/shots/20260814T223218Z-after-phone.png) · prior [morework-pc-ruletka](../../artifacts/shots/20260814T223139Z-morework-pc-ruletka.png) |
| `223139Z` | PC 3-col Laptop **beige/blur video** \| Partner ★31 **black** \| you live. Banner You + friend · stranger on the right. Phone **idle Start** last Partner 30s |
| `223218Z` | PC 3-col Laptop **solid black** \| Partner ★31 **black** \| you live. Same banner + Stop Leave Third |
| Phone | matched **1v1** · no-cam cylinder · toast “Still no video — tap Retry path or Next” · Partner ★0 · **no split** · app **0.1.392 / vc400** |
| av-verify | `20260814T223227Z` verdict **WARN** · product **one-way** · web fin/fout **767/774** · android **0/0** · bind_v=**0** · app_vc=**400** · ice **new** |
| Pins (re-read `ui/live.html` this hop) | `live.js?v=629` · `webrtc.js?v=326` · stage **444** |
| This herd | `20260814T223413Z` **n-wiki** (n-web / n-css / n-and are siblings — **not** human faces) |
| Raw | [`../raw/2026-08-14-after-3col-then-black.md`](../raw/2026-08-14-after-3col-then-black.md) |

Laptop empty track stayed a black tile (no no-cam portrait). Phone never split. **No MULTI_PASS.**

## Laptop 3-col vs this PC 2-col is ROLE (2026-08-14 · `221232Z`) — **FAIL · NO MULTI_PASS**

Human asked why laptop Chrome ≠ this PC Chrome. Same call, **different roles** — not two apps.

| Surface | Layout | Identity |
|---------|--------|----------|
| Laptop Chrome | **3-col** Courtier **black** \| Драконов **live** \| Laptop self no-cam | YOU **Laptop** ★31 · banner **You vs a pair** |
| This PC `221232Z` | **2-col** Courtier **black** + mute \| Драконов self live | YOU **Драконов** · 1v1 dock · Connecting… |
| Phone `221222Z` | still **1v1** · partner **Laptop** ★31 **black** · no split | app **0.1.392** |

Raw [`../raw/2026-08-14-laptop-vs-pc-chrome-3way.md`](../raw/2026-08-14-laptop-vs-pc-chrome-3way.md). Card [resources](resources.md#card-laptop-vs-pc-chrome-3way). Gotcha **49** note / **50**. **Do not invent MULTI_PASS.**

## After 624 rsync: PC 3-col, remotes black, Laptop on main (2026-08-14 · `211817Z`) — **FAIL · NO MULTI_PASS**

Prod `live.js?v=624` · stage **439**. PC **3-col works** (Laptop \| Courtier \| you). Both remotes **black** (laptop should be no-cam portrait, not empty). Occupancy **Laptop on main** (`#remote`) — 3rd/stranger displaced first partner. Phone still **1v1** Partner ★0 + no-cam cylinder · app **0.1.392**. Footer still 1v1 chrome. 3-col layout ≠ faces. **Do not invent MULTI_PASS** / **do not invent product.ok**.

| Field | Evidence |
|-------|----------|
| Stamp | `20260814T211817Z` (~21:18Z) |
| Shots | [3way-624-pc-ruletka](../../artifacts/shots/20260814T211817Z-3way-624-pc-ruletka.png) · [3way-624-phone](../../artifacts/shots/20260814T211817Z-3way-624-phone.png) · [3way-624-pc](../../artifacts/shots/20260814T211817Z-3way-624-pc.png) |
| Banner | MATCHED · Mesh match · Relay Same Lan · In a call · YOU Драконов |
| Left / main | **Laptop** · 🇨🇦 Canada Calgary · KNOWN · praised by 1 · ★31 — **black** (no no-cam portrait) |
| Mid | **Courtier** · 🇨🇦 Calgary · ★142 · volume 100% · blur chip — **black** |
| Right | **Драконов** · ★205 — live self camera |
| Occupancy | **Laptop on main** — stranger/3rd on `#remote`; Courtier not first-partner tile |
| Phone | still **1v1** · Partner ★0 · brand cylinder “No camera / Talking with microphone · Partner” · self PiP · Gifts ★142 · app **0.1.392** |
| Pins (re-read `ui/live.html` this hop) | `live.js?v=624` · `webrtc.js?v=325` · stage **439** · brand **19** · i18n **252** |
| This herd | `20260814T212123Z` **p-web** / **p-html** / **p-css** / **p-and** — disk only |
| Raw | [`../raw/2026-08-14-3way-624-shots.md`](../raw/2026-08-14-3way-624-shots.md) |
| Spec | [`../specs/2026-08-14-finish-3way-4way.md`](../specs/2026-08-14-finish-3way-4way.md) |

Earlier Find-3rd mid `084504Z` + sliver `071810Z` + laptop-sees-PC `063259Z` + hunt crash still residual. Smoke after this herd’s disk hops + human refresh — **not** agent PASS. **No MULTI_PASS.**

## MATCHED 3-way still Find-3rd mid + you sliver + silent (2026-08-14 · `084504Z`) — **FAIL · NO MULTI_PASS**

Human desk smoke on **prod** `ruletka.vip`. Banner says MATCHED 3-way; middle column is still hunt chrome; no conversationalist cameras; no sound. Disk hops this herd (**b-js / b-css / b-webrtc**) are **not** on the tab until **rsync**. 1v1 leftover ≠ 3-way faces. **Do not invent MULTI_PASS** / **do not invent product.ok**.

| Field | Evidence |
|-------|----------|
| Stamp | `20260814T084504Z` (~08:45Z) |
| Shots | [3way-messed-pc](../../artifacts/shots/20260814T084504Z-3way-messed-pc.png) · [3way-messed-phone](../../artifacts/shots/20260814T084505Z-3way-messed-phone.png) |
| Banner | MATCHED · Mesh · In a call · **You + friend · stranger on the right** |
| Left | **Courrier** · 🇨🇦 Canada · Calgary · ★11 · **black** (no cam / no video) |
| Mid | huge empty · hunt **Find 3rd** chip on a **live MATCHED 3-way** |
| Right | **you sliver** (selfie) · Courrier · Canada · Calgary |
| Hex | Stranger · **DABC74ED** in header |
| Phone | 1v1 **Partner ★0** black · PiP ceiling · timer 4:04 · generic Stop/Next · app_vc **392** (not 385) |
| av-verify | `20260814T084452Z` verdict **WARN** · product **one-way** · web fin/fout **6227/6234** · android **0/0** ice **checking** · bind_v **1** · app_vc **392** · **offers=3 answers=2** |
| Tab | **prod ruletka.vip** — disk hops need **rsync** |
| Human | “3way ui still messed up … dont even see videos or hear sound” |
| Disk hop | herd `20260814T084616Z` · b-js / b-css / b-webrtc **disk only** (**needs rsync**) · this lane **b-wiki** |
| Pins (re-read `ui/live.html` after ~90s sibling wait) | `live.js?v=598` · `webrtc.js?v=324` · stage **414** · brand **16** · i18n **252** |
| Raw | [`../raw/2026-08-14-3way-messed-novideo.md`](../raw/2026-08-14-3way-messed-novideo.md) |
| Spec | [`../specs/2026-08-14-3way-messed-novideo.md`](../specs/2026-08-14-3way-messed-novideo.md) |

Earlier sliver `071810Z` + laptop-sees-PC `063259Z` + hunt crash + Android 1v1 black `075019Z` still residual. Smoke only after human **rsync** + laptop+PC hard-refresh to the pins above. **No MULTI_PASS.**

## Stage floor dock (2026-08-14 · herd `20260814T082214Z`) — **disk · no MULTI_PASS**

`#tile-floor-partner` (Stop / Next / chat) is a **`#stage` child after all tiles**, not a `#tile-remote` / tile-1 overlay. HTML comment: *1v1 under partner column; 3/4-way full width under cameras*. CSS `--stage-dock-h`. **Do not invent MULTI_PASS.**

| Mode | Dock |
|------|------|
| **1v1** (`stage-duo`) | **Partner-column** only (bottom of left / partner column) |
| **3-way / 4-way** | Reserved band **under all tiles** (`padding-bottom: var(--stage-dock-h)`). Full-width stage child. Does **not** cover faces. **Not** a tile-1 overlay. |

2×2 switch still **only at 4**. Disk pins (re-read `ui/live.html` after sibling wait · herd `20260814T084616Z`): `live.js?v=598` · `webrtc.js?v=324` · stage **414** · i18n **252**.

## See-everyone desk residual (2026-08-14 · herd `20260814T080020Z`) — **FAIL · NO MULTI_PASS**

Implementer hops **do not** close this until human paste of both browsers + phone. 1v1 leftover `product.ok` ≠ 3-way faces.

| Surface | Residual now | Want |
|---------|--------------|------|
| Laptop browser | **PC camera twice**; no Android cam. **Still current 2026-08-20** — extra Android↔laptop link stuck `ice=checking` **0/0** offerer=0 (~100s); PC↔Android pair itself connects fine (fin/fout live). Late-offer kick `armMeshLateOfferKicks` (pin **834→862**) does not clear it. Raw `20260819T195239Z` [`2026-08-19-3way-laptop-no-android.md`](../raw/2026-08-19-3way-laptop-no-android.md). | One tile = PC, one tile = Android |
| Android | Human still **FAIL** (does not see both; 1v1 leftover **black partner** `075019Z` + **`084504Z`** Partner ★0 black · vc **392**). **Split + Stop labels on disk** — tip `app.json` **0.1.385 / vc393** not on this phone. **No MULTI_PASS** | Big window splits top/bottom remotes; PiP = you |
| PC browser | **`084504Z`:** left Courrier **black** · mid **Find 3rd** · you sliver · no sound. Earlier: missing volume / loc / one ★. | Each remote tile: live A/V (or no-cam portrait) · name + loc + stars + per-tile volume · **no hunt chrome mid** |

Raw: [`../raw/2026-08-14-3way-messed-novideo.md`](../raw/2026-08-14-3way-messed-novideo.md) · [`../raw/2026-08-14-android-black-partner.md`](../raw/2026-08-14-android-black-partner.md). Latest FAIL **`084504Z`**. Earlier trio sliver `071810Z` still residual.

## Human rsync checklist (`084504Z` FAIL — prod tab)

Disk hops ≠ prod. Tab that failed is **ruletka.vip**. **Do not invent MULTI_PASS** after rsync. Agents must not `push.sh`.

1. rsync `ui/live.html` + `ui/live.js` + `ui/webrtc.js` + `ui/live-stage.css` + `ui/i18n.js` (Android APK only if human says **build apk** — phone on FAIL is **vc392**, not 385).
2. Hub per-target debounce (`p-hub` / `bridge/src/simple.rs`) needs **human** compile/restart — agents must not `push.sh`.
3. Hard-refresh **laptop + PC** until DevTools shows pins from `ui/live.html` (re-read after sibling wait · herd `20260814T084616Z`): `live.js?v=598` · `webrtc.js?v=324` · stage **414** · brand **16** · i18n **252**.
4. Rematch: 1v1 first (both faces), then Find 3rd. Mix: **PC browser + laptop browser + Android app**.
5. Gate: MATCHED 3-way **never** shows hunt **Find 3rd** as the middle column; 3 equal tiles (you not sliver); each remote plays a **distinct** stream (or no-cam portrait); audio unmuted per tile. Laptop ≠ double PC. Tile count = people; no 2×2 in 1v1/3-way.
6. av-verify after rematch: 1v2 offers≈answers. Product **one-way** / android **0/0** / leftover 1v1 `product.ok` is **NOT** this gate. **No invent product.ok.**

## Mesh topology (not SFU)

**4 people = 6 P2P links** (complete graph K4). Not a server mix.

| People | Links (each pair) | Each client |
|--------|-------------------|-------------|
| 2 (1v1) | 1 | 1 PC |
| 3 | 3 | 2 PCs |
| 4 | **6** | **3 PCs** |

Each person **encodes** their cam up to 3 times (primary **mid**, extras **low**) and **decodes** up to 3 remotes + 3 audio. Cap **3 opponents (you+3)** is mesh budget — `log.partyCap` / `partyCap`.

**Same-LAN / same public IP** uses hub `force_relay` → **FRA coturn** (up to 3 TURN allocations per client). Relayed media is the designed path — **not** “broken P2P”. **Lock stays** — never `force_relay=false` on same IP (host hairpin black). Signaling is still **mesh P2P**, **not SFU**. See [force-relay-same-lan](force-relay-same-lan.md). Pool stays **0**. 3rd-leave keep remaining pair is a **client disk hop**, not ICE.

Desktop Chrome usually holds 3 PCs. Phone is the risk (HW encode / `track.clone()`). **Human 3-way faces still OPEN.** Code hops ≠ MULTI_PASS. SCAFFOLD_DONE ≠ MULTI_PASS. 1v1 product.ok ≠ 3-way. **Do not invent MULTI_PASS.**

## 3-way still black + you sliver (2026-08-14 · `071810Z`) — **FAIL · NO MULTI_PASS**

PC live crop after herd `20260814T065106Z`. Mix: laptop no-cam + Android + PC browser. **No conversationalist cameras** on this PC view. 1v1 product.ok leftover ≠ 3-way faces. **Do not invent MULTI_PASS.**

| Field | Evidence |
|-------|----------|
| Stamp | `20260814T071810Z` (~07:18Z) |
| Shot | [3way-now-pc-live](../../artifacts/shots/20260814T071810Z-3way-now-pc-live.png) (full desk `…-3way-now-pc.png` 5120×1440) |
| Banner | MATCHED · Mesh match · In a call · YOU Драконов · **You + friend · stranger on the right** |
| Left | **Laptop** · 🇨🇦 Canada · Calgary · ★128 · **black** (no cam portrait, no video) |
| Mid | **Laptop** again + **Stranger · AC8BEC2F** (hex poison) · dark empty |
| Right | **you** crushed to a thin sliver (outdoor selfie) |
| Hub | `party vs solo` then **offers=2 answers=1** (answers &lt; offers) |
| av-verify | `20260814T071744Z` verdict WARN · product **ok** is **1v1 leftover**, not 3-way |
| Phone | **not captured** — no adb (USB missing; wireless `192.168.1.94:43343` no route) |
| Cause | (1) **prod lag** — tab looks like old 3-col lock; (2) hub **per-client** 3.5s `last_offer_at` drops the 2nd offer to a different `to=` → unanswered 3rd; (3) empty `#tile-third` still reserves a column; (4) hex who-sub paints as name; (5) no-cam still black if advertise/recvonly not on the live tab |
| Disk hop | herd `20260814T072031Z` · **p-hub** debounce **per target peer** (**needs deploy**) · p-web / p-layout / p-android disk only (**needs rsync**) |
| Raw | [`../raw/2026-08-14-3way-now-black.md`](../raw/2026-08-14-3way-now-black.md) |
| Spec | [`../specs/2026-08-14-3way-black-plan.md`](../specs/2026-08-14-3way-black-plan.md) |

Smoke only after human **rsync** + hub compile/restart + laptop+PC hard-refresh. **No MULTI_PASS.**

## Find-3rd hunt crash (2026-08-14 · USB Pixel + 2 Chrome) — **FAIL · NO MULTI_PASS**

Human desk smoke **lost the first partner**. Phone **left the match**. App **pid still alive** — **not** a native crash. **Do not invent MULTI_PASS.**

| Field | Evidence |
|-------|----------|
| Stamp | `20260814T030641Z` (~03:06Z · phone UI 9:06) |
| Serial | **45141FDAP0004F** (Pixel 9 Pro USB · same desk as 1v1 product.ok `025100Z`) |
| Phone | [crash3-phone](../../artifacts/shots/20260814T030641Z-crash3-phone.png) — idle **Start**, **0 online**, last **CA Драконов · 2AFEE934 · 20s** · local preview still painting |
| PC | [crash3-pc](../../artifacts/shots/20260814T030641Z-crash3-pc.png) — trio hunt, partner tile **BLACK**, banner **Connection weak — reconnecting...**, self Драконов still live, other tab still hunting |
| Process | app pid alive · live UI idle · **not** tombstone / FATAL native |
| Mix | Pixel app + 2 PC Chrome tabs (spec `2026-08-14-multi-3way-pixel-chrome.md`) |
| APK on device | **0.1.376 / vc384** (desk same serial) |
| Raw | [`../raw/2026-08-14-multi3-hunt-crash.md`](../raw/2026-08-14-multi3-hunt-crash.md) |
| Herd | `artifacts/herd/20260814T030939Z` · this residual **hunt-wiki** (implement = hunt-android / hunt-web / hunt-css) |

**Honesty:** 1v1 product.ok `025100Z` (mto/mta 1097/2153) **≠** hunt keep · **≠** 3-way faces. SCAFFOLD_DONE **≠** MULTI_PASS. Soft 1v1 **≠** this FAIL. Next agent: keep first partner live on hunt; do not remount 1v1 RTC; do not tear on Connection-weak while 1-peer trio-searching.

## Honest ship state (2026-08-12 · F17–F70 residual)

## 3-way laptop sees PC, not Android (2026-08-14 · `063259Z`) — **FAIL · NO MULTI_PASS**

Laptop Chrome: tiles present, **PC camera live, Android black**. Pair was laptop+Android; PC joined as 3rd.

| Field | Evidence |
|-------|----------|
| Score | `20260814T063259Z` WARN · product one-way (1v1 parser) |
| Laptop `b16a30da` | offerer=0→PC connected frames_in climbing; offerer=1→Android ice failed frames_in **124** then `have-local-offer` |
| Android `f889660d` | ice=new bind_v=0 arm_0 |
| Cause | `handleMatched` used `peers[0]` (stranger) + `needNewPeer` + `force_relay&&!live` → full rematch tore teammate; hub 3.5s offer debounce dropped re-offer |
| Disk hop | **`live.js?v=590`** incremental joinPeers (current HTML pin **`?v=598`**) — **needs rsync** · APK last cited **0.1.384 / vc392** (do not invent a new APK this hop) |

Do **not** invent MULTI_PASS. Smoke after laptop+PC hard-refresh current `live.js?v=` from `ui/live.html`.

## Skip / Stop contract (human 2026-08-14)

After Find 3rd + a live 3rd. **Behavior** (hub) + **labels** (browser + Android disk):

| Who | Next | Stop |
|-----|------|------|
| Original pair (`your_role=party`) + 3rd live | Skip 3rd, hunt next 3rd, teammate stays · label `btn.nextStranger` | Remaining + 3rd → **1v1** · label **Leave 3rd** (`btn.stopLeaveThird`) |
| The 3rd (`your_role=solo`) | Solo search (does not keep the pair) · label `btn.next` | Idle; pair hunts again · label **Leave call** (`btn.stopLeaveCall`) |
| 1v1 (no extras) | **Next** (`btn.next`) | **Stop** (`btn.stop`) |
| Friend phone call (`mode=friend`) | **Hangup only** — no Next hunt | Stay 1v1 until **Find 3rd** accepted |

Friend 1v1 must **not** instant-`browse_together`. Hunt strip only after `find_third_result` ok. Hub on disk rejects friend-pair browse (“use Find 3rd”) — **needs deploy**. Gotcha **66**. Disk **`live.js?v=844+`**. **No MULTI_PASS.**

Disk: hub `place_in_solo_queue` · web `keepParty=yourRole===party` · Android `isPartyKeepOnSkip` + `live.tsx` `labels.stop/next` + `LiveBottomBar` paints those strings as-is. Prod hub already had pair Next/Stop; 3rd-Next cleanup + rematch deprioritize need **deploy**. Older **0.1.376** tore primary on pair Next. Tip APK still **0.1.384 / vc392** (director bumps after `--bump` — do not invent vc). **No MULTI_PASS.**

## 3rd-leave keep remaining pair (2026-08-14 · herd `20260814T085708Z`) — **disk hop · no MULTI_PASS**

Spec [`2026-08-14-keep-pair-no-relink.md`](../specs/2026-08-14-keep-pair-no-relink.md). **This hop is disk** (keep-web `ui/live.js` · keep-android `mobile/app/live.tsx`). **Not** human 3-way PASS. **Do not invent product.ok / MULTI_PASS.**

When the **extra** peer bye/stop (3rd leaves the call):

| Stay | Must not |
|------|----------|
| Close **only** that extra PC | `closeAllPeers` rematch |
| Remaining remote keeps `srcObject` / RTCView | Tear survivor + new offer/answer / Linking restart |
| Layout **3 → 2** tiles (tile count = people) | Empty 3rd column / hunt chrome mid |
| Android extra hangup: `closeCall({ keepLocal })` only | `startCall` primary again |

Distinct from **Skip / Stop** (gotcha **29**): pair Next = hunt next 3rd; pair Stop = remaining+3rd → 1v1; 3rd Stop = 3rd idle. **3rd-leave keep** = extra peer hangs up; original pair stay in the **same** 1v1 (no relink).

**Lock stays:** same-Wi-Fi **Relayed** = designed **FRA TURN** (`CONNECTIVITY_LOCK`). Signaling is still **mesh P2P**, **not SFU**. **Never** flip `force_relay=false` on same public IP. Pool **0**. Badge Relayed ≠ lost P2P. See [force-relay-same-lan](force-relay-same-lan.md) · gotcha **44**.

## Android browser-parity (2026-08-14 · herd `20260814T083341Z`) — **disk · no MULTI_PASS**

Spec [`2026-08-14-android-browser-parity.md`](../specs/2026-08-14-android-browser-parity.md). Phone should match browser in a 3-person call. **Code on disk ≠ MULTI_PASS.** Tip APK **0.1.384 / vc392** until director `--bump`.

| DONE WHEN | On disk | Gate |
|-----------|---------|------|
| **A** 3-way split | Portrait column **top/bottom remotes**; PiP = you; hunt: top partner · bottom looking; first RTCView stays mounted (`pickStageChromeLayout` / `LiveStageVideo`) | Human faces |
| **B** 2nd/3rd remote starts | `startCall2/3`; Linking off on audio or video; no audio-first cylinder over a live PC cam | Human faces |
| **C** Extra tiles | name (no hex) · loc · ★ · per-tile volume | Human paint |
| **D** Stop/Next labels | pair+3rd → Next stranger / **Leave 3rd**; you are 3rd → Next / **Leave call**; 1v1 → Next / Stop | Human labels |
| **E** 2×2 only at 4 | `showGrid2x2Toggle` only when 4 people; pool=0; no MediaSession ICE this hop | Static + human |

Do **not** invent MULTI_PASS / product.ok / a new APK version this hop.

## 3rd not linking (2026-08-14 · `032707Z`) — **FAIL · NO MULTI_PASS**

Pair hunts, 3rd never paints. Phone solo **You're first in line**. Firefox middle **Looking for a 3rd** while strip says **Your pair · vs their pair**. Chrome already **Add as friend**.

| Field | Evidence |
|-------|----------|
| Shot | `artifacts/shots/20260814T032707Z-no3rd3-{pc,phone}.png` |
| Web undo | `handleMatched` `setThirdSlotStream(null)` after `joinPeers` re-opened hunt brand |
| Disk hop | **`live.js?v=578`** `showThirdConnecting` — **not** human 3-way PASS |
| Device APK | **0.1.376 / vc384** — hunt-keep still **not** on phone |
| Hub | one live tab per identity — 2 tabs same login kicks the older |

Do **not** invent MULTI_PASS. Hard-refresh `?v=578` then smoke Find 3rd again.

**Disk tip (re-read `ui/live.html` this hop · herd `20260814T223413Z` — not agent PASS):**

| Surface | Stamp on disk | Source |
|---------|---------------|--------|
| APK | **do not invent this hop** — device FAIL **0.1.392** (session disk **vc400**) · extra-tile split **not** on this phone | session card · raw `223218Z` |
| `live.js` | **`?v=629`** | `ui/live.html` preload + script (re-read this hop) |
| `webrtc.js` | **`?v=326`** | `ui/live.html` |
| `live-stage.css` | **`?v=444`** | `ui/live.html` |
| `live-brand.css` | **`?v=19`** | `ui/live.html` |
| `i18n.js` | HTML pin **`?v=252`** (body `log.partyCap` / `partyCap` = max 3 opponents you+3) | `ui/live.html` |

**Human 3-way smoke: FAIL `223218Z`** (PC **3-col** · Laptop+Partner ★31 **black** · phone still **1v1** no-cam toast · android **0/0** bind_v=**0**). Earlier **FAIL `221232Z`** ROLE + **FAIL `211817Z`** (3-col remotes black) + **FAIL `084504Z`** (Find-3rd mid · you sliver) + **FAIL `071810Z`**. Hunt crash **FAIL** + laptop-sees-PC **`063259Z`** still residual. 3-way/4-way faces still **OPEN**. Agents must **not** invent MULTI_PASS or GOAL_MET.  
**SCAFFOLD_DONE ≠ MULTI_PASS.** Web harnesses (L28 web2 + F17 web2phone find-3rd) exit 0 scaffold only · `multi_product_pass:false`.  
**Multi SoftBlur: OPEN / device NOT claimed — F17–F70 BLOCKED (keyguard PIN · serial 43343 · tip 0.1.374-vc382).** F9/F16/**F19s** static only (F19s: product flag ON + per-tile SoftBlur map intact · static ≠ device PASS — `BLUR-F19s-multi-soft-static-reconfirm-RESULT`). Soft 1v1 F11–F16b ≠ multi-tile soft. **F17** device attempt BLOCKED (keyguard; phone peers=0; 0× softNative/Sink; SCAFFOLD_DONE only) — `BLUR-F17-multi-soft-device-attempt-RESULT`. **F18** reconfirm still keyguard — multi SoftBlur **not attempted / not claimed** — `BLUR-F18-multi-soft-unlock-retry-RESULT`. **F19** same unlock-gate fail (AlternateBouncer / fingerprint) — multi SoftBlur **not attempted / not claimed** — `BLUR-F19-multi-soft-unlock-retry-RESULT`. **F20** unlock-retry still keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · AlternateBouncer) · serial **43343** · tip **0.1.374/vc382** · multi SoftBlur **not attempted / not claimed** — `BLUR-F20-multi-soft-unlock-retry-RESULT`. **F21** same gate · face auth pending · multi SoftBlur **not attempted / not claimed** — `BLUR-F21-multi-soft-unlock-retry-RESULT`. **F22** continuity still keyguard BLOCKED · multi SoftBlur **not claimed** (F23–F60 tables). **F23** unlock-retry still keyguard · AlternateBouncer · serial **43343** · tip **0.1.374/vc382** · multi SoftBlur **not attempted / not claimed** — `BLUR-F23-multi-soft-unlock-retry-RESULT`. **F24** same gate reconfirm · multi SoftBlur **not attempted / not claimed** — `BLUR-F24-multi-soft-unlock-retry-RESULT`. **F25 · F26 · F27** continuity unlock-retry still keyguard BLOCKED · multi SoftBlur **not claimed** (L40–L42 SMOKE SoftBlur stamps · F28/F29 continuity). **F28** unlock-retry still keyguard · AlternateBouncer · serial **43343** · tip **0.1.374/vc382** · multi SoftBlur **not attempted / not claimed** — `BLUR-F28-multi-soft-unlock-retry-RESULT`. **F29** same gate reconfirm (~09:06Z) · multi SoftBlur **not attempted / not claimed** — `BLUR-F29-multi-soft-unlock-retry-RESULT`. **F30 · F31 · F32 · F33 · F34 · F35 · F36** continuity unlock-retry still keyguard BLOCKED · multi SoftBlur **not claimed** (F37–F60 continuity tables). **F37** unlock-retry still keyguard · AlternateBouncer · serial **43343** · tip **0.1.374/vc382** · multi SoftBlur **not attempted / not claimed** — `BLUR-F37-multi-soft-unlock-retry-RESULT`. **F38** same gate reconfirm (~09:57Z) · multi SoftBlur **not attempted / not claimed** — `BLUR-F38-multi-soft-unlock-retry-RESULT`. **F39** same gate reconfirm (~10:06Z) · multi SoftBlur **not attempted / not claimed** — `BLUR-F39-multi-soft-unlock-retry-RESULT`. **F40 · F41 · F42 · F43 · F44** continuity unlock-retry still keyguard BLOCKED · multi SoftBlur **not claimed** (F45–F60 continuity tables). **F45** unlock-retry still keyguard · AlternateBouncer · serial **43343** · tip **0.1.374/vc382** · multi SoftBlur **not attempted / not claimed** — `BLUR-F45-multi-soft-unlock-retry-RESULT` (~10:36Z). **F46** same gate reconfirm (~10:47Z) · multi SoftBlur **not attempted / not claimed** — `BLUR-F46-multi-soft-unlock-retry-RESULT`. **F47** same gate reconfirm (~10:49Z) · multi SoftBlur **not attempted / not claimed** — `BLUR-F47-multi-soft-unlock-retry-RESULT`. **F48 · F49 · F50 · F51 · F52 · F53** continuity unlock-retry still keyguard BLOCKED · multi SoftBlur **not claimed** (F54–F60 continuity · `BLUR-F48`…`F53-multi-soft-unlock-retry-RESULT`). **F54** unlock-retry still keyguard · AlternateBouncer / fingerprint · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · multipoll + final ~11:46–11:47Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F54-multi-soft-unlock-retry-RESULT`. **F55 · F56** continuity unlock-retry still keyguard BLOCKED · multi SoftBlur **not claimed** (F57–F60 continuity · `BLUR-F55`/`F56-multi-soft-unlock-retry-RESULT`). **F57** unlock-retry still keyguard · AlternateBouncer / fingerprint · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · multipoll + final ~12:15–12:17Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F57-multi-soft-unlock-retry-RESULT`. **F58** unlock-retry still keyguard · AlternateBouncer / fingerprint · serial **43343** · tip **0.1.374/vc382** · multi SoftBlur **not attempted / not claimed** — `BLUR-F58-multi-soft-unlock-retry-RESULT` (~12:26–12:27Z). **F59** same gate reconfirm · multi SoftBlur **not attempted / not claimed** — `BLUR-F59-multi-soft-unlock-retry-RESULT` (~12:36–12:37Z). **F60** unlock-retry still keyguard · AlternateBouncer / fingerprint · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · multipoll + final ~12:45–12:47Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F60-multi-soft-unlock-retry-RESULT`. **F61** unlock-retry still keyguard · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · multipoll + final ~12:56Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F61-multi-soft-unlock-retry-RESULT`. **F62** unlock-retry still keyguard · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · multipoll + final ~13:05–13:07Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F62-multi-soft-unlock-retry-RESULT`. **F63** unlock-retry still keyguard · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · multipoll + final ~13:16Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F63-multi-soft-unlock-retry-RESULT`. **F64** unlock-retry still keyguard · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · multipoll + final ~13:25–13:26Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F64-multi-soft-unlock-retry-RESULT`. **F65** unlock-retry still keyguard · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · multipoll + final ~13:36Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F65-multi-soft-unlock-retry-RESULT`. **F66** unlock-retry still keyguard · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · multipoll + final ~13:45–13:46Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F66-multi-soft-unlock-retry-RESULT`. **F67** unlock-retry still keyguard · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · multipoll + final ~13:55–13:56Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F67-multi-soft-unlock-retry-RESULT`. **F68** unlock-retry still keyguard · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · multipoll + final ~14:06–14:07Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F68-multi-soft-unlock-retry-RESULT`. **F69** unlock-retry still keyguard · focus `NotificationShade` · initial Dozing then after KEYCODE_WAKEUP Awake (keyguard still true · no PIN) · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · DECISION=BLOCKED @ ~**09:16 MDT** (`20260812T151610Z`) · multipoll 151650–151652Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F69-multi-soft-unlock-retry-RESULT`. **F70** unlock-retry still keyguard · focus `NotificationShade` · initial Dozing then after KEYCODE_WAKEUP Awake (keyguard still true · no PIN) · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · DECISION=BLOCKED @ ~**10:16 MDT** (`20260812T161616Z`) · multipoll 161622–161624Z · multi SoftBlur **not attempted / not claimed** — `BLUR-F70-multi-soft-unlock-retry-RESULT` · F71 ≥ ~**11:14 MDT**. Residual: **human unlock** required before Hold / multi / softNative device smoke. Agent 1v1 MATCHED / SoftBlur Hold / multi-pair harness ≠ multi product faces.

| Item | State | Where (skill code map) |
|------|--------|-------------------------|
| Secondary video `track.clone()` + primary keeps real track | **code-shipped** · **human-smoke-open** | `ui/live.js` — `outboundVideoTrackForPc` / `ensureOutboundVideoClone` / `pushOutboundVideoTracks` |
| Audio push must **not** `setLocalStream(preview)` on multi | **code-shipped** · **human-smoke-open** | `pushOutboundAudioTracks` — audio-only replaceTrack |
| Cap 3 opponents (you + 3) | **code-shipped** (verify-only) · optional human | web `strangerCount >= 3`; Android `MAX_EXTRA_PEERS=3`; i18n `log.partyCap` |
| Multi quality: primary mid, extras low; Android Chrome floor **low** (not min) | **code-shipped** · **human-smoke-open** | `applyMultiPeerOutboundQuality` · `webrtc.js` `mobileSafeMultiTier` |
| Layout 3/4-way tiles (`#remote`, `#remote2`, `#remote-third`) | **code-shipped** · **human FAIL `223218Z`** (PC 3-col · Laptop+Partner **black**) + **FAIL `211817Z`** (3-col remotes black · Laptop on main) + **FAIL `084504Z`** + **FAIL `071810Z`** · **no MULTI_PASS** | `live-stage.css` stage-trio / stage-count · CSS tip **v=444** (HTML pin; not MULTI_PASS). **Tile count = people; 2×2 only at 4**. Stop dock = `#stage` child under all tiles in 3/4-way (1v1 still partner-column) |
| Find-3rd hunt soft keep (PC) | **code-shipped** · **human FAIL 2026-08-14** (partner BLACK + Connection weak) · **no MULTI_PASS** | `handleFindThirdResult` → `softKeepPartnerPaint` + `enableTrioLayout` + `bindFirstPartnerToMain` |
| PC Courtier name latch (identity, multi-safe re-paint) | **code-shipped** · **human-smoke-open** | `lastGoodPartnerName` / latch helpers in `live.js` |
| Android find-3rd hunt split (no RTC remount) | **code-shipped** · **human FAIL 2026-08-14** (phone left match → idle Start, 0 online, last Драконов 20s) · **no MULTI_PASS** | `enterHuntingWithPartner` / `huntingWithPartner` / `lookingForThird`; `LiveStageVideo` column mid-split; `multiRemote` only real multi (device tip still **0.1.384 / vc392**) |
| Android 3-way split + Stop labels (parity hop) | **code-shipped** herd `20260814T083341Z` · **human-smoke-open** · **no MULTI_PASS** | Portrait top/bottom remotes + PiP you; `live.tsx` `labels.stop/next` (`btn.stopLeaveThird` / `btn.stopLeaveCall` / `btn.nextStranger`); `LiveBottomBar` paints as-is; tip APK **0.1.384 / vc392** |
| Multi-audio only when real multi | **code-shipped** · **human-smoke-open** | Android `setMultiPeerAudio` iff `nPeers ≥ 2` (`live.tsx`); web multi-audio not on bare `party_browse` |
| MediaSession secondary no-stop shared tracks | **code-shipped** · **human-smoke-open** | `adoptLocalStream` + owned clones; secondary `closeCall({ keepLocal })` must not `stop()` primary preview |
| Human 3-way / 4-way faces paste | **OPEN** — **FAIL `223218Z`** (3-col · Laptop+Partner black · phone 1v1 no-cam toast · android 0/0 bind_v=0) + **FAIL `211817Z`** + **FAIL `084504Z`** + hunt crash + laptop-sees-PC `063259Z` + **black/sliver `071810Z`** · no agent PASS invent | See smoke below · `SMOKE-NEXT` §D · raw `2026-08-14-after-3col-then-black` |
| MX1–MX4 concurrent code audits | **running / no RESULT yet** (this hop) | Do not claim MX1–4 PASS from MX5 docs alone; prior static: BM1 / P0 / BM3 |

**GOAL_MET only** after human smoke (or product.ok on paths that apply). No invented scorecard PASS for multi.

### Code-shipped feature map (skill paths)

| Feature | Code evidence | Smoke gate (human) |
|---------|---------------|-------------------|
| live.js multi clones | `outboundVideoTrackForPc` → `ensureOutboundVideoClone` | Chrome Android local cam ≥60s in 3-way |
| Hunt softKeep (PC) | `softKeepPartnerPaint` after trio accept | partner moves while looking pane shows ≥30s — **FAIL 2026-08-14** partner BLACK |
| Courtier latch | `lastGoodPartnerName` / steal-main latch | name stays real after find-3rd, not sticky Partner/hex |
| Android hunt split | `enterHuntingWithPartner` · `lookingForThird` · column stage | top partner live · bottom looking — **FAIL 2026-08-14** phone dropped to idle Start |
| Multi-audio gate | `nPeers >= 2` before `setMultiPeerAudio` | hunt (1 link) does not thrash multi-audio |
| MediaSession secondary no-stop | `adoptLocalStream` · `mayStopLocal` / owned clones | hang up 3rd; primary cam stays |
| Cap 3 opponents | `strangerCount >= 3` · `MAX_EXTRA_PEERS = 3` · `log.partyCap` | 5th does not steal slot |
| webrtc multi floor | `mobileSafeMultiTier` min→low | mobile encode no freeze under 3–4 way |

Static evidence (not human faces): `BM1-multi-clone-static-RESULT`, `P0-multi-web-verify-RESULT`, `BM3-hunt-layout-golden-RESULT`, `P0-webrtc-multi-recheck-RESULT`, `mediasessionMultiSafety` unit. Harness: `scripts/multi-pair.mjs` / `multi-smoke.mjs` always **SCAFFOLD_DONE** with `multi_product_pass:false`.

---

## Android app × PC browser × Chrome Android — compatibility matrix

**Honest residual:** every row below is **code-shipped intent** until a human pastes faces. No invent PASS.

### Client risk matrix

| Platform | Multi risk | Mitigation (code intent) | Status |
|----------|------------|--------------------------|--------|
| **Chrome Android browser** | Same video `MediaStreamTrack` on 2+ PCs freezes / ends cam mid 3-way | Secondary PCs: `track.clone()`; primary keeps real preview; audio push: **no** shared `setLocalStream(preview)` re-bind | **code-shipped** · **human-smoke-open** |
| **Desktop Chrome (PC browser)** | Usually OK with shared track; thrash under encode stress; trio reflow can freeze decode | Same clone path for secondaries; `softKeepPartnerPaint` after find-3rd; no hard `#remote` null | **code-shipped** · **human-smoke-open** |
| **Android app (RN)** | Closing secondary PC may `stop()` tracks shared with primary; hunt remount freezes PC partner | `adoptLocalStream` / clones; `closeCall({ keepLocal })`; hunt wraps 1v1 `VideoView` (`lookingForThird`), never hunt-only `multiRemote` | **code-shipped** · **human-smoke-open** |
| **Safari iOS** | GUM exclusive; mid-call re-GUM black | **No mid-multi re-GUM** if preview live | **Recommended** — avoid re-GUM thrash |
| **Firefox** | `replaceTrack` quirks | Skip `replaceTrack` when `sender.track === useTrack` | **code-shipped intent** |
| **Encode budget 3–4 way** | `min` tier freezes mobile HW encoders | Floor at **low** on Android Chrome/WebView; primary **mid**, extras **low** | **code-shipped intent** |

### Scenario matrix (what to smoke) — all OPEN

| # | Mix | Pass criteria (human) | Residual |
|---|-----|------------------------|----------|
| **S1** | **PC Chrome offerer ↔ Android app answerer → find-3rd** | 1v1 faces ≥15s; accept hunt; **both** partner videos keep moving ≥30s; PC middle “looking”; Android **top** partner / **bottom** looking | **FAIL 2026-08-14** · hunt lost first partner · phone left match · **no MULTI_PASS** · raw `2026-08-14-multi3-hunt-crash` |
| **S2** | **Android app invite find-3rd → PC accept** | PC `softKeep` partner moves; Android top partner live; no full-screen brand-only on phone | **OPEN** |
| **S3** | **3-way: PC + Android app + PC** | All faces ≥60s both ways; mute once each without cam kill; one leave → no black orphan | **FAIL `223218Z`** (PC 3-col · Laptop+Partner ★31 black · phone 1v1 no-cam toast · android 0/0 bind_v=0) · **FAIL `211817Z`** · **FAIL `084504Z`** · **FAIL** `063259Z` · **FAIL `071810Z`** · re-smoke **OPEN** · **no MULTI_PASS** |
| **S4** | **3-way: PC + Chrome Android browser + PC** | Chrome Android **local cam** live ≥60s after 3rd (clone path); faces all tiles | **OPEN** (highest browser risk) |
| **S5** | **3-way: Android app + Chrome Android + PC** | Mixed mobile stacks; both mobile cams stay live; app hunt split if find-3rd used | **OPEN** |
| **S6** | **4-way (you + 3 remotes)** any mix | 4 tiles painted; no permanent black orphan; mobile encode not frozen; 5th hits partyCap | **OPEN** (stretch) |
| **S7** | **Chrome Android browser multi only** (no app) | Local cam stays after 2nd PC joins; no shared-track freeze | **OPEN** |

**Agent note:** web2 multi-pair harness may boot + 1v1-hint only; find_third / hunt / multi_pc often **false** within budget — still **not** MULTI_PASS (`L26-multi-pair-find3rd-RESULT`, `L28-multi-pair-web2-RESULT` SCAFFOLD_DONE only).

---

## Code map (do not dual-edit blindly)

| Concern | Primary file | Lane (MULTI-CROSS) |
|---------|--------------|--------------------|
| Clone / joinPeers / quality / no audio re-bind video / softKeep / Courtier | `ui/live.js` | **MX1** multi-media-web |
| setLocalStream safety, replaceTrack, closeCall keepLocal, multi floor | `ui/webrtc.js` | **MX3** multi-webrtc |
| 2×2 / trio tiles, orphan black panes | `ui/live-stage.css`, `ui/live.html` | **MX4** multi-layout |
| Secondary adopt, multiPeerAudio, stage streams, hunt wrap | `MediaSession.ts`, `LiveStageVideo.tsx`, `live.tsx`, `stageStreams.ts`, `matchPeers.ts` | **MX2** multi-android |
| Matrix, smoke, honesty | this page + `SMOKE-NEXT` §D | **MX5** multi-compat (you are here) |

### Skill code map (cite, don't thrash)

| Concern | Path |
|---------|------|
| Hunt + multi stage | `mobile/src/live/LiveStageVideo.tsx`, `liveStyles.ts`, `stageStreams.ts` |
| lookingForThird / hunt enter | `mobile/app/live.tsx` — `enterHuntingWithPartner`, `huntingWithPartner` |
| Multi audio gate | `live.tsx` Matched · `MediaSession.setMultiPeerAudio` only if `nPeers≥2` |
| Android cap / extras | `mobile/src/live/matchPeers.ts` — `MAX_EXTRA_PEERS` |
| Android secondary media | `mobile/src/media/MediaSession.ts` — `adoptLocalStream`, owned clones |
| Web clones / push | `ui/live.js` — `outboundVideoTrackForPc`, `ensureOutboundVideoClone`, `pushOutboundVideoTracks`, `healMultiPeerLocalCamera` |
| Web quality floor | `applyMultiPeerOutboundQuality` · `webrtc.js` `mobileSafeMultiTier` |
| PC trio + softKeep | `handleFindThirdResult` → `softKeepPartnerPaint`, `enableTrioLayout`, `bindFirstPartnerToMain` |
| WebRTC multi safety | `ui/webrtc.js` — preview stop guards, Android min→low |

## MUST NOT (multi thrash)

- Share one video track across 2+ PCs on Chrome Android  
- `setLocalStream(full preview)` from audio-only push on multi  
- Mid-call second `getUserMedia` while primary preview live (esp. Safari / Android)  
- `closeCall` on secondary stopping tracks still used by primary (`keepLocal` / `!localStreamOwned`)  
- Floor multi extras at **min** on mobile Chrome HW  
- ICE thrash: `iceCandidatePoolSize > 0`, force_relay flip, pool growth  
- **`force_relay=false` on same public IP / same Wi-Fi** (host hairpin black; Relayed = designed FRA TURN, not lost P2P)  
- **`closeAllPeers` rematch** when extra peer bye/stop — close only that PC; survivor stays (3rd-leave keep)  
- Parallel writers on `live.js` / MediaSession without lane OWN  
- Claim multi fixed without human 3-way faces  
- **Unmount partner RTCView** when entering find-3rd hunt (`multiRemote` for hunt-only)  
- Enable multi-audio solely because `party_browse` (need `nPeers ≥ 2`)  
- Invent product PASS / GOAL_MET / MULTI_PASS from agent verify or harness alone  
- Treat SoftBlur Hold 1v1 evidence as multi SoftBlur PASS  

---

## Smoke (human) — find-3rd + 3-way + 4-way

Agents do **not** invent PASS. Paste results into chat / wiki log / `SMOKE-NEXT` §D.

**Hard-refresh PC:** `live.js?v=629` · `webrtc.js?v=326` · stage **v=444** · brand **v=19** · i18n **v=252** (re-read `ui/live.html` this hop · herd `20260814T223413Z`). **Human rsync first** if a later hop bumps pins. Tab that failed `223218Z` is **prod** — 3-col ≠ faces.  
**Install APK:** **do not invent this hop** — device FAIL **0.1.392** (session disk **vc400**) · extra-tile split not on phone.  
Prefer same-WiFi **FRA TURN** (`force_relay`) path for 1v1 baseline first — relayed ≠ broken P2P. Multi SoftBlur device needs **unlocked** phone (F17–F70 keyguard-blocked · serial 43343 · tip 0.1.374; F19s static wiring OK only; F71 ≥ ~11:14 MDT).

### Devices

- **PC:** Chrome (desktop) hard-refresh live cache  
- **Phone browser:** Chrome Android (same origin as PC live)  
- **App:** Android RN **0.1.371-vc379+** with multi-peer secondary + find-3rd hunt split  

### Find-3rd hunt (1 media link) — primary cross gate

Run **S1** and **S2** if both directions available.

1. Start **1v1** PC ↔ Android app (or PC ↔ Chrome Android); both faces live **≥15s**.  
2. Find-third invite → **accept**.  
3. **PC:** partner still **moving**; middle “looking for a 3rd” brand (`enableTrioLayout` searching + `softKeepPartnerPaint`).  
4. **Android app:** **top** partner moving; **bottom** looking brand (column mid-split — **not** full-screen brand only, **not** PC-style side-by-side in portrait).  
5. No cam freeze **≥30s** while hunting.  
6. 3rd joins → looking / third pane becomes their video; **first partner still live**.  

### 3-way (you + 2 remotes) — primary product gate

Prefer **S3** (app) and **S4** (Chrome Android) separately.

1. Stable 1v1 first (faces ≥15s), then third joins (party / find-3rd / friend — product path you use).  
2. **Chrome Android (if phone is browser):** local camera stays live **≥60s** after 3rd joins — no freeze/black self (clone path).  
3. **Android app:** local + remotes paint; secondary hangup does not kill primary cam (`adoptLocalStream` / keepLocal).  
4. All three see each other’s faces both directions (spot-check each tile).  
5. Mute/unmute mic once on each client — remotes stay **video**-live (audio path must not re-kill video).  
6. One party leaves — remaining two stay up; no orphan black tile forever. **3rd-leave keep is the disk hop** this herd (`20260814T085708Z`) — **not** human PASS / **not** product.ok.  

### 4-way (you + 3 remotes) — stretch

1. Reach 4 people total (cap = 3 opponents).  
2. Layout shows all remotes + local; **no permanent black orphan**.  
3. Mobile (app or Chrome Android): cam does **not** freeze from encode budget (if freeze → quality floor, not ICE).  
4. Fifth stranger should hit partyCap log (“max 3 opponents (you+3)…”) and not steal a slot.  

### Report paste

```text
MULTI smoke date:
  devices: PC Chrome | phone Chrome Android | app APK=do-not-invent (device FAIL 0.1.392)
  live.js?v=629 / webrtc.js?v=326 / live-stage.css?v=444 / live-brand.css?v=19 / i18n.js?v=252
find-3rd hunt:
  scenario: S1 PC→app | S2 app→PC | other
  pc_partner_moves: pass|fail|n/a
  android_top_partner_bottom_looking: pass|fail|n/a
  no_freeze_30s: pass|fail
  third_joins_first_partner_live: pass|fail|n/a
3-way:
  mix: S3 app | S4 chrome-android | S5 mixed
  cam_live_60s_chrome_android: pass|fail|n/a
  cam_live_app: pass|fail|n/a
  faces_all_directions: pass|fail
  mute_no_video_kill: pass|fail
  leave_no_orphan_black: pass|fail
4-way:
  layout_all_tiles: pass|fail|n/a
  encode_no_freeze_mobile: pass|fail|n/a
  partyCap_blocks_5th: pass|fail|n/a
Notes: …
GOAL_MET multi: yes|no  (human only)
```

---

## Related

- Spec: [`current-multi-party.md`](../specs/current-multi-party.md)  
- See-everyone layout lock: [`2026-08-14-3way-see-everyone.md`](../specs/2026-08-14-3way-see-everyone.md)  
- Android browser parity: [`2026-08-14-android-browser-parity.md`](../specs/2026-08-14-android-browser-parity.md)  
- Cross plan P5: [`MULTI-CROSS-IMPROVE-PLAN.md`](../specs/MULTI-CROSS-IMPROVE-PLAN.md)  
- Finish residual: [`FINISH-PLAY-MULTI.md`](../specs/FINISH-PLAY-MULTI.md)  
- Gotchas: [gotchas.md](gotchas.md) multi items **20–23** · skip/stop **29** · mesh cost **39** · hub 3rd-offer debounce **40** · 2×2-only-at-4 / double-PC **41** · 3/4-way floor dock **42** · MATCHED hunt-chrome mid **43** · 3rd-leave keep **44** · iPhone-isolate + role note **49** · laptop 3-col vs PC 2-col **ROLE** **50** · hunt-keep / no-cam cover / laptop miss **59**  
- 1v1 A/V layers: [one-way-video.md](one-way-video.md)  
- Mobile UX (blur / no unmount): [mobile-ux.md](mobile-ux.md)  
- ICE locks: [force-relay-same-lan.md](force-relay-same-lan.md) — lock stays; Relayed same-LAN = FRA TURN; never force_relay=false on same IP; pool=0  
- Keep-pair spec: [`2026-08-14-keep-pair-no-relink.md`](../specs/2026-08-14-keep-pair-no-relink.md) — **disk hop** · no product.ok invent  
- Skill: `.grok/skills/multi-party-stage/SKILL.md`

### Log

- 2026-08-20 wiki compound (task 543): 3-way leftover **PC good, Android good, laptop still no Android cam** — extra Android↔laptop link stuck `ice=checking` **0/0** offerer=0, same pattern as `20260819T195239Z` (raw [`2026-08-19-3way-laptop-no-android.md`](../raw/2026-08-19-3way-laptop-no-android.md)); the PC↔laptop and PC↔Android pairs each connect fine, only the extra laptop↔Android link is dead. Late-offer kick `armMeshLateOfferKicks` (`ui/live.js` **862**) still does not clear it — same gap as pin **834** on 2026-08-19. Find-3rd Matched reconfirmed **not** hardcoding `force_relay:false` — sends `pair_force_relay(me, them)` (`bridge/src/simple.rs` `handle_find_third_respond`); lock intact, see [force-relay-same-lan.md](force-relay-same-lan.md). **No MULTI_PASS** / **no product.ok invent**.
- 2026-08-20: friend **phone call stays 1v1** until Find 3rd accept (gotcha **66**). Instant browse_together off. Disk **live.js 844+**. Hub reject needs **deploy**. **No MULTI_PASS.**
- 2026-08-15 p-wiki (herd `20260815T202150Z`): **FAIL `201649Z`** — hunt-keep **HELD** (do not remount RTC). Android two-stack OK; PC cam then NoCamPortrait covered top Драконов; laptop same Chrome sees PC not Android (`answers < offers`, ice=new 0/0) ≠ Chrome-version. Leftover product.ok is **1v1**. Gotcha **59**. Spec [`2026-08-15-3way-held-nobreak.md`](../specs/2026-08-15-3way-held-nobreak.md). **No MULTI_PASS** / **no product.ok invent**.
- 2026-08-14 n-wiki (herd `20260814T223413Z`): **FAIL `223218Z`** — PC **3-col** Laptop **black** · Partner ★31 **black** · you live. Phone **1v1** no-cam toast “Still no video…” · Partner ★0 · no split. av-verify `223227Z` product **one-way** web 767/774 · android **0/0** bind_v=**0** app_vc=400. Pins re-read `ui/live.html`: `live.js?v=629` · `webrtc.js?v=326` · stage **444**. Raw [`../raw/2026-08-14-after-3col-then-black.md`](../raw/2026-08-14-after-3col-then-black.md). **No MULTI_PASS** / **no product.ok invent**.
- 2026-08-14 q-wiki (herd `20260814T221627Z`): **FAIL `221232Z`** — this PC **2-col** vs laptop **3-col** is **ROLE** (YOU Laptop vs a pair vs YOU Драконов 1v1), **not** a different app. Phone `221222Z` still **1v1** Laptop ★31 **black**. Raw [`../raw/2026-08-14-laptop-vs-pc-chrome-3way.md`](../raw/2026-08-14-laptop-vs-pc-chrome-3way.md). Gotcha **49** note / **50**. **No MULTI_PASS** / **no product.ok invent**.
- 2026-08-14 p-wiki (herd `20260814T212123Z`): **FAIL `211817Z`** — PC **3-col works** · Laptop+Courtier **black** · occupancy **Laptop on main** · phone still **1v1 0.1.392**. Pins re-read `ui/live.html`: `live.js?v=624` · `webrtc.js?v=325` · stage **439** · brand **19** · i18n **252**. This herd **p-web** / **p-html** / **p-css** / **p-and**. Raw [`../raw/2026-08-14-3way-624-shots.md`](../raw/2026-08-14-3way-624-shots.md). Spec [`../specs/2026-08-14-finish-3way-4way.md`](../specs/2026-08-14-finish-3way-4way.md). **No MULTI_PASS** / **no product.ok invent**.
- 2026-08-14 keep-wiki (herd `20260814T085708Z`): **3rd-leave keep remaining pair is this disk hop** — extra bye closes only that PC; survivor `srcObject` / RTCView stays; layout 3→2; Android extra hangup must not `startCall` primary. Same-Wi-Fi Relayed = designed **FRA TURN** (`CONNECTIVITY_LOCK`); signaling still **mesh P2P**, **not SFU**; **never** `force_relay=false` on same IP. Spec [`2026-08-14-keep-pair-no-relink.md`](../specs/2026-08-14-keep-pair-no-relink.md). Gotcha **44**. Human 3-way faces still **OPEN**. **No MULTI_PASS** / **no product.ok invent**.
- 2026-08-14 b-wiki (herd `20260814T084616Z`): **FAIL `084504Z`** — PC left Courrier **black** · mid hunt **Find 3rd** on MATCHED 3-way · **you sliver** · no conversationalist cams / no sound. Phone 1v1 Partner ★0 **black** · app_vc **392**. av-verify `084452Z` product **one-way** · android **0/0** ice checking · offers=3 answers=2. Tab is **prod** — **rsync required**. Pins re-read `ui/live.html` after sibling wait: `live.js?v=598` · `webrtc.js?v=324` · stage **414** · brand **16** · i18n **252**. Spec [`2026-08-14-3way-messed-novideo.md`](../specs/2026-08-14-3way-messed-novideo.md). Gotcha **43**. **No MULTI_PASS** / **no product.ok invent**.
- 2026-08-14 and-wiki (herd `20260814T083341Z`): **Android 3-way split + Stop contract on disk** — portrait top/bottom remotes · PiP = you · hunt wrap (no remount first RTCView) · 2×2 only at 4 · Stop/Next labels pair+3rd = Next stranger / **Leave 3rd** · you-are-3rd = Next / **Leave call** · 1v1 = Next / Stop. Spec [`2026-08-14-android-browser-parity.md`](../specs/2026-08-14-android-browser-parity.md). Tip APK still **0.1.384 / vc392** (director bumps after `--bump` — do not invent vc). Human 3-way faces still **OPEN**. **No MULTI_PASS** / **no product.ok invent**.
- 2026-08-14 fin-wiki (herd `20260814T082214Z`): **floor-dock honesty** — 3/4-way Stop/Next/chat is a **`#stage` child under all tiles** (reserved `--stage-dock-h` band; not tile-1 overlay). **1v1 still partner-column**. **2×2 only at 4**. Pins re-read `ui/live.html`: `live.js?v=598` · `webrtc.js?v=324` · stage **413** · brand **16** · i18n **252**. Gotcha **42**. Human 3-way faces still **OPEN**. **No MULTI_PASS** / **no product.ok invent**.
- 2026-08-14 see-wiki (herd `20260814T080020Z`): **layout lock** — tile count **equals people**; **2×2 only at 4**. Table: 2→2 no 2×2 · 3→3 no 2×2 · 4→4 yes. FAIL residual: laptop **double-PC** / no Android; Android black 1v1 leftover `075019Z` + not seeing both in 3-way; PC missing volume / loc / one ★. Spec [`2026-08-14-3way-see-everyone.md`](../specs/2026-08-14-3way-see-everyone.md). Pins re-read `ui/live.html` after sibling wait: `live.js?v=596` · `webrtc.js?v=324` · stage **412** · brand **16** · i18n **251**. Gotcha **41**. Rsync checklist on this page. **No MULTI_PASS** / **no product.ok invent**.
- 2026-08-14 p-wiki (herd `20260814T072031Z`): **FAIL `071810Z`** — left Laptop **black** · mid Laptop + **Stranger · AC8BEC2F** dark · **you sliver** · hub **offers=2 answers=1**. av-verify `071744Z` product.ok is **1v1 leftover**. Disk hop **p-hub** (per-target offer debounce) **needs deploy**. Pins re-read `ui/live.html`: `live.js?v=594` · `webrtc.js?v=324` · stage **410** · brand **16** · i18n **251**. Raw [`../raw/2026-08-14-3way-now-black.md`](../raw/2026-08-14-3way-now-black.md). **No MULTI_PASS.**
- 2026-08-14 trio-wiki (herd `20260814T065106Z`): mesh honesty — **4 people = 6 P2P links**, each client **3 PCs**; same-LAN **FRA TURN** (`force_relay`) ≠ broken P2P; cap **3 opponents (you+3)**. Disk pins re-read `ui/live.html`: `live.js?v=593` · `webrtc.js?v=323` · stage **409** · brand **16**. Human 3-way faces still **OPEN**. Hunt crash + laptop-sees-PC FAILs still residual. **No MULTI_PASS.**
- 2026-08-14 residual (multi3 hunt crash): **FAIL · NO MULTI_PASS** — USB Pixel serial **45141FDAP0004F** (pid **alive**, not native crash) + 2 Chrome tabs; phone [crash3-phone](../../artifacts/shots/20260814T030641Z-crash3-phone.png) idle **Start** / **0 online** / last **Драконов 20s**; PC [crash3-pc](../../artifacts/shots/20260814T030641Z-crash3-pc.png) trio hunt, partner **BLACK**, **Connection weak — reconnecting...**, other tab still hunting. Hunt lost first partner; phone left match. 1v1 product.ok `025100Z` ≠ this. Raw [`../raw/2026-08-14-multi3-hunt-crash.md`](../raw/2026-08-14-multi3-hunt-crash.md). Herd `20260814T030939Z` hunt-wiki. **Do not invent MULTI_PASS.**
- 2026-08-12 residual (F70b continuity): multi SoftBlur device still **OPEN / NOT claimed** — **F17–F70 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw + residual already current from F70; **F70 BLOCKED COMPLETE (keyguard)** @ ~**10:16 MDT** unchanged; CONN-idle F70b stamped · hop ~**10:25 MDT** still before gate · **NOT** promote F71; **F71 ≥ ~11:14 MDT** (STOP; or human unlock; F71 backlog; no invent multi PASS). Sources: `BLUR-F70-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F70-note-RESULT`, `CONN-idle-green-F70b-RESULT`.
- 2026-08-12 residual (F70): multi SoftBlur device still **OPEN / NOT claimed** — **F17–F70 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); **F70 BLOCKED COMPLETE (keyguard)** @ ~**10:16 MDT** (`20260812T161616Z`) · NotificationShade · Dozing→Awake after WAKEUP only · keyguard still true · no Hold/multi/softNative/Sink · artifacts `f70-blur/`; raw `knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F70.md`; **F71 ≥ ~11:14 MDT** (STOP; or human unlock; no invent multi PASS). Sources: `BLUR-F70-multi-soft-unlock-retry-RESULT` (primary), F17–F69 continuity.
- 2026-08-12 residual (F69b continuity): multi SoftBlur device still **OPEN / NOT claimed** — **F17–F69 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw + residual already current from F69; **F69 BLOCKED COMPLETE (keyguard)** @ ~**09:16 MDT** unchanged; director ~**09:35 MDT** still keyguard/Dozing; **F70 ≥ ~10:14 MDT** (STOP; or human unlock; F70 backlog; no invent multi PASS). Sources: `BLUR-F69-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F69-note-RESULT`, `CONN-idle-green-F69b-RESULT`.
- 2026-08-12 residual (F69): multi SoftBlur device still **OPEN / NOT claimed** — **F17–F69 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); **F69 BLOCKED COMPLETE (keyguard)** @ ~**09:16 MDT** (`20260812T151610Z`) · NotificationShade · Dozing→Awake after WAKEUP only · keyguard still true · no Hold/multi/softNative/Sink · artifacts `f69-blur/`; raw `knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F69.md`; **F70 ≥ ~10:14 MDT** (STOP; or human unlock; no invent multi PASS). Sources: `BLUR-F69-multi-soft-unlock-retry-RESULT` (primary), F17–F68 continuity.
- 2026-08-12 residual (F68f continuity): multi SoftBlur device still **OPEN / NOT claimed** — **F17–F68 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw + residual already current from F68/F68b/F68c/F68d/F68e; still keyguard as of **09:05 probe**; **F69 unlock recheck ≥ ~09:08 MDT** (STOP; or human unlock; F69+ backlog; no invent F69/multi PASS). Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F68-note-RESULT`, `WIKI-keyguard-F68b-note-RESULT`, `WIKI-keyguard-F68c-note-RESULT`, `WIKI-keyguard-F68d-note-RESULT`, `WIKI-keyguard-F68e-note-RESULT`.
- 2026-08-12 residual (F68e continuity): multi SoftBlur device still **OPEN / NOT claimed** — **F17–F68 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw + residual already current from F68/F68b/F68c/F68d; **F69 unlock recheck ≥ ~09:08 MDT** (or human unlock; F69+ backlog; no invent F69/multi PASS). Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F68-note-RESULT`, `WIKI-keyguard-F68b-note-RESULT`, `WIKI-keyguard-F68c-note-RESULT`, `WIKI-keyguard-F68d-note-RESULT`.
- 2026-08-12 residual (F68d continuity): multi SoftBlur device still **OPEN / NOT claimed** — **F17–F68 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw + residual already current from F68/F68b/F68c; **F69 unlock recheck ≥ ~09:08 MDT** (or human unlock; F69+ backlog; no invent F69/multi PASS). Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F68-note-RESULT`, `WIKI-keyguard-F68b-note-RESULT`, `WIKI-keyguard-F68c-note-RESULT`.
- 2026-08-12 residual (F68c continuity): multi SoftBlur device still **OPEN / NOT claimed** — **F17–F68 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw + residual already current from F68/F68b; **F69 unlock recheck ≥ ~09:08 MDT** (or human unlock; F69+ backlog; no invent F69/multi PASS). Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F68-note-RESULT`, `WIKI-keyguard-F68b-note-RESULT`.
- 2026-08-12 residual (F68b continuity): multi SoftBlur device still **OPEN / NOT claimed** — **F17–F68 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw `knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F68.md`; residual already current from F68 note; **no invent multi SoftBlur PASS**. Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F68-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F68 BLOCKED** keyguard PIN / AlternateBouncer / AOD · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F58–F67** continuity keyguard · **F68** unlock-retry still gate-blocked (~14:06–14:07Z · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT` (primary), F17–F67 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F67-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F67 BLOCKED** keyguard PIN / AlternateBouncer / AOD · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F58–F66** continuity keyguard · **F67** unlock-retry still gate-blocked (~13:55–13:56Z · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F67-multi-soft-unlock-retry-RESULT` (primary), F17–F66 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F66-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F66 BLOCKED** keyguard PIN / AlternateBouncer / AOD · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F58–F65** continuity keyguard · **F66** unlock-retry still gate-blocked (~13:45–13:46Z · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F66-multi-soft-unlock-retry-RESULT` (primary), F17–F65 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F65-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F65 BLOCKED** keyguard PIN / AlternateBouncer / AOD · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F58–F64** continuity keyguard · **F65** unlock-retry still gate-blocked (~13:36Z · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F65-multi-soft-unlock-retry-RESULT` (primary), F17–F64 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F64-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F64 BLOCKED** keyguard PIN / AlternateBouncer / AOD · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F58–F63** continuity keyguard · **F64** unlock-retry still gate-blocked (~13:25–13:26Z · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F64-multi-soft-unlock-retry-RESULT` (primary), F17–F63 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F63-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F63 BLOCKED** keyguard PIN / AlternateBouncer / AOD · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F58–F62** continuity keyguard · **F63** unlock-retry still gate-blocked (~13:16Z · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F63-multi-soft-unlock-retry-RESULT` (primary), F17–F62 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F62-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F62 BLOCKED** keyguard PIN / AlternateBouncer / AOD · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F58–F61** continuity keyguard · **F62** unlock-retry still gate-blocked (~13:05–13:07Z · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F62-multi-soft-unlock-retry-RESULT` (primary), F17–F61 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F61-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F61 BLOCKED** keyguard PIN / AlternateBouncer / AOD · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F58–F60** continuity keyguard · **F61** unlock-retry still gate-blocked (~12:56Z · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F61-multi-soft-unlock-retry-RESULT` (primary), F17–F60 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F60-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F60 BLOCKED** keyguard PIN / AlternateBouncer · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F55–F59** continuity keyguard · **F60** unlock-retry still gate-blocked (~12:45–12:47Z · AlternateBouncer / fingerprint · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F60-multi-soft-unlock-retry-RESULT` (primary), F17–F59 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F57-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F57 BLOCKED** keyguard PIN / AlternateBouncer · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F55–F56** continuity keyguard · **F57** unlock-retry still gate-blocked (~12:15–12:17Z · AlternateBouncer / fingerprint · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F57-multi-soft-unlock-retry-RESULT` (primary), F17–F56 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F54-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F54 BLOCKED** keyguard PIN / AlternateBouncer · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F48–F53** continuity keyguard · **F54** unlock-retry still gate-blocked (~11:46–11:47Z · AlternateBouncer / fingerprint · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F54-multi-soft-unlock-retry-RESULT` (primary), F17–F53 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F47-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F47 BLOCKED** keyguard PIN / AlternateBouncer · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F40–F44** continuity keyguard · **F45/F46/F47** unlock-retry still gate-blocked · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F45/F46/F47-multi-soft-unlock-retry-RESULT` (primary), F17–F44 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F39-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F39 BLOCKED** keyguard PIN / AlternateBouncer · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F30–F36** continuity keyguard · **F37/F38/F39** unlock-retry still gate-blocked · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F37/F38/F39-multi-soft-unlock-retry-RESULT` (primary), F17–F36 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F29-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F29 BLOCKED** keyguard PIN / AlternateBouncer · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F25–F27** continuity keyguard · **F28/F29** unlock-retry still gate-blocked · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F17…F29-*-RESULT` (F28/F29 primary), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F24-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F24 BLOCKED** keyguard PIN / AlternateBouncer · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F23/F24** unlock-retry still gate-blocked · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F17…F24-*-RESULT`, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F21 BLOCKED** keyguard PIN / AlternateBouncer · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); **F20/F21** unlock-retry still gate-blocked · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F17/F18/F19/F20/F21-*-RESULT`, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F19 BLOCKED** keyguard PIN · serial **43343** · tip **0.1.374-vc382**; **F19s static OK** (wiring + flag intact · not device PASS); human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F17/F18/F19-*-RESULT`, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`.
- 2026-08-12 morning compound: tip pins re-read **`live.js?v=572`** / stage **393** / brand **16**; multi SoftBlur device **BLOCKED** F17 (keyguard · SCAFFOLD_DONE web2phone · phone peers=0) + F18 reconfirm still keyguard — **NOT claimed**; Soft 1v1 closed incl. F16b on **0.1.374-vc382**; CONN product.ok 1v1 ≠ multi PASS; human multi smoke **OPEN**. Sources: `BLUR-F17/F18-*-RESULT`, `CONN-smoke-phone-avpath-RESULT`.
- 2026-08-12 overnight-2 compound: tip pins re-read **`live.js?v=572`** / stage **392** / brand **16**; multi SoftBlur still **OPEN**; multi-pair **SCAFFOLD only** (`L28-multi-pair-web2-RESULT`); Soft 1v1 matrix closed agent-side (F11–F14 on 371, F15 Hold on 373) ≠ multi soft; human multi smoke **OPEN** (no PASS invent).
- 2026-08-12 **MX5:** Android app × PC browser × Chrome Android scenario matrix **S1–S7** + find-3rd/3/4-way human steps; then-tip **0.1.371-vc379** / `live.js?v=571` / stage **391** / brand **16** / webrtc **315**; features **code-shipped** · human multi smoke **OPEN** (no PASS invent). MX1–MX4 RESULTs later same night. Cite skill paths + prior static BM1/P0/BM3.
- 2026-08-12 agent phone: 1v1 MATCHED×2 + Friends/Settings ALIVE on **0.1.366-vc374** — multi 3/4-way still **OPEN** (no agent PASS invent).
- 2026-08-12 W4 stamp: disk **0.1.366-vc374** / `live.js?v=561` / `webrtc.js?v=315` / stage **v=385**; features **code-shipped** (clones · softKeep · Courtier · Android hunt · MediaSession secondary no-stop · cap 3) — human multi smoke **OPEN** (no PASS invent).
- 2026-08-12 stamp: ship tip **0.1.365-vc373** / `live.js?v=561` / `webrtc.js?v=315` / stage **v=384**; multi + hunt + Courtier still **shipped on disk** — human smoke **open** (no PASS invent).
- 2026-08-12 polish: ship stamps **0.1.363-vc371** / `live.js?v=559` / `webrtc.js?v=315` / stage **v=382**; hunt split Android + Courtier name latch marked **shipped on disk** (human smoke still **open**).
- 2026-08-12: multi-compat lane — matrix + smoke created; clone path marked **shipped** from live.js intent; human multi smoke **open**.
