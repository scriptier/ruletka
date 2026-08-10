# Grok + Claude dual-agent factory (maximum utilization)

**Goal:** Claude always has scoped work; Grok keeps planning, connect risk, deploy, APK, and merge. You pay for Claude — the factory keeps it busy.

---

## Roles (hard)

| Agent | Owns | Never alone |
|-------|------|-------------|
| **Grok** | Priority, plans, CONNECTIVITY_LOCK, hub/TURN, deploy, APK/AAB, harvest review, merge | Blind full-file rewrites without a task |
| **Claude** | Scoped implement: i18n, UI polish, unit tests, docs, refactors, parity fill | Deploy, push, coturn, bulk APK site |
| **You** | Device smoke, Play Console, product calls | — |

**Target utilization:** Claude **≥60% of implementation volume** on non-connect lanes; Grok **100% of connect/ops** + review.

---

## Daily loop (15–40 min cycles)

```text
GROK:  diagnose / plan / pick lane
GROK:  write 1–3 tasks → tasks/admin-queue/pending/
GROK:  ./scripts/agents/loop.sh 3     # Claude drains queue (wait mode)
GROK:  review harvest + RESULT
GROK:  APK / UI_ONLY only if needed
YOU:   smoke when media/blur
```

**Rule:** while Claude runs `--wait` on polish, Grok does **not** re-implement the same files — Grok does connect forensics, APK, docs scorecard, or next task briefs.

---

## Commands

```bash
cd ~/freenet-roulette

# Queue status + live Claude
./scripts/agents/status.sh

# Enqueue
./scripts/agents/enqueue.sh auto "friends-empty-polish" <<'EOF'
# Task: …
## Goal
…
## Scope
- mobile/app/friends.tsx
## Done criteria
- [ ] …
- [ ] RESULT + COMPLETE
## Do not
- deploy / connect path
EOF

# One task (background)
./scripts/agents/dispatch.sh

# One task (block until done + harvest + unit smoke)
./scripts/agents/dispatch.sh --wait

# Drain up to N pending
./scripts/agents/loop.sh 5

# Manual harvest if background dispatch
./scripts/agents/harvest.sh 054-i18n-blur-overlay-sync
```

Legacy: `./scripts/claude-run.sh task.md` still works; prefer `agents/dispatch.sh`.

---

## What Claude should get every day (fill the queue)

| Bucket | Examples | Verify |
|--------|----------|--------|
| **i18n** | overlay packs, missing keys | unit / visual |
| **UI polish** | friends empty, settings copy, banners | tsc |
| **Tests** | `*.test.mjs`, pair-smoke budgets | `dev-smoke --unit` |
| **Docs** | DEVICE_SMOKE checklists, parity notes | — |
| **Parity fill** | web↔mobile copy, soft toasts | scoped files |
| **Review assist** | “diff this RESULT vs goal” | — |

**Grok keeps:** blur SurfaceView, MediaSession, offer/ICE, hub, coturn, push.sh, AAB.

---

## Task quality (so Claude succeeds)

Every task must have:

1. **One goal** (measurable)  
2. **Scope file list** (≤5 paths)  
3. **Done criteria** checkboxes  
4. **Do not** list (connect/deploy)  
5. **COMPLETE** promise in RESULT  

Template: `scripts/admin-agent/prompts/task-template.md`

---

## Parallelism (safe)

| Safe | Unsafe |
|------|--------|
| Claude on i18n while Grok builds APK | Both edit `live.tsx` |
| Claude on friends.tsx while Grok hub SSH | Both edit same overlay file |
| Claude unit tests while Grok writes plan | Claude deploy |

One Claude process at a time (dispatch guards with pid file). Multiple tasks = sequential `loop.sh`.

---

## Sleep shift (PC stays on — no “proceed”)

```bash
# Before bed — Claude works all night on pending + backlog
./scripts/agents/start-sleep-shift.sh

# Morning
./scripts/agents/status.sh
./scripts/agents/stop-sleep-shift.sh   # if still running
./scripts/admin-agent/morning.sh
```

| Piece | Path |
|-------|------|
| Continuous worker | `./scripts/agents/continuous.sh` |
| Start background | `./scripts/agents/start-sleep-shift.sh` |
| Stop | `./scripts/agents/stop-sleep-shift.sh` |
| Pending jobs | `tasks/admin-queue/pending/*.md` |
| Extra jobs when pending empty | `tasks/admin-queue/backlog/*.md` (auto-pulled) |
| Live log | `scripts/claude-logs/continuous-YYYYMMDD.log` |

**Safety:** never deploys (`ALLOW_DEPLOY` N/A here). Only runs scoped task files. Connect/media only if a task says so (don’t put those in backlog).

## Overnight vs daytime

| Mode | Command |
|------|---------|
| **Sleep shift (recommended)** | `./scripts/agents/start-sleep-shift.sh` |
| Daytime batch | `./scripts/agents/loop.sh 5` |
| Overnight forensics factory | `./scripts/admin-agent/nightly.sh` (cron 00:30) |
| Morning | `./scripts/admin-agent/morning.sh` (cron 08:00) |

Same queue: `tasks/admin-queue/pending/` + `backlog/`.

---

## Metrics (are we getting value?)

| Metric | Target |
|--------|--------|
| Pending tasks end of day | 0–2 (not empty for days, not 20 stuck) |
| Claude COMPLETE / week | ≥10 scoped tasks |
| Grok re-doing Claude work | &lt;10% of files |
| Connect regressions from Claude | **0** (scope bans) |

```bash
ls tasks/admin-queue/done/*RESULT* | wc -l
./scripts/agents/status.sh
```

---

## Failure modes

| Symptom | Fix |
|---------|-----|
| Claude log 0 bytes forever | kill pid; re-dispatch; check `claude` auth |
| No COMPLETE | Grok reads log; re-enqueue with tighter scope |
| VERIFY=FAIL after harvest | fix or move to failed/; do not APK |
| Queue starvation | Grok’s job: always leave ≥2 pending polish tasks |

---

## Grok standing order (this is the product)

When user says **proceed** or after finishing heavy work:

1. If `pending` &lt; 2 → **write 2+ Claude tasks** before more Grok coding  
2. Run `./scripts/agents/loop.sh 2` (or dispatch --wait)  
3. Then Grok continues APK/connect/deploy  
4. Harvest/review Claude RESULTs before next media APK  

Claude is not optional polish — it is the default implementer for non-connect lanes.
