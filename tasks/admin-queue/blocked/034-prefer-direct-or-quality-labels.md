# BLOCKED — needs human smoke + green P0 first

**Blocked by manager 2026-08-07:** Hub is `YELLOW_slow` (max MTO ~25s). This task touches `MediaSession` pcConfig / ICE policy and can regress CONNECTIVITY_LOCK if Prefer Direct fights hub `force_relay` / Hide IP.

**Unblock when:**
1. Human Play↔PC smoke green (both cams, 1 offer + 1 answer)
2. Hub verdict PASS or at least max MTO &lt; 2000 on a clean run
3. P0 tickets 001–004 RESULT landed (or explicitly deferred)

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

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria met.

## Do not
- Ship Prefer Direct without smoke
- Always-on force_relay
- Deploy / push / merge main
