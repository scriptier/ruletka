# Second critic: linking hop10/11 + iOS audio coexistence

Grok director. Herd `20260814T021956Z` (docs/harness) + implement `link-android-warm`. You are **read-only critic + tests only**.

## Goal
Confirm on disk (worktree after sync):

1. `iceCandidatePoolSize` / pool still **0**
2. `relayWaitBudgetMs` 480 pure / 300 hybrid — do **not** recommend cutting
3. hop10 `connectBudgetMs` 1100 pure offerer · inflightGrace 1100
4. iOS `isIosWebKit` omits sampleRate 48000 and does not break pool/budgets
5. pair-smoke: if Grok landed gotcha-24 SKIP, note it; if still `ROULETTE_TURN=off` hard FAIL, say so

## OWN
- `tasks/admin-queue/done/480-linking-hop-critic-RESULT.md` (write RESULT only)
- Optional: `mobile/src/media/mediasessionMultiSafety.test.mjs` **only** if you add a hop11 180/220 or pool=0 assert that is not already there

## Must not
- Edit `MediaSession.ts`, `live.js`, `webrtc.js`, `live.tsx`, deploy, APK, ICE policy
- Invent product.ok / linking GOAL_MET
- Recommend relay wait &lt;480

## Done
RESULT + COMPLETE with: PASS/FAIL per check, line cites, Connect risk=none|low.

Read: `knowledge/raw/2026-08-14-linking-brainstorm.md`, `knowledge/specs/current-linking-speed.md`, `artifacts/av-verify/latest.md`
