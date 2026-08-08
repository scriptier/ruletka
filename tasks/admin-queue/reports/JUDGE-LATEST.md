# JUDGE-LATEST — night-shift manager

**When:** 2026-08-07 (Grok mid-night judge)  
**Repo tip:** `main` @ `7769c32` — *ship: overnight connect keepers + cam mute copy for deploy*  
**Role:** judge only — no implement, no deploy, no push, no merge to main.

---

## 1. Hub snapshot

| Field | Value |
|-------|--------|
| Verdict | **`idle`** |
| Matches / offers / answers / drops / slow | 0 / 0 / 0 / 0 / 0 |
| **Max MTO** | **0** (no live pairs; idle ≠ green) |
| MTO source | `timestamp_delta` |

**Read:** CONNECTIVITY_LOCK still holds — host coturn, `force_relay=false`, one offer per match, no docker coturn revival. Do not undo.

**Implication:** No hub pain to drive connect rework. Morning gate is **human Play↔PC smoke on current `main` (`7769c32`)**, not re-merging stale admin branches.

---

## 2. Branches table

All six `admin/*` branches are **1 commit ahead / 1 behind** `main` (based on `0d61dbb`, missing ship `7769c32`). Naïve merge of any of them would **fight or revert** the modular `live.tsx` / i18n ship on main.

| Branch / worktree | Files touched (product) | Connect risk | Verdict |
|-------------------|-------------------------|--------------|---------|
| `admin/…-001-connect-slow-offer` | admin metadata only (audit, **no code**) | hold | **discard** — empty product; audit already COMPLETE |
| `admin/…-002-mobile-answer-path` | `MediaSession` GUM race + `adaptiveQuality.ts` | hold | **discard** — **superseded by `7769c32`** (answer GUM 1100ms race + adaptiveQuality tracked) |
| `admin/…-003-offer-thrash` | `MediaSession` `pendingRemoteOfferSince` + `ui/webrtc.js` | hold | **discard** — **superseded by `7769c32`** (same guards live on main); do **not** merge (would drop 002 GUM cap vs main) |
| `admin/…-004-web-kicksolo-speed` | admin metadata only (audit, **no code**) | hold | **discard** — empty product; “already optimal” COMPLETE |
| `admin/…-021-background-keepalive-reconnect` | `useBackgroundMediaPause.ts` only: optional `onReconnectStart?` | hold | **needs-fix** — **do not merge branch whole**. Unique residual: callback not on main; **caller wire in modular `live.tsx` never landed** (RESULT described 3-line `setConn`/`setAwaitingRemoteVideo` handoff). Prefer tiny cherry-pick/reapply on main, or open **021c** micro-ticket |
| `admin/…-021b-cam-mute-parity-reapply` | `live.tsx` + 14 i18n `camOffHint` | hold | **discard** — **superseded by `7769c32`** (`camOffHint` + LiveBottomBar “Hidden from them” already on main) |

### Already on main (ship `7769c32`) — do not re-merge

- **002:** answer-path GUM `Promise.race` (~1100ms) in `MediaSession.handleRemoteSignalInner`
- **003:** `pendingRemoteOfferSince` / `_pendingRemoteOfferSince` promote-watchdog skip (mobile + web)
- **adaptiveQuality.ts** tracked
- **021 base:** `useBackgroundMediaPause` present (ICE restart on return without remote video; **no** `onReconnectStart` yet)
- **020/021b:** `mobile.live.camOffHint` + LiveBottomBar partner-facing hint

### Claude job log notes

| Task | Last EXIT | Notes |
|------|-----------|--------|
| 010, 011, early 020 | 1 | Old failures; no surviving product branches |
| 001–004, 021, 021b | 0 | RESULT COMPLETE; product mostly absorbed by ship except 021 UI callback |

---

## 3. Actions for next Claude cycle

### Top pending tasks (run next)

Hub is idle → **prefer non-connect** work. P0 001–004 are in `done/`. **034 stays blocked.**

1. **`022-friend-call-ring-parity.md`** (P1) — Play ring / accept / miss UX; friend-call only, no solo offer/ICE. 021 “COMPLETE” enough to proceed; treat 021 residual as optional micro-followup, not a gate.
2. **`023-web-friend-call-notify.md`** (P1) — tab open+unfocused Notification/ringtone; safe non-connect.
3. **`036-play-store-checklist-docs.md`** (P2, zero connect risk) — best filler while human smokes Play↔PC on `main`. Alternate fillers: **035** geo cities, **033** chat/gifts audit.

**Do not re-queue 001–004** unless live smoke after ship shows residual MTO/thrash with fresh hub evidence.

### Ticket rewrites

None. Pending tickets (022–023, 033, 035–036, 090) have clear Goal / Done / Do-not. No paste fixes this cycle.

### Optional micro residual (not required before 022)

If next agent has spare capacity **after** 022/023 or as tiny first job:

- **021c (not in queue):** cherry-pick `onReconnectStart?` into `mobile/src/live/useBackgroundMediaPause.ts` on **current main**, wire once in modular `live.tsx` / existing `useBackgroundMediaPause` call site (`setConn("connecting")` + `setAwaitingRemoteVideo(true)`). Connect risk low (optional callback; no offer path). Discard full `admin/…-021-…` branch after that.

### Blocked

| Ticket | Action |
|--------|--------|
| `blocked/034-prefer-direct-or-quality-labels.md` | **Keep blocked.** Reason: needs human Play↔PC green after ship + live MTO sample; Prefer Direct (option A) remains high connect risk. Prefer option B only after smoke. |

No new moves to `blocked/` this cycle.

### Morning human / Grok (not Claude)

1. **Smoke** Play↔PC on `main` `7769c32` per CONNECTIVITY_LOCK (1 offer + 1 answer, both cams, `force_relay=false`).
2. Run `./scripts/hub-match-speed.sh` on **live** traffic; idle max MTO=0 is not PASS.
3. **Discard / delete** stale `admin/*` branches + `.admin-worktrees/*` after confirming ship covers product (except optional 021c pick).
4. **Do not** merge any of the six admin branches into main as-is.
5. Deploy / push only after green smoke (human gate).

---

## 4. Hard rules reminder

- Do **not** deploy, push, or merge to `main` from overnight agents.
- Do **not** undo CONNECTIVITY_LOCK (no always-on `force_relay`, no docker coturn primary, no double-offer thrash, no peer allowlist revival).
- Prefer **discard** empty / superseded admin branches over merge.
- Connect-path merges: **conservative** — ship already landed keepers; further connect edits need live hub pain + smoke, not idle metrics.

---

## Ranked merge list (for human)

| Rank | Item | Action |
|------|------|--------|
| 0 | `main` @ `7769c32` | **Smoke first** — this is the landable overnight product |
| 1 | `admin/…-021-…` residual only | **Cherry-pick** `onReconnectStart` (+ live wire) **or** open 021c — never full branch merge |
| 2 | All other `admin/*` | **discard** |

**Bottom line:** Overnight implementers finished; ship commit already absorbed connect keepers + cam mute. Queue next cycle on **022 → 023 → 036/035**, keep **034 blocked**, prune **empty admin branches**.
