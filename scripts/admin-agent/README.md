# Overnight Admin Agent (v4.2)

Unattended **dual-agent factory**: hub forensics → Claude implements on `admin/*` → verify/Ralph/commit → **Grok mid-night judge** every N successes → **Grok manager** while Claude rate-limited → morning brief → **you** merge/smoke/deploy.

See also: `docs/AGENT_FACTORY.md`, root `CLAUDE.md`.

## Loop (each cycle)

```
reap hung Claude
    ↓
hub forensics (SSH, read-only)  →  verdict GREEN / YELLOW_* / RED_*
    ↓
RED alert (notify-send + optional webhook)
    ↓
auto-enqueue tasks from metrics (optional)
    ↓
Claude in git worktree on admin/<stamp>-slug  (main stays clean)
    ↓
post-Claude verify (geo + tsc if mobile touched + connect-ui)
    ↓
Ralph retry (if verify FAIL and ENABLE_RALPH_RETRY=1)
    ↓
auto-commit on admin branch only (never push)
    ↓
Grok review on last nightly cycle → MORNING-BRIEF.md
    ↓
git snapshot + append daily report
```

## Safety

| Action | Default |
|--------|---------|
| Production deploy | **OFF** (`ALLOW_DEPLOY=0`) |
| git push | **never** in agent scripts |
| Coturn / docker changes | **never** |
| Auto-commit | `admin/*` worktree only |
| Claude on connect code | yes, must respect CONNECTIVITY_LOCK |
| Pre-sleep restore point | `./scripts/admin-agent/snapshot-pre-sleep.sh` |

### Go back to before sleep

```bash
./scripts/admin-agent/snapshot-pre-sleep.sh   # run BEFORE overnight
./scripts/admin-agent/restore-pre-sleep.sh    # if overnight went bad
# or: tell Grok "go back to before I went to sleep"
```

Branches: `backup/LATEST-pre-sleep-wip` (full WIP), `backup/LATEST-pre-sleep-head` (last commit only).  
Plan: `docs/OVERNIGHT_8H_PLAY_PLAN.md`

## Commands

```bash
cd ~/freenet-roulette

./scripts/admin-agent/status.sh
./scripts/admin-agent/run-once.sh --forensics-only
./scripts/admin-agent/run-once.sh
./scripts/admin-agent/nightly.sh
./scripts/admin-agent/morning.sh

# Spec-first enqueue (uses vibecoder task template)
./scripts/admin-agent/enqueue.sh 030 "fix-foo" <<'EOF'
# Goal
...
EOF
# empty stub:
./scripts/admin-agent/enqueue.sh auto my-task
```

## Cron (local machine timezone)

```cron
30 0 * * * cd /home/drakosik/freenet-roulette && ./scripts/admin-agent/nightly.sh >> scripts/admin-agent/logs/cron.log 2>&1
0 8 * * * cd /home/drakosik/freenet-roulette && ./scripts/admin-agent/morning.sh >> scripts/admin-agent/logs/morning-cron.log 2>&1
```

## Queue

| Dir | Meaning |
|-----|---------|
| `tasks/admin-queue/pending/` | Waiting (sort by filename) |
| `running/` | Claude currently on this |
| `done/` | Finished (ok or verify-fail after retries) |
| `failed/` | Timeout / hard Claude failure |
| `reports/YYYY-MM-DD.md` | Daily log |
| `reports/MORNING-BRIEF.md` | Grok morning one-pager |

### Auto-enqueued tasks (when `ENABLE_AUTO_ENQUEUE=1`)

| Trigger | Task |
|---------|------|
| matches &gt; 0, offers = 0 | `005-auto-zero-offer-DATE.md` |
| match_to_offer_ms &gt; SLOW_OFFER_MS | `006-auto-slow-offer-DATE.md` |
| heavy offer debounce | `007-auto-offer-thrash-DATE.md` |

## v4 / v4.1 upgrades (vibecoder patterns)

1. Root **`CLAUDE.md`** always-on rules  
2. Spec-first **task template** + completion promise `COMPLETE`  
3. **Ralph retry** — re-run Claude with verify failure feedback (`RALPH_MAX_ATTEMPTS`)  
4. **Auto-commit** on `admin/*` only — never push/merge  
5. Structured **RESULT** handoff for morning review  
6. Plan → build → verify instructions in Claude wrapper  
7. `docs/AGENT_FACTORY.md` pattern map  
8. **Rate-limit backoff** — parse `resets 6:30am`, sleep until then (+buffer), don’t thrash tasks  
9. **MTO timestamp fallback** in hub forensics (auto-enqueue YELLOW_slow when field missing)  
10. **Empty worktree cleanup** + richer `status.sh` / pre-sleep restore  
11. Fixed **stop hour** (works for afternoon stop, e.g. 13)  
12. **Grok mid-night judge** every `GROK_JUDGE_EVERY_N_CLAUDE` successes → `JUDGE-LATEST.md`  
13. **Grok manager** during Claude rate-limit → re-rank/sharpen queue → `MANAGER-LATEST.md`  
14. Long rate-limit sleep **chunks** with manager wakes (not totally idle)  

## Branch isolation + morning merge

```
.git worktree → .admin-worktrees/<stamp>-slug
branch        → admin/<stamp>-slug
```

```bash
./scripts/admin-agent/morning.sh
git -C .admin-worktrees/<dir> log --oneline -5
git -C .admin-worktrees/<dir> diff main --stat
# if smoke is green:
git merge admin/<stamp>-slug
```

## Config

```bash
cp scripts/admin-agent/config.env.example scripts/admin-agent/config.env
# ENABLE_RALPH_RETRY, RALPH_MAX_ATTEMPTS, ENABLE_AUTO_COMMIT, …
```
