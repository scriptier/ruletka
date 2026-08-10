# JUDGE-LATEST — night-shift manager

**When:** 2026-08-09 ~01:30 MDT (Grok mid-night judge)  
**Repo tip (committed `main`):** `b502154` — *docs(play): internal-test checklist + listing refresh for 0.1.136*  
**Role:** judge only — no implement, no deploy, no push, no merge to main.  
**Prior JUDGE:** 2026-08-08 (idle hub) — **superseded**.

---

## 1. Hub snapshot

| Field | Value |
|-------|--------|
| **Verdict** | **`GREEN`** |
| Matches / offers / answers | **7 / 9 / 9** |
| Drops / slow | **1 / 0** |
| **Max MTO** | **1170** ms |
| MTO source | `hub_field` |
| Metrics file | `scripts/admin-agent/logs/last-hub-metrics.env` (mtime ~2026-08-09 01:22 MDT) |

**Read:** Live window is healthy. Offers ≥ matches, answers = offers, **0 SLOW**, max match→offer **~1.2 s** (well under lock targets). Single drop is not RED. **Do not re-open P0 001–004 / 001b** from hub pain — there is none.

**CONNECTIVITY_LOCK (do not undo):** P2P only; host coturn; `pair_force_relay=true` for same public IP **or** web↔android/ios; one offer per match; offer debounce ~3.5s; answerer re-offer grace ≥30s; no docker coturn revival; no always-on force_relay outside those cases. Human baseline notes cameras linked fast (APK path **0.1.205** / lock doc; committed `main` still **0.1.136** — WIP lives outside commits).

**Implication:** Morning gate is **WIP reconcile + selective cherry-pick**, not more offer-path tickets.

---

## 2. Branches table

### Ranked merge list (human / Grok only — Claude must not merge)

| Priority | Branch / worktree | Files touched | Connect risk | Verdict |
|----------|-------------------|---------------|--------------|---------|
| 1 | `admin/…-046-i18n-overlay-fill` | 14× `mobile/src/i18n/overlay/*.json` (notify/friends/live + env-leak fix + mojibake on needStars) | smoke-ok | **keep** — best pure-product keep; no connect path |
| 2 | `admin/…-051-device-smoke-189-baseline` | `docs/DEVICE_SMOKE.md` (Start-once, CONNECT toast note, hub-only smoke) | smoke-ok | **keep** — docs; version left at real tip 0.1.136 (correct; do not invent 0.1.189 on `main`) |
| 3 | `admin/…-041-device-smoke-refresh` | `DEVICE_SMOKE` + Play checklist + `POLISH_NOW` | smoke-ok | **keep** after 051 — fold if overlapping; prefer newer 051 wording where they collide |
| 4 | `admin/…-052-hub-match-speed-answer-metrics` | `scripts/hub-match-speed.sh` (answer/grace/android-SLOW rows) | smoke-ok | **keep w/ reconcile** — main WT already has **untracked** richer script (`match_to_ice_ms`); **keep WT/Grok copy if newer**, drop branch duplicate |
| 5 | `admin/…-053-pair-smoke-connect-budget` | `scripts/pair-smoke.mjs` (soft MTO/trackMs after PASS) | hold→smoke-ok after reconcile | **keep w/ reconcile** — file never on `main` history; **diff vs** dirty main `scripts/pair-smoke.mjs` before land; soft-assert only (exit code unchanged) |
| 6 | `admin/…-043-match-history-ctas` | `mobile/app/friends.tsx` Call back / Ring anyway pills | smoke-ok | **keep** with care — UI-only; likely conflict with dirty friends/WIP modules |
| 7 | `admin/…-045-open-on-pc-phase1-stub` | `OpenOnPcSheet.tsx` + Settings About + en/ru | smoke-ok | **keep** — unwired stub; watch Settings conflicts |
| 8 | `admin/…-040-hub-forensics-handoff` | `FORENSICS-HANDOFF.md` only | smoke-ok | **keep** (docs/report) — optional anytime |
| 9 | `admin/…-050-settings-last-connect-timing` | `live.tsx` + `settings.tsx` + `lastConnectSummary.ts` + en | **hold** | **needs-fix** — do **not** blind-merge; dirty main already has `lastConnectStats.ts` / MediaSession WIP; pick one persistence layer after WIP lands |
| 10 | `admin/…-044-home-online-strip` | `mobile/app/index.tsx` online pill | hold | **needs-fix** — may duplicate backup/WIP home meta; re-apply only if tip still lacks strip |
| — | `admin/…-042-settings-soft-toasts` | admin metadata **only** | hold | **discard** — empty product; soft toasts already in dirty main WT |
| — | `admin/…-047-web-soft-ux-pass` | admin metadata only | smoke-ok | **discard** — legitimate no-op audit |
| — | `admin/…-001-connect-slow-offer` | admin metadata only | hold | **discard** — empty; P0 done on ship path |
| — | `admin/…-004-web-kicksolo-speed` | admin metadata only | hold | **discard** — empty product |
| — | `admin/…-002-mobile-answer-path` | `MediaSession` + stale `adaptiveQuality` · **30 behind** | hold | **discard** — would thrash connect |
| — | `admin/…-003-offer-thrash` | `MediaSession` + `ui/webrtc.js` + adaptiveQuality · **30 behind** | hold | **discard** — thrash guards already on ship path |
| — | `admin/…-021-background-keepalive-reconnect` | background pause + adaptiveQuality · **30 behind** | hold | **discard** — base too old |
| — | `admin/…-021b-cam-mute-parity-reapply` | `live.tsx` + camOffHint i18n · **30 behind** | hold | **discard** — superseded by tip / WIP |
| — | `admin/…-022-friend-call-ring-parity` | `_layout` / friends / home ring · **29 behind** | hold | **needs-fix** only if tip lacks repeating vibrate on `incomingCall`; **do not whole-merge** |

