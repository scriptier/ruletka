---
name: claude-worker
description: >
  Launch Claude Code as a worker subagent under Grok director for freenet-roulette.
  Use when user says use Claude, fire Claude, second critic Claude, dual agent,
  or multi-lane work with non-overlapping OWN. Maps to scripts/agents factory.
metadata:
  short-description: "Claude Code worker under Grok (dispatch/queue)"
---

# Claude worker (subagent under Grok)

**Stance:** Grok directs. Claude implements or criticizes in a **worktree**. Human smokes.

## Roles

| Agent | Does | Does not |
|-------|------|----------|
| Grok | Spec, route, adb/Pixel, APK, deploy (auth), compound, harvest review | Dual-write same files as Claude |
| Claude | Scoped code/tests/docs/RESULT in `~/freenet-roulette-claude` | Deploy, push, pool, ICE thrash, bulk APK site |

## Always

1. **One writer** per OWN file set (Grok **or** Claude, not both).  
2. Task file under `tasks/admin-queue/pending/*.md` with Goal / OWN / Must not / Done.  
3. Prefer `./scripts/agents/dispatch.sh --wait <task>` over raw `claude -p` (worktree + harvest).  
4. After COMPLETE: read RESULT; harvest if needed; Grok re-verify / APK.  
5. Second critic default on multi-file UX/connect ships.

## Commands

```bash
cd /home/drakosik/freenet-roulette
./scripts/agents/status.sh
# enqueue
cat > tasks/admin-queue/pending/NNN-slug.md <<'EOF'
# Title
## Goal
…
## OWN
- paths only
## Must not
- deploy, APK, ICE thrash
## Done
RESULT + COMPLETE
EOF
./scripts/agents/dispatch.sh --wait tasks/admin-queue/pending/NNN-slug.md
# or drain
./scripts/agents/loop.sh 3
```

Legacy one-shot (no worktree harvest):

```bash
claude -p "$(cat artifacts/av-loop/claude-job.md)" --print \
  --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
  --add-dir "$PWD"
```

## Av-loop

`./scripts/av-loop.sh` → `claude-job.md` → Claude **or** `grok-job.md` → Grok — not both thrashing MediaSession.

## Related

- `docs/AGENT_GROK_CLAUDE.md` · `CLAUDE-WORKFLOW.md` · `CLAUDE.md`  
- `docs/AGENT_LOOP_DESIGN.md` · skill `agentic-engineering`  
- Continuous: `./scripts/agents/start-sleep-shift.sh` / `status.sh`
