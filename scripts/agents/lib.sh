#!/usr/bin/env bash
# Shared paths for Grok↔Claude agent factory (daytime + overnight compatible).
set -euo pipefail

agents_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

agents_load() {
  ROOT="$(agents_root)"
  WT="${CLAUDE_WORKTREE:-$HOME/freenet-roulette-claude}"
  QUEUE="$ROOT/tasks/admin-queue"
  PENDING="$QUEUE/pending"
  RUNNING="$QUEUE/running"
  DONE="$QUEUE/done"
  FAILED="$QUEUE/failed"
  LOGS="$ROOT/scripts/claude-logs"
  AGENTS="$ROOT/scripts/agents"
  export PATH="${PATH:-}:$HOME/.local/bin:$HOME/.config/Claude/claude-code/2.1.222"
  CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude || true)}"
  CLAUDE_TIMEOUT_SEC="${CLAUDE_TIMEOUT_SEC:-2400}"
  mkdir -p "$PENDING" "$RUNNING" "$DONE" "$FAILED" "$LOGS" \
    "$ROOT/artifacts/agents"
}

# Paths Claude may write that we rsync back to main (never full-tree).
# NOTE: do NOT harvest whole tasks/ — that re-introduces pending/running COMPLETE dups.
AGENTS_HARVEST_PATHS=(
  mobile/src
  mobile/app
  mobile/scripts
  mobile/src/i18n
  ui/i18n
  ui/i18n.js
  ui/live.html
  ui/live-stage.css
  ui/style.css
  docs
  scripts/agents
)

# Sync main → worktree (Grok is source of truth before Claude starts).
agents_sync_to_worktree() {
  agents_load
  if [[ ! -d "$WT" ]]; then
    echo "FAIL: worktree missing: $WT" >&2
    echo "  git worktree add $WT -b claude/work  (or clone)" >&2
    return 1
  fi
  echo "sync main → $WT"
  # Broad app/UI sync so Claude tasks aren't stale; exclude heavy artifacts.
  rsync -a --delete \
    --exclude node_modules --exclude .expo --exclude android/app/build \
    --exclude android/.gradle --exclude artifacts --exclude '*.apk' \
    --exclude '*.aab' --exclude target --exclude .admin-worktrees \
    --exclude scripts/claude-logs \
    "$ROOT/mobile/" "$WT/mobile/"
  rsync -a \
    --exclude node_modules \
    "$ROOT/ui/" "$WT/ui/"
  rsync -a "$ROOT/docs/" "$WT/docs/" 2>/dev/null || true
  rsync -a "$ROOT/tasks/" "$WT/tasks/"
  rsync -a "$ROOT/scripts/agents/" "$WT/scripts/agents/" 2>/dev/null || true
  rsync -a "$ROOT/scripts/dev-smoke.sh" "$WT/scripts/" 2>/dev/null || true
  rsync -a "$ROOT/CLAUDE.md" "$WT/CLAUDE.md" 2>/dev/null || true
  rsync -a "$ROOT/CLAUDE-WORKFLOW.md" "$WT/CLAUDE-WORKFLOW.md" 2>/dev/null || true
  echo "sync ok"
}

# Harvest worktree → main (allowed paths only).
agents_harvest_from_worktree() {
  agents_load
  local slug="${1:-}"
  echo "harvest $WT → main (slug=${slug:-all})"
  for rel in "${AGENTS_HARVEST_PATHS[@]}"; do
    if [[ -e "$WT/$rel" ]]; then
      if [[ -d "$WT/$rel" ]]; then
        mkdir -p "$ROOT/$rel"
        rsync -a "$WT/$rel/" "$ROOT/$rel/"
      else
        mkdir -p "$(dirname "$ROOT/$rel")"
        rsync -a "$WT/$rel" "$ROOT/$rel"
      fi
      echo "  + $rel"
    fi
  done
  # Pull only done RESULT (not pending/running — prevents COMPLETE re-queue)
  if [[ -d "$WT/tasks/admin-queue/done" ]]; then
    rsync -a "$WT/tasks/admin-queue/done/" "$DONE/"
  fi
  echo "harvest ok"
}

agents_wrap_prompt() {
  # stdin: task body → stdout: full Claude prompt
  local task_path="$1"
  local task_base
  task_base="$(basename "$task_path" .md)"
  cat <<EOF
You are Claude Code on the ruletka dual-agent factory.
Main tree is owned by Grok. You work in worktree: $WT
Grok will harvest your diffs after you finish.

$(cat "$task_path")

## Factory rules (always)
- Stay in scope listed in the task.
- No deploy, no git push, no bulk APK on site.
- No CONNECTIVITY_LOCK / offer / ICE / TURN changes unless task says so.
- Prefer minimal diffs.
- After work: write RESULT to:
  tasks/admin-queue/done/${task_base}-RESULT.md
  Include: Status, Files touched, Verify commands run, Connect risk (none|low|high), and the word COMPLETE if done.
- Run verify from task if listed (e.g. node …test.mjs, dev-smoke --unit).
- If blocked, write RESULT with Status: BLOCKED and stop.

Begin now.
EOF
}
