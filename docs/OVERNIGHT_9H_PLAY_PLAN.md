# Overnight 9-hour plan — Play ↔ browser (connect first)

**Sleep window:** ~9 hours from pre-sleep  
**Claude useful window:** after ~06:30 local (session reset) until stop hour  
**Restore:** `./scripts/admin-agent/restore-pre-sleep.sh`  
**Or tell Grok:** *go back to before I went to sleep*

## North star

Open **Play app** + **PC browser** → both cameras + audio **fast** and stable, then bring Play UX up to (or past) browser for live features.

Hub recently: offers≈answers OK, but **match→offer ~25s** (YELLOW). That is the night’s #1 problem.

## Safety (do not change)

| Rule | Value |
|------|--------|
| Deploy / push | **OFF** |
| Worktrees only | `admin/*` |
| Snapshot | `backups/LATEST_PRE_SLEEP` |
| CONNECTIVITY_LOCK | no force_relay always-on, no docker coturn, no double-offer thrash |

## Priority ladder (what Claude should do first)

### Must (P0) — finish before polish

| # | Task file | Outcome |
|---|-----------|---------|
| 1 | `001-connect-slow-offer.md` | Root cause + **minimal** fix for match→offer >> 2s |
| 2 | `002-mobile-answer-path.md` | Phone answer/promote path not silent for 12s+ |
| 3 | `003-offer-thrash.md` | Fewer hub `offer dropped` / second-offer races |
| 4 | `004-web-kicksolo-speed.md` | Browser warm-cam / kickSolo path fires offer fast |

### Should (P1) — Play feels like browser

| # | Task file | Outcome |
|---|-----------|---------|
| 5 | `020-cam-mute-parity.md` | Same mute/hide meaning both sides |
| 6 | `031-background-keepalive-reconnect.md` | Leave app 30s → recover + banner |
| 7 | `032-friend-call-ring-parity.md` | Ring / accept / miss clearer on Play |
| 8 | `021-web-friend-call-notify.md` | Tab open but unfocused still alerts |

### Nice (P2/P3) — only if P0/P1 done

| # | Task file | Outcome |
|---|-----------|---------|
| 9 | `033-chat-gifts-parity-audit.md` | Fix only real gift/chat gaps |
| 10 | `034-prefer-direct-or-quality-labels.md` | One small settings win |
| 11 | `035-geo-city-map-expand.md` | More RU city names |
| 12 | `036-play-store-checklist-docs.md` | Morning Play internal-test checklist |
| 13 | `090-open-on-pc-qr-design.md` | Design only (no protocol rewrite) |

## Timeline (local America/Edmonton)

| When | What |
|------|------|
| Now → 06:30 | Agent sleeps (Claude rate limit). Forensics-only if it wakes. |
| ~06:35 | Claude starts **Must** queue (001→004) |
| Morning | **Should** queue (020, 031, 032, 021) |
| If time left | **Nice** queue |
| Last cycle before stop | Grok `MORNING-BRIEF.md` |
| Stop hour | **15:00** local (covers ~9h sleep from ~04:30–06:00) |

## Success when you wake

```bash
cd ~/freenet-roulette
./scripts/admin-agent/morning.sh
./scripts/hub-match-speed.sh 30
```

| Check | Pass |
|-------|------|
| Hub verdict | PASS or at least better max MTO |
| `admin/*` branches | Reviewable, not empty thrash |
| Play↔PC smoke | Both video, no Next spam 15s |
| If disaster | `./scripts/admin-agent/restore-pre-sleep.sh` |

## Explicitly out of scope

- Production deploy, coturn/docker, droplet  
- Play Console upload  
- Bulk APKs on website  
- Full web-push service worker  
- Branding redesign  

## Agent config (overnight)

- `ALLOW_DEPLOY=0`
- Worktree isolation + Ralph retry + auto-commit on `admin/*`
- Rate-limit backoff to ~06:30
- Max ~12 cycles, interval ~40 min, stop hour **15**
