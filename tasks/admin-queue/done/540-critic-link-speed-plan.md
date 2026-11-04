# Linking speed to ~3s — critic (read-only)

## Goal
Second critic: where does browser↔Android spend ~5s before usable A/V, and which steps are unnecessary? Human wants ~3s. Plan only.

## OWN
- write only `tasks/admin-queue/done/540-critic-link-speed-plan-RESULT.md`

## Must not
- edit product files, MediaSession.ts, webrtc.js, live.js
- APK, deploy, pool>0, cut relayWaitBudgetMs, invent product.ok / linking GOAL_MET

## Evidence (do not invent new numbers)
- av-verify `2026-08-16T03:30:11Z` product.**ok** max_mto **1805** max_mta **2896**
- last match: web offer **584** · android answer **1904** · ice_connected ~**3.2s** after match
- Spec: `knowledge/specs/current-linking-speed.md` + `current-linking-feel.md`
- Wiki: `knowledge/wiki/linking-speed.md`
- Lock: hop11 `relayWaitBudgetMs` **480** — do not cut
- First-offer recvonly leftover OPEN (407/413)

## Check
1. Web path: kickSolo / GUM / first-relay / recvonly leftover.
2. Android: startCall EARLY / bindAnswer await / answer relay / paint.
3. Feel: Linking chrome after ICE connected.
4. Pick ONE next hop that can move human feel 5s → ~3s with lowest product.ok risk.

## Done
RESULT: table of waits (necessary / maybe / no) + ONE recommended hop + COMPLETE.
Verdict is PLAN (not SHIP code).
