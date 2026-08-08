# Overnight 9-hour plan — Play ↔ browser (connect first)

**Sleep window:** ~9 hours from pre-sleep  
**Claude useful window:** after ~06:30 local (session reset) until stop hour  
**Restore:** `./scripts/admin-agent/restore-pre-sleep.sh`  
**Or tell Grok:** *go back to before I went to sleep*

## North star

Open **Play app** + **PC browser** → both cameras + audio **fast** and stable, then bring Play UX up to (or past) browser for live features.

Hub live (**2026-08-07 ~14:38**): offers≈answers OK, but **match→offer max ~24s** (**YELLOW_slow**, drops=6). That is still #1 — see pending **`001b`**.

## Safety (do not change)

| Rule | Value |
|------|--------|
| Deploy / push | **OFF** |
| Worktrees only | `admin/*` |
| Snapshot | `backups/LATEST_PRE_SLEEP` |
| CONNECTIVITY_LOCK | no force_relay always-on, no docker coturn, no double-offer thrash |

## Priority ladder (what Claude should do first)

### Must (P0) — connect

| # | Task file | Outcome | Status |
|---|-----------|---------|--------|
| 1 | `001-connect-slow-offer.md` | Root cause + minimal fix for match→offer >> 2s | COMPLETE (audit; no residual stall) — **do not re-open** |
| 1b | **`001b-connect-yellow-slow-mto.md`** | Live YELLOW max MTO ~24s: forensics + one fix or smoke handoff | **START for Claude** |
| 2 | `002-mobile-answer-path.md` | Phone answer/promote path not silent for 12s+ | COMPLETE — **human smoke** (superseded by ship; do not merge stale admin) |
| 3 | `003-offer-thrash.md` | Fewer hub `offer dropped` / second-offer races | COMPLETE — **human smoke** (superseded by ship) |
| 4 | `004-web-kicksolo-speed.md` | Browser warm-cam / kickSolo path fires offer fast | COMPLETE (audit) |

### Should (P1) — Play feels like browser

| # | Task file | Outcome | Status |
|---|-----------|---------|--------|
| 5 | `020-cam-mute-parity.md` | Same mute/hide meaning both sides | COMPLETE (ship / 021b path) |
| 6 | `021-background-keepalive-reconnect.md` | Leave app 30s → recover + banner | COMPLETE (optional residual: `onReconnectStart` wire → 021c if needed) |
| 6b | `021b-cam-mute-parity-reapply.md` | Re-land 020 copy fix | COMPLETE (superseded on ship) |
| 7 | `022-friend-call-ring-parity.md` | Ring / accept / miss clearer on Play | COMPLETE — **human merge** `admin/…-022` after smoke |
| 8 | `023-web-friend-call-notify.md` | Tab open but unfocused still alerts | **After 001b** |

### Nice (P2/P3) — only if P0/P1 done

| # | Task file | Outcome |
|---|-----------|---------|
| 9 | `033-chat-gifts-parity-audit.md` | Fix only real gift/chat gaps |
| 10 | `035-geo-city-map-expand.md` | More RU city names |
| 11 | `036-play-store-checklist-docs.md` | Morning Play internal-test checklist |
| 12 | `090-open-on-pc-qr-design.md` | Design only (no protocol rewrite) |

### Blocked (do not pull until smoke green)

| File | Why |
|------|-----|
| `blocked/034-prefer-direct-or-quality-labels.md` | Prefer Direct / ICE policy — after P0 green + human OK |

## Timeline (local America/Edmonton)

| When | What |
|------|------|
| Now → 06:30 | Agent sleeps (Claude rate limit). Forensics-only if it wakes. |
| ~06:35 | Claude starts **Must** queue (001→004) |
| Morning | **Should** queue (020→023) |
| If time left | **Nice** queue (033, 035, 036, 090) |
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

## Dual-agent overnight (v4.2)

- **Claude** implements tickets on `admin/*`
- **Grok manager** while Claude rate-limited → `MANAGER-LATEST.md`
- **Grok judge** every 2 Claude successes → `JUDGE-LATEST.md`
- **Grok morning** last cycle → `MORNING-BRIEF.md`
