# Overnight plan — 2026-08-08 (sleep)

**You sleep → Claude implements on `admin/*` → Grok judge/manager → morning brief**  
**You do not merge/deploy until morning smoke.**

## Snapshot / restore

```bash
# Already run at sleep start (or re-run if needed):
./scripts/admin-agent/snapshot-pre-sleep.sh

# If overnight is bad when you wake:
./scripts/admin-agent/restore-pre-sleep.sh
# or tell Grok: "go back to before I went to sleep"
```

## Safety (hard)

| Rule | Value |
|------|--------|
| Deploy / push / merge `main` | **OFF** |
| Worktrees only | `admin/*` |
| CONNECTIVITY_LOCK | no force_relay always-on, no docker coturn, no double-offer thrash |
| Play Console / bulk APK site | **human only** |
| Local APK build | **Grok owns** (Claude does not run `build-apk-local`) |

## Baseline when you slept

| Item | Value |
|------|--------|
| APK / AAB | **0.1.148 · vc156** (`mobile/artifacts/`) |
| Shipped polish | Friends Online/Call/Chat · Live soft toasts · settings notify copy · gifts mid-chat · Stop one-tap |
| Open-on-PC | Design only — `docs/OPEN_ON_PC_QR.md` |
| Hub last known | Often **YELLOW_slow** MTO — **do not thrash connect** unless RED (0 offers) |
| WIP | Large uncommitted tree on machine — **pre-sleep snapshot** is restore point |

## Priority ladder (Claude queue)

### P0 — hygiene / forensics (first)

| # | Task | Outcome |
|---|------|---------|
| 040 | Hub forensics handoff | Read-only metrics + morning note; **no connect rewrite** unless RED zero-offer |
| 041 | DEVICE_SMOKE + play checklist refresh | Version **0.1.148**, morning smoke list accurate |

### P1 — Play UX polish (core overnight)

| # | Task | Outcome |
|---|------|---------|
| 042 | Settings soft errors → toast | Parity with Live/Friends (keep confirm for destructive) |
| 043 | Match history labeled CTAs | Same density as Friends row Call/Chat |
| 044 | Home online-friends strip polish | Clear Online + Call when ≥1 friend online |
| 045 | Open-on-PC phase 1 UI stub | Unwired sheet from `OPEN_ON_PC_QR.md` (static URL + friend code) |

### P2 — if time / rate limit allows

| # | Task | Outcome |
|---|------|---------|
| 046 | i18n overlay fill | Copy EN keys into thin overlays for notify/friends/live strings only |
| 047 | Web residual soft UX | Only if remaining ugly confirms/toasts on web live (no SDP/offer edits) |

### Blocked (do not pull)

| File | Why |
|------|-----|
| `blocked/034-prefer-direct-or-quality-labels.md` | After human OK + P0 connect green |
| Connect thrash / force_relay / coturn docker | CONNECTIVITY_LOCK |
| Play Console upload | Human |

### Auto-enqueue policy tonight

- **Zero offers (RED)** → still auto-enqueue (real outage).
- **Slow MTO** → threshold raised (`SLOW_OFFER_MS=15000`) so normal YELLOW does not eat the night.
- If auto slow task appears: **forensics + RESULT only**, no speculative offer-path rewrite.

## Timeline (America/Edmonton · MDT)

| When | What |
|------|------|
| ~00:15 | Snapshot + queue + `nightly.sh` start |
| 00:15 → 06:30 | If Claude rate-limited → backoff; Grok manager may re-rank |
| ~06:35+ | Claude burns P0→P1 queue in worktrees |
| Every 2 Claude successes | Grok mid-night judge → `JUDGE-LATEST.md` |
| Last cycle / stop | `MORNING-BRIEF.md` |
| Stop hour | **15:00** local |

## When you wake

```bash
cd ~/freenet-roulette
./scripts/admin-agent/morning.sh
./scripts/admin-agent/status.sh
# optional hub pulse:
./scripts/hub-match-speed.sh 30   # if script exists
```

| Check | Pass |
|-------|------|
| `reports/MORNING-BRIEF.md` | Readable one-pager |
| `admin/*` branches | Real diffs, not empty thrash |
| Play↔PC smoke | Both video on APK **0.1.148+** + browser hard-refresh |
| Merge | Only after smoke; Grok builds next APK if mobile changed |
| Deploy | Only after you say so |

## Explicitly out of scope overnight

- Production deploy, coturn/docker, droplet
- `git push` / merge to `main`
- Play Console upload
- Bulk APKs on website
- Prefer Direct (034)
- Live match handoff protocol (Open-on-PC phase 3)

## Agent config knobs (tonight)

See `scripts/admin-agent/config.env`:

- `ALLOW_DEPLOY=0`
- `ENABLE_CLAUDE=1` · worktrees · Ralph · auto-commit on `admin/*`
- `SLOW_OFFER_MS=15000` (severe only)
- `CLAUDE_RESET_LOCAL=06:30`
- `NIGHTLY_STOP_HOUR=15` · interval ~40m · max 12 cycles
