# Human smoke checklist — next product hop

> **Agents: do not load this file at session start.** Human paste-back only. Picture = `knowledge/wiki/now.md`. After an APK bump, update the **install version string** here and stop.

> Install (from `now.md`): APK **0.1.480-vc488** · live.js **985** · webrtc **356** · stage **655** · brand **24** · i18n **267**. Site APK still **0.1.475**.  
> **No agent PASS / GOAL_MET / MULTI_PASS.** `SCAFFOLD_DONE ≠ MULTI_PASS`. Pin match ≠ body deploy parity.  
> Verbose F17–F70 keyguard dump: [`archive/SMOKE-NEXT-F17-F70-dump.md`](archive/SMOKE-NEXT-F17-F70-dump.md).

## Agent notes (not human PASS)

1v1 CONN **product.ok** on tip **0.1.374-vc382** is connect only — not multi / blur GOAL_MET. SoftBlur 1v1 Off/Intro/Hold was agent-evidenced on **371/373/374**. Multi SoftBlur device smoke **never claimed** (F17–F70 keyguard BLOCKED). Overnight unlock retries **stopped**. Do not chain adb unlock.

## A. Install

- [ ] APK: `mobile/artifacts/ruletka-latest.apk` (**0.1.480-vc488** icons + it/id; site still 0.1.475)
- [ ] If phone on adb: `build-apk-local.sh` may auto-push to Download/
- [ ] Web PC: hard-refresh → **`live.js?v=985`** + **`webrtc.js?v=356`** + **`live-stage.css?v=655`** + **`live-brand.css?v=24`** + **`i18n.js?v=267`** (match `ui/live.html` / `now.md`)
- [ ] Same-WiFi force_relay pure path as usual

## B. Mobile UX (`current-mobile-ux`)

- [ ] **1. Name:** Partner name (or short-id fallback) visible mid-match — dock under stage and/or top chrome
- [ ] **2. Stars:** ★ readable (real number or 0 dimmed; trust chip if trust>0)
- [ ] **3. Location:** flag/country/city after match when browser shows loc — not stuck “Looking up…”; hide_ip → Location hidden
- [ ] **4. Local blur:** mid-tone mosaic (not pure black); Show video / unblur works; app does not crash on match
- [ ] **5. Partner Hide (browser):** Android “Partner hidden” mosaic not pure black
- [ ] **6. Mute:** at most one they-muted surface (prefer bottom banners)
- [ ] **7. Bottom chrome:** Stop · Report · Next usable; swipe-to-next if wired

## C. Linking speed (`current-linking-speed`) — stretch after UX green

### C0. Residual baseline (historical CONN **20260812T064214Z** — do not invent GOAL_MET)

| Metric | Value |
|--------|--------|
| product | **ok** (web **670/776** · android **756/678**) — **1v1 only** |
| max_mto / max_mta | **1895** / **3122** ms |
| fr_mismatch | **false** (policy=relay) |
| app_vc | **382** on that stamp — disk now **488** |

### C1. Re-smoke

- [ ] **1. PC hard-refresh** — **`live.js?v=985`** + **`webrtc.js?v=356`**
- [ ] **2. Install APK** `mobile/artifacts/ruletka-latest.apk` (**0.1.480-vc488**)
- [ ] **3. Start once** — same-WiFi force_relay pure; one clean match (no dual thrash / pool)
- [ ] **4.** Linking ends without multi-second freeze feel after match
- [ ] **5.** Journal: note max **mto / mta** vs residual **1895 / 3122** (optional `./scripts/hub-match-speed.sh`)
- [ ] **6.** `./scripts/av-verify.sh` — **product.status=ok** required for any speed GOAL_MET
- [ ] **7.** Prefer fr_mismatch clear (android **policy=relay** when hub force_relay)
- [ ] **8.** **No GOAL_MET** without product.ok after this ship — residual alone is not enough

## D. Multi-party 3-way / 4-way (`current-multi-party`)

Cap: **you + 3 opponents**. Mesh **not SFU**. Same-LAN = hub `force_relay` → FRA coturn. Wiki: [`../wiki/multi-party.md`](../wiki/multi-party.md). Skill **`multi-party-stage`**. Hunt-keep **HELD**. **SCAFFOLD_DONE ≠ MULTI_PASS.** Human 3-way faces still **OPEN**. Agents must not invent PASS.

