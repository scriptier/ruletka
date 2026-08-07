# Overnight Admin Agent (v4)

Unattended **automation loop** for ruletka, using vibecoder factory patterns: hub forensics → RED alerts → auto-queue → Claude (worktree) → verify → Ralph retry → auto-commit on `admin/*` → Grok brief → **you** merge/smoke/deploy.

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

## v4 upgrades (vibecoder patterns)

1. Root **`CLAUDE.md`** always-on rules  
2. Spec-first **task template** + completion promise `COMPLETE`  
3. **Ralph retry** — re-run Claude with verify failure feedback (`RALPH_MAX_ATTEMPTS`)  
4. **Auto-commit** on `admin/*` only — never push/merge  
5. Structured **RESULT** handoff for morning review  
6. Plan → build → verify instructions in Claude wrapper  
7. `docs/AGENT_FACTORY.md` pattern map  

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
