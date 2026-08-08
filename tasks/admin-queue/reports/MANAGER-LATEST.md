# Manager report — night shift (Claude rate-limited / idle)

**When:** 2026-08-07 ~14:40 America/Edmonton (approx)  
**Role:** Grok MANAGER — re-rank + sharpen only; no deploy / no big code  
**Plan:** `docs/OVERNIGHT_9H_PLAY_PLAN.md`  
**Lock:** `docs/CONNECTIVITY_LOCK.md` (do not undo)  
**Prior:** previous `MANAGER-LATEST` (~13:10, hub **idle**) — **superseded** by live YELLOW traffic

---

## Hub verdict

| Field | Value |
|-------|------:|
| Verdict | **`YELLOW_slow`** |
| Matches / offers / answers | **8 / 11 / 11** |
| Drops / slow | **6 / 5** |
| Max match→offer | **24300 ms** |
| MTO source | `hub_field` |
| Metrics file | `scripts/admin-agent/logs/last-hub-metrics.env` |

**Read:** Live traffic returned. Offers≈answers (good), but **max MTO still ~24s** and **drops=6**. This is **not** PASS. Prior `001` audit claimed client hot paths are already &lt;2s and blamed rematch gap; `003` thrash fix is on ship path — yet metrics still look like the historical YELLOW pattern. Claude’s job is **001b forensics**, not inventing Prefer Direct or force_relay.

**CONNECTIVITY_LOCK baseline (do not regress):**
- APK **`0.1.126` / versionCode `134`**
- Web connect rules ≥ `85c5017` + veil `44136c9`
- P2P only; host coturn; `force_relay=false` on same-IP; one offer per match

**`main` tip (local, ahead of origin):**
1. `f037942` — *polish(mobile): friend call no-answer Call back + clearer ring/end copy*
2. `79478a3` — *docs: lock connect baseline 0.1.126; start polish*
3. `44136c9` — real privacy veil
4. `85c5017` — P2P real camera outbound
5. `52bcb92` — one-way video + stop post-answer re-offer
6. `7769c32` / `0d61dbb` — overnight connect keepers + faster match→offer

**Working tree is dirty** (many uncommitted mobile/docs/bridge files). Claude must stay on **`admin/*` worktrees** and one-concern tickets; **do not** bulk-commit modular live WIP.

---

## Ordered work list for Claude (when session returns)

Pick **lowest filename prefix** still in `pending/`. Stop hour **15:00** local if still in overnight window. **One concern per task.** Branch: `admin/*` only. No deploy / push / merge main.

### Start here

| # | File | Outcome | Note |
|---|------|---------|------|
| 1 | **`001b-connect-yellow-slow-mto.md`** | Explain 24s MTO + one fix **or** smoke-handoff with evidence | **START.** Hub YELLOW. Forensics first (`hub-match-speed.sh`). Do **not** re-open 001–004 admin merges. Stay inside lock. |
| 2 | `023-web-friend-call-notify.md` | Unfocused open tab still alerts on friend call | **After 001b only.** Web UI; stay off offer/ICE. |
| 3 | `036-play-store-checklist-docs.md` | Docs checklist for internal track | Best **zero-connect-risk filler** if 001b already COMPLETE and 023 stalls. Update APK note to **0.1.126**. |
| 4 | `035-geo-city-map-expand.md` | ≥15 city mappings; geo unit test | Isolated filler. |
| 5 | `033-chat-gifts-parity-audit.md` | Audit table + fix only clear gift/chat gaps | After 023. Modular live WIP → **audit-only COMPLETE** OK. |
| 6 | `090-open-on-pc-qr-design.md` | Design only | **Last.** |

### Blocked (do not pull)

| File | Why |
|------|-----|
| `blocked/034-prefer-direct-or-quality-labels.md` | Prefer Direct / ICE policy — hub still **YELLOW**; wait human Play↔PC green. Prefer option B later. |

### Already done — do **not** re-do

| Ticket | RESULT | Notes |
|--------|--------|-------|
| 001 connect-slow-offer | COMPLETE (audit) | residual live YELLOW → **001b**, not re-do 001 |
| 002 mobile-answer-path | COMPLETE | superseded by ship — discard admin branch |
| 003 offer-thrash | COMPLETE | superseded by ship — discard admin branch |
| 004 web-kicksolo-speed | COMPLETE (audit) | discard empty admin branch |
| 020 / 021b cam-mute | COMPLETE | on ship path |
| 021 background-keepalive | COMPLETE | residual optional `onReconnectStart` only |
| **022 friend-call-ring** | **COMPLETE** | merge candidate after device smoke; polish also on `f037942` tip |

### Admin branches (manager alignment)

