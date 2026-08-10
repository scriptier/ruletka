# Agent factory — vibecoder patterns for Ruletka

How overnight automation maps to patterns used by Claude/Cursor power users.

## Stack (what we run)

```
cron 00:30 → nightly.sh
  └─ cycle:
       hub forensics → RED alerts → auto-enqueue
       Claude in git worktree (admin/*)
       verify (geo / tsc / connect-ui)
       Ralph retry if verify fails
       auto-commit on admin branch (no push)
       Grok review on last cycle → MORNING-BRIEF
human morning → smoke → merge → (optional) deploy
```

## Pattern map

| Vibecoder pattern | Our implementation |
|-------------------|--------------------|
| Spec-first tasks | `enqueue.sh` template + `prompts/task-template.md` |
| CLAUDE.md always-on | root `CLAUDE.md` |
| Worktree isolation | `ENABLE_BRANCH_ISOLATION=1` → `.admin-worktrees/` |
| Ralph / retry loop | `ENABLE_RALPH_RETRY=1`, `RALPH_MAX_ATTEMPTS` |
| Verify gate | `ENABLE_VERIFY=1` (geo, tsc, connect-ui) |
| Commit not merge | `ENABLE_AUTO_COMMIT=1` on `admin/*` only |
| Plan → build → judge | Claude wrapper + Grok `MORNING-BRIEF` |
| Human deploy gate | `ALLOW_DEPLOY=0` forever until connect is boring |
| Fresh context / task | one queue file per Claude invocation |
| Self-feeding backlog | hub RED/YELLOW → `005/006/007-auto-*` tasks |
| Rate-limit backoff | parse reset time, sleep until `CLAUDE_RESET_LOCAL` |
| MTO without hub field | timestamp match→offer delta in forensics |
| Pre-sleep restore | `snapshot-pre-sleep.sh` / `restore-pre-sleep.sh` |
| Mid-night Grok judge | every N Claude successes → `JUDGE-LATEST.md` |
| Grok manager on rate-limit | re-rank queue → `MANAGER-LATEST.md` |

## Commands

```bash
./scripts/admin-agent/status.sh
./scripts/admin-agent/run-once.sh --forensics-only
./scripts/admin-agent/run-once.sh
./scripts/admin-agent/morning.sh
./scripts/admin-agent/enqueue.sh 030 "short-slug" <<'EOF'
# use prompts/task-template.md structure
EOF
```

## Auto-build (mobile, sideload-only)

`./scripts/agents/auto-build.sh` bumps version + runs `mobile/scripts/build-apk-local.sh` when
`mobile/app|src|app.json` changed since the last build stamp (`artifacts/agents/last-apk-build.stamp`).
Gated on unit smoke passing; never touches Play or the public site. See `docs/NEXT_PLAN.md` (A6).

## Safety

- Overnight **never** deploys or pushes
- Merge only after Play↔PC smoke + morning review
- See `docs/CONNECTIVITY_LOCK.md` and `docs/DUAL_AGENT_WORKFLOW.md`

## Config knobs (`scripts/admin-agent/config.env`)

| Flag | Default | Meaning |
|------|---------|---------|
| `ENABLE_RALPH_RETRY` | 1 | Re-run Claude with verify failures |
| `RALPH_MAX_ATTEMPTS` | 2 | Max Claude attempts per task |
| `ENABLE_AUTO_COMMIT` | 1 | Commit in worktree after success |
| `ENABLE_BRANCH_ISOLATION` | 1 | git worktree per task |
| `ENABLE_VERIFY` | 1 | Post-Claude checks |
| `ALLOW_DEPLOY` | 0 | Must stay off overnight |
