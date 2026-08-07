# Manager report — night shift (Claude rate-limited / idle)

**When:** 2026-08-07 (local)  
**Role:** Grok MANAGER — re-rank + sharpen only, no deploy / no big code  
**Plan:** `docs/OVERNIGHT_9H_PLAY_PLAN.md`  
**Lock:** `docs/CONNECTIVITY_LOCK.md` (do not undo)

---

## Hub verdict

| Field | Value |
|-------|------:|
| Verdict | **`YELLOW_slow`** |
| Matches | 7 |
| Offers / answers | 5 / 5 |
| Offer drops (debounce) | 3 |
| Slow offers | 1 |
| **Max match→offer** | **25000 ms** |
| MTO source | `timestamp_delta` |

**Read:** Path works (offers≈answers, `force_relay=false` in later logs). **Speed + thrash** are the pain: ~25s to first offer, and second offers within ~0.8–4s hit hub debounce.

**Implication:** Promote / keep **P0 connect tasks first**. No Prefer Direct / ICE policy until smoke green.

---

## Ordered work list for Claude (when session returns)

Pick **lowest filename prefix** still in `pending/`. Stop hour per overnight plan **15:00** local. Max ~12 cycles; **one concern per task**.

### Must (P0) — finish before polish

| # | File | Outcome |
|---|------|---------|
| 1 | `001-connect-slow-offer.md` | Root cause + minimal fix for match→offer ≫ 2s |
| 2 | `002-mobile-answer-path.md` | Play answer/promote not silent 12s+; no thrash |
| 3 | `003-offer-thrash.md` | Kill second-offer source (hub drops age ~787–4005ms) |
| 4 | `004-web-kicksolo-speed.md` | Web kickSolo/warm path fires offer immediately |

### Should (P1) — after P0

| # | File | Outcome |
|---|------|---------|
| 5 | `020-cam-mute-parity.md` | Same mute/hide promise both sides |
| 6 | `021-background-keepalive-reconnect.md` | Leave app ~30s → recover + banner |
| 7 | `022-friend-call-ring-parity.md` | Ring / accept / miss clearer on Play |
| 8 | `023-web-friend-call-notify.md` | Tab open but unfocused still alerts |

### Nice (P2/P3) — only if P0/P1 done

| # | File | Outcome |
|---|------|---------|
| 9 | `033-chat-gifts-parity-audit.md` | Fix real gift/chat gaps only |
| 10 | `035-geo-city-map-expand.md` | ≥15 city mappings |
| 11 | `036-play-store-checklist-docs.md` | Morning Play internal-test checklist |
| 12 | `090-open-on-pc-qr-design.md` | Design only |

### Blocked

| File | Why |
|------|-----|
| `blocked/034-prefer-direct-or-quality-labels.md` | Touches MediaSession ICE / Prefer Direct; wait for green P0 + human smoke |

### Already done (do not re-do)

- `010` parity followups → tickets created  
- `011` pair-smoke harden → `hub-match-speed.sh` + DEVICE_SMOKE  
- `022-match-offer-budget` → measurement only (filename 022 reused for **friend-call-ring** in pending — different task)

---

## What changed in the queue

1. **Sharpened** all pending tickets: Goal + Scope + Done criteria + **`COMPLETE` promise**.
2. **P0 001–004** enriched with hub numbers (25s MTO, drop ages, force_relay=false).
3. **Renumbered P1 for filename order** (matches overnight ladder):
   - was `031` background → **`021-background-keepalive-reconnect.md`**
   - was `032` friend ring → **`022-friend-call-ring-parity.md`**
   - was `021` web notify → **`023-web-friend-call-notify.md`**
4. **Moved** `034-prefer-direct-or-quality-labels.md` → **`blocked/`** (Prefer Direct after smoke).
5. Removed stale duplicate filenames from renumber noise.
6. **Did not** touch product code, deploy, push, or CONNECTIVITY_LOCK.

---

## What human should smoke in the morning

```bash
cd ~/freenet-roulette
./scripts/admin-agent/morning.sh
./scripts/hub-match-speed.sh 30
```

### Play ↔ PC (P0)

1. Install latest local APK (`mobile/artifacts/ruletka-latest.apk` or newest `admin/*` build if Claude shipped media changes).
2. Browser: one tab `https://ruletka.vip/live.html` **hard refresh**.
3. Both Start once; **do not spam Next for 15s**.
4. Expect: both remote cameras + audio; hub **1 offer + 1 answer**; `force_relay=false` when same LAN.
5. Pass bar: **max match_to_offer &lt; 2000ms** on a clean run (or clearly better than 25s).

### After any media/WebRTC RESULT

- Rebuild/install APK before judging mobile fixes.
- Re-run hub-match-speed; watch for `offer dropped: debounce`.

### Do not (human or agent)

- Deploy / rsync / coturn / push / merge main until smoke green.
- Re-enable always-on force_relay or docker coturn.
- Unblock 034 until connect is green.

### If disaster

```bash
./scripts/admin-agent/restore-pre-sleep.sh
```

---

## Claude first hour (script)

1. Read `001-connect-slow-offer.md` + CONNECTIVITY_LOCK (not entire live.js — grep `kickSolo|handleMatched|createOffer`).
2. Land minimal fix or file:line handoff; RESULT with **COMPLETE**.
3. Then 002 → 003 → 004; only then 020+.
4. Worktree / branch `admin/*` only; no push.

---

## Manager sign-off

Queue is **connect-first**, filename-ordered, tickets agent-ready. Hub **YELLOW_slow** remains the north-star until morning smoke + 001 RESULT.
