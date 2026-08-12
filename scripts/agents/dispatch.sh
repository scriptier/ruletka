#!/usr/bin/env bash
# Dispatch one Claude task: pending → running → worktree → claude -p.
#
# Usage:
#   ./scripts/agents/dispatch.sh                         # next pending
#   ./scripts/agents/dispatch.sh path/to/task.md         # specific
#   ./scripts/agents/dispatch.sh --wait path/to/task.md  # block until exit
#   WAIT=1 ./scripts/agents/dispatch.sh
set -euo pipefail
# shellcheck source=lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
agents_load

WAIT=0
TASK_ARG=""
for a in "$@"; do
  case "$a" in
    --wait|-w) WAIT=1 ;;
    --help|-h)
      sed -n '2,12p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) TASK_ARG="$a" ;;
  esac
done
[[ "${WAIT:-0}" == "1" ]] && WAIT=1

if [[ -z "${CLAUDE_BIN:-}" || ! -x "$CLAUDE_BIN" ]]; then
  echo "FAIL: claude CLI not found (install Claude Code or set CLAUDE_BIN)" >&2
  exit 1
fi

# Pick task
if [[ -n "$TASK_ARG" ]]; then
  if [[ -f "$TASK_ARG" ]]; then
    TASK="$TASK_ARG"
  elif [[ -f "$PENDING/$(basename "$TASK_ARG")" ]]; then
    TASK="$PENDING/$(basename "$TASK_ARG")"
  else
    echo "FAIL: task not found: $TASK_ARG" >&2
    exit 1
  fi
else
  TASK=$(ls -1 "$PENDING"/*.md 2>/dev/null | sort | head -1 || true)
  if [[ -z "${TASK:-}" ]]; then
    echo "IDLE: no pending tasks in $PENDING"
    exit 0
  fi
fi

base="$(basename "$TASK")"
slug="${base%.md}"

# Already running?
if [[ -f "$LOGS/claude.pid" ]]; then
  opid=$(cat "$LOGS/claude.pid" 2>/dev/null || true)
  if [[ -n "${opid:-}" ]] && kill -0 "$opid" 2>/dev/null; then
    echo "FAIL: Claude already running pid=$opid (see ./scripts/agents/status.sh)" >&2
    exit 2
  fi
fi

# Move pending → running
if [[ "$TASK" == "$PENDING/"* ]]; then
  mv "$TASK" "$RUNNING/$base"
  TASK="$RUNNING/$base"
fi
echo "TASK=$TASK"

agents_sync_to_worktree

# Ensure task body is in worktree
mkdir -p "$WT/tasks/admin-queue/running" "$WT/tasks/admin-queue/done"
cp -a "$TASK" "$WT/tasks/admin-queue/running/$base"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOG="$LOGS/claude-${STAMP}-${slug}.out"
PROMPT_FILE="$LOGS/prompt-${STAMP}-${slug}.md"
agents_wrap_prompt "$TASK" >"$PROMPT_FILE"

echo "WORKTREE=$WT"
echo "LOG=$LOG"
echo "PROMPT=$PROMPT_FILE"

# Non-interactive factory: --print + bypassPermissions so Claude is not
# stuck on TTY permission prompts with empty log (0-byte hang).
RUNNER=(
  "$CLAUDE_BIN"
  -p "$(cat "$PROMPT_FILE")"
  --print
  --output-format text
  --allowedTools "Read,Edit,Write,Bash,Glob,Grep"
  --permission-mode bypassPermissions
)
if command -v stdbuf >/dev/null 2>&1; then
  RUNNER=( stdbuf -oL -eL "${RUNNER[@]}" )
fi

cd "$WT"
# shellcheck disable=SC2086
nohup "${RUNNER[@]}" >"$LOG" 2>&1 &
pid=$!
echo "$pid" >"$LOGS/claude.pid"
echo "$LOG" >"$LOGS/claude.logpath"
echo "$TASK" >"$LOGS/claude.task"
echo "CLAUDE_PID=$pid"
echo "dispatched $slug"

if [[ "$WAIT" == "1" ]]; then
  echo "waiting (timeout ${CLAUDE_TIMEOUT_SEC}s)…"
  elapsed=0
  while kill -0 "$pid" 2>/dev/null; do
    sleep 5
    elapsed=$((elapsed + 5))
    if (( elapsed >= CLAUDE_TIMEOUT_SEC )); then
      echo "TIMEOUT killing $pid" >&2
      kill "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
      mv "$TASK" "$FAILED/$base" 2>/dev/null || true
      echo "FAIL: timeout" >&2
      exit 3
    fi
  done
  wait "$pid" || true
  ec=$?
  echo "Claude exit=$ec"
  # harvest + promote
  bash "$AGENTS/harvest.sh" "$slug" || true
  if grep -q 'COMPLETE' "$DONE"/*"${slug}"*RESULT* 2>/dev/null \
    || grep -q 'COMPLETE' "$LOG" 2>/dev/null; then
    echo "STATUS=COMPLETE"
    # leave task note in done
    cp -a "$TASK" "$DONE/$base" 2>/dev/null || true
    rm -f "$TASK"
    exit 0
  fi
  if [[ "$ec" -ne 0 ]]; then
    mv "$TASK" "$FAILED/$base" 2>/dev/null || true
    echo "STATUS=FAILED"
    exit 1
  fi
  # finished but no COMPLETE — leave in running for Grok review
  echo "STATUS=NEEDS_REVIEW (no COMPLETE in RESULT)"
  exit 0
fi

echo "background — poll: ./scripts/agents/status.sh"
echo "when done:   ./scripts/agents/harvest.sh $slug"