| Branch | Verdict |
|--------|---------|
| `admin/…-001`, `…-004` | **discard** (empty / audit) |
| `admin/…-002`, `…-003`, `…-021b` | **discard** (product on `main` ship) |
| `admin/…-021-background-keepalive` | **discard** whole branch unless tiny cherry |
| `admin/…-022-friend-call-ring-parity` | **keep** until smoke; tip may already have polish via `f037942` — compare before merge |
| any empty `…-023` | continue product on new admin branch if needed |

---

## What changed in the queue (this manager pass)

1. **Promoted connect:** hub **YELLOW_slow** (was idle at last manager pass) → wrote **`pending/001b-connect-yellow-slow-mto.md`** with Goal / Scope / Done / COMPLETE promise.
2. **Removed** weak auto ticket `006-auto-slow-offer-2026-08-07.md` (superseded by 001b).
3. **Re-ordered priorities on all pending** so 023/033/035/036/090 yield to 001b; sharpened Done criteria + COMPLETE language; APK note **0.1.126** on 036.
4. **Kept 034 blocked**; added YELLOW + 001b pointer.
5. **Synced** `docs/OVERNIGHT_9H_PLAY_PLAN.md` Must/Should rows for 001b.
6. **Did not** move any pending → blocked (023+ are safe to code after connect; only 034 needs human).
7. **Did not** touch product code, deploy, push, coturn, or CONNECTIVITY_LOCK surfaces.

**Pending order after this pass (filename-correct):**  
`001b` → `023` → `033` → `035` → `036` → `090`  

**Practical Claude order:**  
**`001b` → `023` → (`036` or `035` filler) → `033` → `090`**  
Never pull `034`.

---

## What human should smoke in the morning

```bash
cd ~/freenet-roulette
./scripts/admin-agent/morning.sh
./scripts/hub-match-speed.sh 30
```

### P0 connect (required before any deploy thought)

| Rank | What | Verdict |
|------|------|---------|
| 0 | Smoke **lock APK `0.1.126-vc134`** + hard-refresh browser (connect rules ≥ `85c5017`) | highest value |
| 1 | Confirm CONNECTIVITY_LOCK: both cams + audio, **1 offer + 1 answer**, `force_relay=false` on LAN | pass bar |
| 2 | Treat max MTO **&lt; 2000ms** on a **real** pair as green; current hub sample is **YELLOW 24s** | watch drops / debounce |
| 3 | If Claude finishes **001b**, review RESULT + any tiny patch **before** deploy | Grok gate |
| 4 | Discard stale admin **001–004, 021, 021b** after confirm ship covers product | noise |
| 5 | Hygiene: dirty main + modular `mobile/src/live/*` WIP — do **not** bulk-merge overnight thrash | Grok/human |
| 6 | Merge **022** / friend-call polish only after device smoke (`f037942` may already cover some copy) | after connect green |

**Play ↔ PC smoke (CONNECTIVITY_LOCK):**

1. Install **`ruletka-0.1.126-vc134.apk`** (or later that still respects lock).
2. Browser: one tab `https://ruletka.vip/live.html` **hard refresh**.
3. Both Start once; **do not spam Next for 15s**.
4. Expect: both remote cameras + audio; hub **exactly 1 offer + 1 answer**; `force_relay=false` same LAN.
5. Watch: **zero** `offer dropped: debounce` on clean single match; mobile veil = Brief (not permanent black wall).
6. Pass bar: max match_to_offer **&lt; 2000ms** on a live run.

### After connect green

- Unfocused tab friend-call notify (**023**) — browser only.
- Friend-call ring (**022**) — device once live builds clean.
- Leave-app 30s (021 residual) — optional.
- Do **not** unblock **034** until connect smoke green.

### If disaster

```bash
./scripts/admin-agent/restore-pre-sleep.sh
```

---

## Claude first hour (copy-paste)

```
1. Skim docs/CONNECTIVITY_LOCK.md (do not undo)
2. Hub is YELLOW_slow max MTO 24300 — START pending/001b-connect-yellow-slow-mto.md
3. Run ./scripts/hub-match-speed.sh 30 (read-only); classify true stall vs rematch/accounting
4. One minimal fix OR audit COMPLETE with evidence; RESULT with COMPLETE
5. Do NOT re-open 001–004 / 020 / 021 / 021b / 022 product
6. Only after 001b: 023 web friend-call notify; fillers 036/035; then 033
7. Never 034; stay off force_relay / docker coturn / double-offer thrash; no deploy / push / merge main
```

---

*Manager only. Next Claude: **001b**. Next human: smoke lock APK **0.1.126**, read hub MTO, prune superseded admin branches, then gate any 001b patch + 022 merge.*