### Cross-platform matrix (**no MULTI_PASS**)

| ID | Mix | Human pass criteria | Status |
|----|-----|---------------------|--------|
| **S1** | PC Chrome ↔ **Android app** → find-3rd | Both partners move ≥30s; PC middle looking; Android top partner / bottom looking | **FAIL 2026-08-14** · re-smoke **OPEN** |
| **S2** | **Android app** invite find-3rd → PC accept | PC softKeep partner moves; Android top partner live | **OPEN** |
| **S3** | 3-way **PC + Android app + PC** | Faces ≥60s both ways; mute no cam-kill; leave no orphan | **FAIL** (`084504Z` / `063259Z` / `071810Z`) · re-smoke **OPEN** |
| **S4** | 3-way **PC + Chrome Android + PC** | Chrome Android **local cam** ≥60s after 3rd | **OPEN** |
| **S5** | 3-way **app + Chrome Android + PC** | Both mobile cams live; tiles both ways | **OPEN** |
| **S6** | 4-way any mix | 4 tiles; no black orphan; encode no freeze; partyCap blocks 5th | **OPEN** |
| **S7** | Chrome Android multi only | Local cam stays after 2nd PC joins | **OPEN** |

### Devices

- [ ] **PC** Chrome — hard-refresh `live.js?v=985` / `webrtc.js?v=356` / stage **655** / brand **24** / i18n **267**
- [ ] **Phone browser** Chrome Android same origin
- [ ] **Android app** APK **0.1.480-vc488**

### Find-3rd hunt (1 media link)

- [ ] **1.** 1v1 PC ↔ app (or PC ↔ Chrome Android) faces live **≥15s**
- [ ] **2.** Find-third invite → accept
- [ ] **3. PC:** partner still **moving**; middle “looking for a 3rd” brand
- [ ] **4. Android app:** **top** partner moving; **bottom** looking brand (column mid-split)
- [ ] **5.** No cam freeze **≥30s** while hunting
- [ ] **6.** 3rd joins → looking/third becomes their video; first partner still live

### 3-way (you + 2 remotes)

- [ ] **1.** 1v1 stable first (both faces ≥15s), then third joins
- [ ] **2. Chrome Android cam (S4/S7):** local camera stays live **≥60s** after 3rd joins
- [ ] **3. Android app (S3/S5):** remotes + local paint; hang up 3rd does not kill primary cam
- [ ] **4.** All tiles show faces both ways
- [ ] **5.** Mute/unmute mic once per client — video stays live
- [ ] **6.** One peer leaves — remaining stay up; no permanent black orphan tile

### 4-way (you + 3 remotes) — stretch

Mesh: **4 people = 6 P2P links**. Cap **3 opponents (you+3)**.

- [ ] **1.** Layout shows all remotes + local (no permanent black orphan)
- [ ] **2.** Mobile browser/app: cam does **not** freeze under encode load
- [ ] **3.** Fifth stranger hits partyCap and does not steal a slot

### Multi report paste

```text
MULTI smoke:
  devices: PC Chrome | phone Chrome Android | app APK=0.1.480-vc488
  live.js?v=985 / webrtc.js?v=356 / live-stage.css?v=655 / live-brand.css?v=24 / i18n.js?v=267
find-3rd hunt:
  scenario: S1|S2|other
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
GOAL_MET multi: yes|no
Notes: …
```

## E. Friends / Settings (Android Play-ready)

Agents **must not** invent PASS — human paste only. Spec UX: `current-mobile-ux.md`.

### E1. Friends

- [ ] **1.** Open Friends (list, empty, or error) — **no crash**
- [ ] **2.** Empty (0 friends): empty card title+body; **Share invite** + **Copy code** visible and tappable
- [ ] **3.** Share/Copy before hub hello (no code) → toast, no crash / no silent no-op
- [ ] **4.** Hub connected: Share → system sheet with code; Copy → “code copied” toast
- [ ] **5.** First open: brief history loading strip, then ready or empty history (no infinite spinner)
- [ ] **6.** Pull-to-refresh ends; list still usable
- [ ] **7.** Avatar paints when present; broken URI → letter tile (no redbox)
- [ ] **8.** Friend row Chat / Call / Invite / ⋯ open sheet, call, or Alert (no dead taps)
- [ ] **9.** Offline: header warn + labeled **Retry** tappable; Add still toasts not-connected
- [ ] **10.** Incoming accept / decline when requests present (or n/a)
- [ ] **11.** No blank white screen / infinite spinner without recovery

