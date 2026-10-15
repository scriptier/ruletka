#!/usr/bin/env bash
# Dual-agent status: queue + Claude PID + recent logs.
set -euo pipefail
# shellcheck source=lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
agents_load

echo "=== Grok↔Claude agent status ==="
echo "ROOT=$ROOT"
echo "WT=$WT"
echo "CLAUDE_BIN=${CLAUDE_BIN:-missing}"
echo ""

echo "── Queue ──"
printf "pending: %s\n" "$(find "$PENDING" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)"
printf "running: %s\n" "$(find "$RUNNING" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)"
printf "done:    %s\n" "$(find "$DONE" -maxdepth 1 -name '*RESULT*' 2>/dev/null | wc -l)"
printf "failed:  %s\n" "$(find "$FAILED" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)"
echo ""
if ls "$PENDING"/*.md >/dev/null 2>&1; then
  echo "Pending:"
  ls -1 "$PENDING"/*.md | xargs -n1 basename
fi
if ls "$RUNNING"/*.md >/dev/null 2>&1; then
  echo "Running:"
  ls -1 "$RUNNING"/*.md | xargs -n1 basename
fi
echo ""

echo "── Continuous shift ──"
if [[ -f "$LOGS/continuous.lock" ]]; then
  cpid=$(cat "$LOGS/continuous.lock" 2>/dev/null || true)
  if [[ -n "${cpid:-}" ]] && kill -0 "$cpid" 2>/dev/null; then
    echo "RUNNING pid=$cpid"
    ps -p "$cpid" -o pid,etime,cmd 2>/dev/null || true
  else
    echo "lock stale (not running)"
  fi
else
  echo "not running — start: ./scripts/agents/start-sleep-shift.sh"
fi
if [[ -f "$LOGS/continuous.stop" ]]; then
  echo "STOP FLAG present"
fi
printf "backlog: %s\n" "$(find "$QUEUE/backlog" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)"
echo ""

echo "── Claude process ──"
if [[ -f "$LOGS/claude.pid" ]]; then
  pid=$(cat "$LOGS/claude.pid" 2>/dev/null || true)
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    ps -p "$pid" -o pid,etime,cmd
    echo "LOG=$(cat "$LOGS/claude.logpath" 2>/dev/null || echo '?')"
  else
    echo "no live Claude (stale pid file ok)"
  fi
else
  echo "no pid file"
fi
echo ""

echo "── Latest log tail ──"
latest=$(ls -t "$LOGS"/claude-*.out 2>/dev/null | head -1 || true)
if [[ -n "${latest:-}" ]]; then
  echo "$latest ($(wc -c <"$latest") bytes)"
  tail -20 "$latest" 2>/dev/null || true
else
  echo "(no logs)"
fi
echo ""

# ── Herd (additive; does not break queue status above) ──
echo "── Herd ──"
HERD_STATUS="$ROOT/scripts/herd/status.sh"
HERD_CUR="$ROOT/artifacts/herd/CURRENT"
if [[ -x "$HERD_STATUS" ]] || [[ -f "$HERD_STATUS" ]]; then
  if bash "$HERD_STATUS" 2>/dev/null; then
    :
  else
    # status.sh exits 1 when no CURRENT — print brief idle hint
    if [[ ! -e "$HERD_CUR" ]]; then
      echo "no active herd (no artifacts/herd/CURRENT)"
      echo "  docs: docs/HERD.md · skill: .grok/skills/herd · smoke: ./scripts/herd/smoke-test.sh"
    else
      echo "herd status failed (see ./scripts/herd/status.sh)"
    fi
  fi
elif [[ -e "$HERD_CUR" ]]; then
  # Brief fallback if herd/status.sh missing
  run_dir=""
  if [[ -L "$HERD_CUR" || -d "$HERD_CUR" ]]; then
    run_dir=$(cd "$HERD_CUR" 2>/dev/null && pwd || true)
  elif [[ -f "$HERD_CUR" ]]; then
    rid=$(tr -d '[:space:]' <"$HERD_CUR" 2>/dev/null || true)
    if [[ -n "$rid" ]]; then
      if [[ -d "$ROOT/artifacts/herd/$rid" ]]; then
        run_dir="$ROOT/artifacts/herd/$rid"
      elif [[ -d "$ROOT/artifacts/herd/runs/$rid" ]]; then
        run_dir="$ROOT/artifacts/herd/runs/$rid"
      fi
    fi
  fi
  if [[ -n "${run_dir:-}" && -d "$run_dir" ]]; then
    echo "CURRENT=$(basename "$run_dir") → $run_dir"
    if [[ -f "$run_dir/run.json" ]]; then
      python3 - "$run_dir/run.json" <<'PY' 2>/dev/null || true
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    d = json.load(f)
print(f"goal:    {d.get('goal') or '(none)'}")
print(f"status:  {d.get('status') or '?'}")
PY
    fi
    if [[ -d "$run_dir/lanes" ]]; then
      for jf in "$run_dir/lanes"/*.json; do
        [[ -f "$jf" ]] || continue
        python3 - "$jf" <<'PY' 2>/dev/null || true
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    d = json.load(f)
own = ", ".join(d.get("own") or [])
print(f"  lane {d.get('id','?'):<14} status={d.get('status','?'):<10} own={own or '(none)'}")
PY
      done
    fi
  else
    echo "CURRENT present but unreadable: $HERD_CUR"
  fi
else
  echo "no active herd (no artifacts/herd/CURRENT)"
  echo "  docs: docs/HERD.md · skill: .grok/skills/herd · smoke: ./scripts/herd/smoke-test.sh"
fi