### Outside `admin/*` (morning human priority — higher than any admin branch)

| Ref | What | Judge note |
|-----|------|------------|
| **Dirty main WT (~367 paths)** | MediaSession modular live, `connectUi`/`connectRetry`/`lastConnectStats`, friends modules, untracked `hub-match-speed.sh` / `pair-smoke.mjs` / `smoke-connect.sh` | **#1 morning:** commit or stash-reconcile before cherry-picking admin/*; `main` as committed will not type-check against those imports |
| `backup/pre-sleep-*` / `backup/LATEST-pre-sleep-*` | Pre-sleep snapshots ahead of bare `main` | Review connect-touching hunks against CONNECTIVITY_LOCK before any dump-commit |
| `failed/{043,044,045,046,050}-*.md` | EXIT=126 tooling flake (`stdbuf` / verify) | Product still **COMPLETE** on branches — **not** task failure |

### Claude job log (this night / recent)

| Task | EXIT | VERIFY | Product on branch? | Judge |
|------|------|--------|--------------------|-------|
| 050 last connect timing | 126 | 1 | yes UI layer | needs-fix after WIP |
| 051 device smoke 189 | 0 | 0 | docs | keep |
| 052 hub-match-speed metrics | 0 | 0 | script | keep w/ reconcile |
| 053 pair-smoke budget | 0 | 0 | script | keep w/ reconcile |
| (earlier) 040–047 | mixed 0/126 | — | see table above | unchanged from prior JUDGE |

---

## 3. Actions for next Claude cycle

### Queue state
- **`pending/`: empty**
- **`running/`: empty**
- **`blocked/`:** `034-prefer-direct-or-quality-labels.md`, `038-build-apk-template.md` — **leave blocked**
- **`failed/`:** tooling flakes only; do not re-run as “broken product”

### Top 1–3 next (when queue is reseeded)

Hub pain is **absent**. Do **not** invent connect tickets.

1. **Human/Grok first (not Claude):** reconcile dirty main WIP + untracked scripts; then cherry-pick **keep** list (046 → 051/041 docs → 052/053 scripts after reconcile → 043/045 UI).
2. **If Claude must run with empty pending:** reseed **only** zero-connect fillers, e.g.:
   - residual **i18n mojibake** follow-up (046 flagged out-of-scope `â` in 5 other keys in ar/cs/bg/sr) — narrow, strings only;
   - or leave Claude **idle** until human reseeds.
3. **Do not re-queue:** P0 `001`–`004`, `001b`, Prefer Direct (`034`), connect thrash / answer-path rewrites.

### Tickets to rewrite
- **None in `pending/`** (empty). No paste edits required this cycle.

### Tickets to move / keep blocked
| Ticket | Action | Reason |
|--------|--------|--------|
| `blocked/034-prefer-direct-or-quality-labels.md` | **stay blocked** | ICE/Prefer Direct — hub GREEN; human-only after Play↔PC smoke |
| `blocked/038-build-apk-template.md` | **stay blocked** | APK template — Grok owns local APK; not overnight Claude |

No new blocked moves this cycle.

### Merge order (human morning)

```
1) Land / stabilize dirty main WIP (type-check mobile)
2) Keep Grok untracked scripts if newer: hub-match-speed.sh, pair-smoke.mjs, smoke-connect.sh
3) Cherry-pick: 046 → 051 (+041 fold) → 043 → 045 → 040 optional
4) 050 / 044 only after WIP + conflict resolve
5) Discard all 001–004, 021/021b, 042, 047 branches (noisy empty / ancient base)
6) Play↔PC smoke once before any deploy (human)
```

---

## 4. Hard rules reminder

- Do **not** deploy, push, or merge to `main` (this agent / Claude overnight).
- Do **not** undo `docs/CONNECTIVITY_LOCK.md` (no always-on force_relay, no docker coturn revival, no double-offer thrash, no SFU default).
- Prefer **discard** noisy empty admin branches (001, 004, 042, 047).
- Prefer **discard** connect-path branches 30 commits behind (002, 003, 021, 021b).
- Conservative on connect merges: **zero** connect-logic admin branches are **keep** this cycle — only docs, i18n, UI stubs, and ops scripts (after reconcile).
- Smoke Play↔PC + merge + deploy remain **human/Grok**.

---

## One-line verdict

**Hub GREEN (max MTO 1170).** Queue empty. Keep 046/051/041/052†/053†/043/045; fix 050/044 after WIP; discard P0-era + empty branches. Morning = **WIP reconcile**, not more connect tickets.  
† after reconciling untracked main scripts.
