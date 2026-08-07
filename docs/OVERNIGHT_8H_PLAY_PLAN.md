# Overnight 8-hour plan — Play app parity + polish

**Created:** 2026-08-07 (pre-sleep)  
**Window:** ~8 hours of admin-agent cycles (Claude on `admin/*` worktrees only)  
**Restore:** `./scripts/admin-agent/restore-pre-sleep.sh` or tell Grok: *go back to before I went to sleep*

## Safety rails

| Rule | Setting |
|------|---------|
| Production deploy | **OFF** (`ALLOW_DEPLOY=0`) |
| git push | **never** |
| Isolation | Claude only on `admin/*` worktrees |
| Pre-sleep snapshot | `backups/LATEST_PRE_SLEEP` + `backup/LATEST-pre-sleep-wip` |
| CONNECTIVITY_LOCK | No force_relay / docker coturn / double-offer thrash |

## Goal for the night

Bring **Google Play (Android) app** closer to (and past) **browser** quality for the features we already ship on web, without breaking Play↔PC connect.

```
P0 connect instrumentation / answer-path docs  →  already partially done
P1 cross-platform UX parity (cam mute, friend ring, background)
P2 Play polish (settings, geo, quality labels, store checklist)
P3 nice-to-haves if time (Prefer Direct, Open-on-PC QR design only)
```

## Hour-by-hour (approximate)

| Hour | Focus | Queue IDs |
|------|--------|-----------|
| 0 | Snapshot + forensics + hub speed | (ops) |
| 1 | Cam mute parity labels/behavior | 020 |
| 2 | Web friend-call unfocused notify | 021 |
| 3 | Mobile answer-path / promote watchdog audit | 030 |
| 4 | Background call keep-alive + reconnect banner | 031 |
| 5 | Friend call ring / miss UI parity on Play | 032 |
| 6 | Chat + typing + gifts parity audit (fix only if gap) | 033 |
| 7 | Prefer Direct setting on Android **or** quality preset labels | 034 |
| 7–8 | Geo city map expand + Play store checklist docs | 035–036 |
| Last cycle | Grok MORNING-BRIEF + branch list | (ENABLE_GROK) |

If Claude rate-limits, tasks stay in `pending` / requeue — not deleted.

## Success in the morning

1. `./scripts/admin-agent/morning.sh` shows brief + branches  
2. `git branch --list 'admin/*'` has candidate merges  
3. You smoke Play↔PC (`docs/DEVICE_SMOKE.md` connect section)  
4. Merge only green branches; **or** restore snapshot if bad  

## Restore one-liner

```bash
cd ~/freenet-roulette && ./scripts/admin-agent/restore-pre-sleep.sh
```

## Not in scope overnight

- Production deploy / coturn / droplet  
- Play Store console upload  
- Bulk APKs on website  
- Full web-push service worker infra (021 is tab-unfocused only)  
