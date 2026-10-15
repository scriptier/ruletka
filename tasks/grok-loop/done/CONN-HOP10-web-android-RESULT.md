# CONN hop10 — web-kick + android av_path (implement)

## Status
COMPLETE (code on disk; UI deploy pending this hop; APK for MediaSession)

## Changes
### ui/live.js (hard-refresh v=569)
1. offerer pure `connectBudgetMs` **1100** (hybrid 750) — was flat 750
2. force_relay `inflightGrace` **1100** (was 700) — no tear mid pure gather
3. offerer cold GUM **async** (SDP-first; cam attaches later)

### mobile/src/media/MediaSession.ts
1. `armAvPathBeacons`: immediate `arm_0` + denser waves + **8s interval**
2. clearInterval on closeCall
3. `startCall` arms beacons at entry (app_vc visible even pre-answer)

### CLAUDE.md
Karpathy Spec → Verifier → Environment block (Claude on agent OS)

## GOAL_MET
no — need human smoke product.ok after hard-refresh + APK 0.1.371+
