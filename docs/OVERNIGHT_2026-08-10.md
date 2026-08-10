# Overnight plan — 2026-08-10 (post pure-relay + blur fix)

**Sleep window:** from ~02:30 MDT until you wake  
**Restore:** `./scripts/admin-agent/restore-pre-sleep.sh`  
**Or tell Grok:** *go back to before I went to sleep*

## North star (morning)

1. **Human smoke** (you): install **0.1.283**, hard-refresh live (`webrtc.js?v=285`)  
   → both cams ≥30s · eye blur = mosaic not black  
2. Agents: **safe polish only** — no deploy, no ICE thrash

## Shipped baseline (do not undo)

| Item | Value |
|------|--------|
| APK | `0.1.283` / vc291 · pure `force_relay` + blur zOrder 0 |
| Web | `webrtc.js?v=285` pure force_relay |
| Git | `main` @ `999081a`+ |
| CONNECTIVITY_LOCK | no blanket web↔android force_relay · no docker coturn · no answerer promote |

## Safety (frozen)

| Rule | Value |
|------|--------|
| Deploy / `push.sh` / prod restart | **OFF** (`ALLOW_DEPLOY=0`) |
| Connect / ICE / hub `pair_force_relay` | **hands off** unless RED forensics only |
| Coturn conf / docker | **no** |
| Worktrees | `admin/*` only for Claude landings |
| Snapshot | `backups/LATEST_PRE_SLEEP` |

## Priority ladder

### P0 — watch & prove (no code thrash)

| # | Task | Outcome |
|---|------|---------|
| 1 | Hub/coturn forensics every cycle | Scorecard: matches, MTO, answerer drops, peer_usage |
| 2 | Connectivity lock suite | `./scripts/test-connectivity-lock.sh` stays green |
| 3 | Coturn self-test | `./scripts/test-coturn-relay.sh` if present |
| 4 | Headless web pair (if Chrome) | `prod-pair-media.mjs` / pair-smoke budget report |

### P1 — morning-ready packaging (no Play upload)

| # | Task | Outcome |
|---|------|---------|
| 5 | AAB build 0.1.283 | `mobile/artifacts/ruletka-0.1.283-vc291.aab` if keystore ok |
| 6 | Play Internal notes + checklist | Refresh for 0.1.283 smoke steps |
| 7 | DEVICE_SMOKE / PLAY_TODAY | Point at 0.1.283 + webrtc v285 |
| 8 | APK dual-build race | Harden post-commit hook so lint/assemble don’t fight |

### P2 — polish only if P0/P1 green

| # | Task | Outcome |
|---|------|---------|
| 9 | Mobile pure-relay unit stub | Document or tiny test for `desiredRelayPolicy` / no-promote |
| 10 | i18n blur strings audit | Missing keys only — no layout rewrite |
| 11 | Connect scorecard JSONL | Overnight append for morning chart |

### Explicitly blocked overnight

- Re-open hybrid force_relay  
- Answerer promote-to-offerer  
- SFU/LiveKit default  
- Production deploy / coturn docker  
- Play Console upload  
- Emulator thrash  

## Timeline

| When (MDT) | What |
|------------|------|
| Now | Snapshot pre-sleep · fill pending queue · agents already running |
| Night | Nightly cycles (~40 min) drain queue · hub forensics · no deploy |
| Continuous | Claude drains pending if quota available |
| Wake | `./scripts/admin-agent/morning.sh` · install 0.1.283 · human smoke |

## Morning checklist (you)

```bash
cd ~/freenet-roulette
./scripts/admin-agent/morning.sh
./scripts/hub-match-speed.sh 30
adb install -r mobile/artifacts/ruletka-0.1.283-vc291.apk
# hard-refresh https://ruletka.vip/live.html  → webrtc.js?v=285
# match ≥30s both cams · eye blur = mosaic · Show video
```

| Check | Pass |
|-------|------|
| Morning brief | `tasks/admin-queue/reports/` today |
| Hub | no RED zero-offer; answerer drops ~0 |
| Smoke | PC sees phone + phone sees PC |
| Blur | frosted mosaic, not pure black |
| Disaster | `./scripts/admin-agent/restore-pre-sleep.sh` |
