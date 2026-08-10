# BLOCKED — needs human smoke + green connect first

**Blocked by manager 2026-08-07:** Hub was `YELLOW_slow` (max MTO ~25s). This task touches `MediaSession` pcConfig / ICE policy and can regress CONNECTIVITY_LOCK if Prefer Direct fights hub `force_relay` / Hide IP.

**Update (manager mid-day):** P0 tickets 001–004 COMPLETE; ship commits on `main` include connect keepers + one-way video fix (`7769c32`, `52bcb92`). 

**Update (manager ~14:40, YELLOW live):** Hub metrics now **live** — `YELLOW_slow`, max MTO **24300ms**, drops=6, slow=5. New forensics ticket **`pending/001b-connect-yellow-slow-mto.md`**. Prefer Direct remains **blocked**. Do **not** pull 034 for Claude overnight.

**Unblock when:**
1. Human Play↔PC smoke green on lock baseline (APK **0.1.126-vc134**+, browser hard-refresh; both cams, 1 offer + 1 answer, no debounce thrash, `force_relay=false` on LAN)
2. Hub verdict PASS or at least max MTO &lt; 2000 on a clean **live** run (not idle zeros)
3. Prefer **option B** (quality labels only) unless human explicitly OK’s Prefer Direct

**Then move back to** `tasks/admin-queue/pending/` (keep 034 prefix or renumber under P2).

---

# Task: P2 — Android Prefer Direct **or** shared quality preset labels

## Goal
Pick **one**:
- **A)** Port web “Prefer Direct” (STUN-only) toggle to Android settings + MediaSession pcConfig, mutually exclusive with Hide IP — **or**
- **B)** Align quality preset labels (low/mid/high) with web copy if Prefer Direct is too risky.

Prefer **B** until connect is green; only attempt A with explicit human OK.

## Scope
- `mobile/app/settings.tsx`
- `mobile/src/media/MediaSession.ts` (A only — high connect risk)
- i18n strings as needed

## Done criteria
- [ ] Setting works **or** quality labels aligned
- [ ] Does not break Hide IP / hub force_relay path
- [ ] Human smoke after any MediaSession change
- [ ] No deploy / no push
- [ ] RESULT contains **`COMPLETE`**

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria met.

## Do not
- Ship Prefer Direct without smoke
- Always-on force_relay
- Deploy / push / merge main
