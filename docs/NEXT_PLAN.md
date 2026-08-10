# Next plan — product + automation (2026-08-09)

**Baseline:** APK **0.1.229 vc237** (auto-build) · Continuous Claude · CONNECTIVITY_LOCK  
**North star:** You sleep / AFK → Claude drains queue → auto unit + APK when mobile changes; you only smoke + Play.

---

## A. Automation (do first — no “proceed”)

| # | Action | Status |
|---|--------|--------|
| A1 | Continuous worker `start-sleep-shift.sh` | **On** (keeps Claude busy) |
| A2 | Backlog auto-refill when pending empty | **On** (6+ backlog tasks) |
| A3 | Cron: `@reboot` start continuous + hourly watchdog | **Install now** |
| A4 | Nightly forensics (00:30) + morning brief (08:00) | **Already in crontab** |
| A5 | Status / stop without chat | `./scripts/agents/status.sh` / `stop-sleep-shift.sh` |
| A6 | **Auto-build APK** after harvest if `mobile/` changed | `scripts/agents/auto-build.sh` (wired in harvest) |
| A7 | Skip re-running COMPLETE tasks | continuous.sh promote/skip |

**You never type proceed for:** i18n, friends polish, unit tests, docs, hotkeys CSS, APK bump.

---

## B. Human (minutes, not hours)

| # | When | Action |
|---|------|--------|
| B1 | Today | `adb install -r mobile/artifacts/ruletka-android-latest.apk` (**0.1.229 · 237**) |
| B2 | After B1 | Privacy smoke: eye blur → Show video · Settings blur auto-save |
| B3 | After green smoke | `cd mobile && ./scripts/build-aab-local.sh` then Play Internal |
| B4 | Morning | `status.sh` · skim RESULT files · merge only if needed |
| B5 | Weekly | `./scripts/connect-scorecard.sh 60` after a real match |

---

## C. Product priority (after B1–B3)

| Priority | Work | Who |
|----------|------|-----|
| P0 | Blur confirmed on device (228) | **You** smoke |
| P1 | Play Internal on 228 | **You** Console |
| P2 | Claude queue: 055 friends, 056 tests, 057 web i18n, backlog 058–063 | **Claude continuous** |
| P3 | Grok: harvest review, rebuild APK only if Claude landed mobile UX | **Grok** when chat open |
| P4 | Connect speed only if scorecard RED | **Grok** + lock |
| Parked | SFU, Prefer Direct Android, claim-ticket Open-on-PC | Later |

---

## D. How the factory runs without you

```text
┌─ continuous.sh (always, PC on) ─────────────────────┐
│  pending → Claude --wait → harvest → unit smoke      │
│  pending empty → pull backlog → continue             │
│  idle 3m if nothing → recheck                        │
└──────────────────────────────────────────────────────┘
         │
┌─ cron 00:30 nightly.sh ─────────────────────────────┐
│  hub forensics · auto-enqueue RED · Claude worktrees │
│  (skips if continuous holds Claude — OK)             │
└──────────────────────────────────────────────────────┘
         │
┌─ cron 08:00 morning.sh ─────────────────────────────┐
│  brief for you                                       │
└──────────────────────────────────────────────────────┘
         │
┌─ YOU ────────────────────────────────────────────────┐
│  smoke APK · Play upload · “still broken” in chat    │
└──────────────────────────────────────────────────────┘
```

---

## E. Commands cheat sheet

```bash
# Living status
./scripts/agents/status.sh
tail -f scripts/claude-logs/continuous-$(date -u +%Y%m%d).log

# Sleep shift
./scripts/agents/start-sleep-shift.sh
./scripts/agents/stop-sleep-shift.sh

# Add work for Claude (anytime)
./scripts/agents/enqueue.sh auto "my-polish" <<'EOF'
# Task: …
## Goal
…
## Scope
- path
## Done criteria
- [ ] RESULT + COMPLETE
## Do not
- deploy / connect
EOF

# After match
./scripts/connect-scorecard.sh 60
```

---

## F. Success this week

| Metric | Target |
|--------|--------|
| Claude COMPLETE tasks | ≥ 8 (054–063 + backlog) |
| You typing “proceed” for polish | **0** |
| 0.1.228 on device + Play Internal | Done |
| Dual-offer thrash | 0 |
| Continuous uptime while PC on | Always (watchdog) |