### E2. Settings

- [ ] **1.** Open Settings from Home — no crash
- [ ] **2.** Close / leave Settings; re-open — prefs reload, no freeze
- [ ] **3.** Section rows expand/collapse (profile · match · alerts · hub · mod · backup · safety · about)
- [ ] **4.** **hide_ip** Off/On persists after leave + reopen
- [ ] **5.** **blur** Off / Intro / Hold persists; next stranger match uses last mode
- [ ] **6.** Language chip / System persists (e.g. RU ↔ EN survives background)
- [ ] **7.** Gender / Looking stick without Save (hub sees new looking when connected)
- [ ] **8.** dataSaver / liveLayout / historySnaps / notifyFriendCalls auto-persist
- [ ] **9.** Save (display name) — toast, no throw
- [ ] **10.** Export / import / unblock — soft toasts; destructive needs confirm
- [ ] **11.** No dead row that crashes on tap

### Friends/Settings report paste

```text
FRIENDS+SETTINGS smoke APK=0.1.480-vc488:
Friends:
  open_no_crash: pass|fail
  empty_share_copy: pass|fail|n/a
  share_copy_no_code_toast: pass|fail|n/a
  hub_share_copy: pass|fail|n/a
  history_load_or_empty: pass|fail
  pull_refresh: pass|fail|n/a
  avatar_or_letter: pass|fail|n/a
  row_ctas: pass|fail|n/a
  offline_warn_retry: pass|fail|n/a
  requests: pass|fail|n/a
  no_blank_spinner_or_retry: pass|fail
Settings:
  open_close: pass|fail
  sections_toggle: pass|fail
  hide_ip_persist: pass|fail
  blur_persist: pass|fail
  lang_persist: pass|fail
  gender_looking_no_save: pass|fail|n/a
  chips_auto_persist: pass|fail|n/a
  save_name: pass|fail|n/a
  destructive_confirm: pass|fail|n/a
  no_dead_row_crash: pass|fail
GOAL_MET friends_settings: yes|no
Notes / FAIL lines only: …
```

## F. Report back (paste to agents)

```text
SMOKE APK=0.1.480-vc488 / live.js?v=985 / webrtc.js?v=356 / live-stage.css?v=655 / live-brand.css?v=24: yes|no
UX:
  name: pass|fail
  name_latch_courtier_pc: pass|fail|n/a
  stars: pass|fail
  loc: pass|fail
  local_blur: pass|fail
  partner_hide: pass|fail
  mute_banner: pass|fail
  bottom_chrome: pass|fail
  gift_fx: pass|fail|n/a
  match_spin_sfx: pass|fail|n/a
  crash_on_match: no|yes
PC:
  chrome_autohide_3s: pass|fail
Speed:
  feel_faster: yes|no|n/a
  hub-match-speed: mto=… mta=…  (optional)
av-verify: product.status=ok|…  (required for speed GOAL_MET)
MULTI: (optional — see §D paste)
FRIENDS+SETTINGS: (optional — see §E paste)
GOAL_MET: yes|no
Notes / FAIL lines only: …
```

**Agent rules after this paste**

| Report | Action |
|--------|--------|
| All pass + product.ok if claimed | Compound wiki; stop thrash |
| FAIL lines listed | One hop per line (MAX HOPS 2); re-verify; at most one APK |
| No paste | Idle — no more APK flood |

**Hard:** No GOAL_MET without product.ok for connect/speed. Do not thrash ICE / pool. UX-only fails → mobile UX only. Friends/Settings fails → `friends.tsx` / `settings.tsx` only. Multi / blur remain **human-smoke-open** until human paste.

## Overnight gate

- Pixel keyguard blocked F17–F70 unlock retries (2026-08-12). Do **not** chain adb unlock.
- Multi SoftBlur device **never claimed**. **SCAFFOLD_DONE ≠ MULTI_PASS.**
- Dump: [`archive/SMOKE-NEXT-F17-F70-dump.md`](archive/SMOKE-NEXT-F17-F70-dump.md).
