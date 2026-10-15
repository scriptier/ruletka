# Grok loop tick (max 5 agents)

You are the **director**. Assign work so **up to 5** subagents run with **non-overlapping OWN**.

## Every tick

1. `ls tasks/grok-loop/running tasks/grok-loop/pending tasks/grok-loop/backlog 2>/dev/null`
2. `./scripts/agents/status.sh` (Claude continuous)
3. Count running Grok jobs you started this session; if ≥5, only harvest/status — do not spawn.
4. Free slots = 5 − running. For each free slot:
   - Pick next `tasks/grok-loop/backlog/*.md` by name sort
   - Move to `tasks/grok-loop/running/`
   - `spawn_subagent` general-purpose background with full job card as prompt
   - OWN from card only; Must not: deploy/APK unless card says; no pool>0
5. For any `tasks/grok-loop/running/*` with RESULT in `done/` or agent completed: move to done, note harvest.
6. If Claude backlog+pending < 2: `./scripts/agents/auto-enqueue-backlog.sh`
7. If Claude continuous dead and no stop flag: start with AUTO_REFILL=1
8. Short status only (counts + which lanes assigned)

## Priority product finish

P0 multi 3/4-way · P1 friends/settings · P1 MediaSession · P2 Play docs

## Never

- Dual-write live.js and same file with Claude
- Force-push, Play upload without human
- Claim multi fixed without human smoke
