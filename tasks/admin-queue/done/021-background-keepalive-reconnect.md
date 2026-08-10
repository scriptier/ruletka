# Task: P1 — Play background keep-alive + reconnect banner polish

**Priority:** **START HERE** for Claude. P0 001–004 COMPLETE (unsmoked product on 002+003). Filename order: **021 → 021b → 022 → 023**.

## Goal
User leaves app ~30s mid-call then returns: media recovers + clear reconnect banner (parity with web “reconnecting”). Audit app-state handling; fix only real gaps.

## Context (manager 2026-08-07 ~10:15)
- Hub metrics: **`idle`** (0 matches) — no new connect tickets; do **not** re-open 001–004.
- Do **not** touch solo-match offer create / promote watchdog (002/003 land answer GUM + pending-offer — human merge separate).
- Existing hooks (start audit here, do not full-file thrash):
  - `mobile/src/live/useBackgroundMediaPause.ts` — privacy pause cam/mic on background; soft ICE restart on active if no remote video
  - `mobile/src/hub/HubProvider.tsx` — AppState listener ~832
  - `mobile/app/live.tsx` — `reconnectHub`, `reconnectingLabel`, bg pause refs ~179–181, soft reconnect ~1666+

## Scope (only these)
- `mobile/app/live.tsx` — appState / reconnect **banner UI** only as needed
- `mobile/src/live/useBackgroundMediaPause.ts` — recover / toast / banner gaps
- `mobile/src/media/*` — only reconnect / appState paths (**no** offer rewrite, **no** promote watchdog, **no** `pendingRemoteOfferSince`)
- Optional small copy in i18n packs

## Done criteria
- [ ] Audit + fix gap **or** document “already OK” with **file:line** evidence (cite hooks above)
- [ ] Banner/copy clear when reconnecting (or evidence web-parity already exists)
- [ ] RESULT: connect risk (must be **low** if scoped)
- [ ] No deploy / no push
- [ ] RESULT notes: full leave-app 30s needs **human smoke morning** — code path still COMPLETE-able overnight

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria met (code audit/fix). Device leave-app is human, not a Claude blocker.

## Do not
- Rewrite entire WebRTC stack / MediaSession connect path
- Touch `createAndSendOffer` / hub debounce / force_relay / `pendingRemoteOfferSince`
- Deploy / push / merge main
