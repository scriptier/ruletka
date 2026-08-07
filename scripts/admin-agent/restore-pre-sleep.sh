#!/usr/bin/env bash
# Restore repo to a pre-sleep snapshot created by snapshot-pre-sleep.sh
#
# Usage:
#   ./scripts/admin-agent/restore-pre-sleep.sh              # latest
#   ./scripts/admin-agent/restore-pre-sleep.sh pre-sleep-ID
#   ./scripts/admin-agent/restore-pre-sleep.sh --purge-admin
#   ./scripts/admin-agent/restore-pre-sleep.sh ID --purge-admin
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
admin_load_config

PURGE_ADMIN=0
ID=""
for arg in "$@"; do
  case "$arg" in
    --purge-admin) PURGE_ADMIN=1 ;;
    -h|--help)
      echo "Usage: $0 [snapshot-id] [--purge-admin]"
      exit 0
      ;;
    *) ID="$arg" ;;
  esac
done

if [[ -z "$ID" ]]; then
  if [[ -f "$ROOT/scripts/admin-agent/logs/last-snapshot-id.txt" ]]; then
    ID="$(cat "$ROOT/scripts/admin-agent/logs/last-snapshot-id.txt")"
  elif [[ -L "$ROOT/backups/LATEST_PRE_SLEEP" || -d "$ROOT/backups/LATEST_PRE_SLEEP" ]]; then
    ID="$(basename "$(readlink -f "$ROOT/backups/LATEST_PRE_SLEEP" 2>/dev/null || echo "$ROOT/backups/LATEST_PRE_SLEEP")")"
  else
    echo "No snapshot id. List: ls backups/" >&2
    exit 1
  fi
fi

BACKUP_DIR="$ROOT/backups/$ID"
META="$BACKUP_DIR/meta.env"
if [[ ! -f "$META" ]]; then
  echo "Missing $META" >&2
  echo "Available:" >&2
  ls -1 "$ROOT/backups" 2>/dev/null | head -20 >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$META"

WIP_REF="${WIP_BRANCH:-backup/${ID}-wip}"
if ! git -C "$ROOT" rev-parse --verify "$WIP_REF" >/dev/null 2>&1; then
  if [[ -n "${WIP_SHA:-}" ]] && git -C "$ROOT" rev-parse --verify "$WIP_SHA" >/dev/null 2>&1; then
    WIP_REF="$WIP_SHA"
  else
    echo "Cannot find WIP ref $WIP_REF" >&2
    exit 1
  fi
fi

echo "=============================================="
echo "  RESTORE TO PRE-SLEEP SNAPSHOT"
echo "=============================================="
echo "ID:     $ID"
echo "Target: $WIP_REF"
echo "Note:   ${NOTE:-}"
echo "This will HARD RESET the main worktree to the snapshot."
echo "=============================================="

# Stop agent locks / pids (pid-file only — no pkill -f)
for f in \
  "$ROOT/scripts/admin-agent/logs/nightly.lock" \
  "$ROOT/scripts/admin-agent/logs/cycle.lock" \
  "$ROOT/scripts/claude-logs/admin-claude.pid"
do
  if [[ -f "$f" ]]; then
    pid="$(cat "$f" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "Stopping pid $pid from $f"
      kids=$(pgrep -P "$pid" 2>/dev/null || true)
      for k in $kids; do kill "$k" 2>/dev/null || true; done
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$f"
  fi
done

# Remove overnight worktrees
if [[ -d "$ROOT/.admin-worktrees" ]]; then
  for d in "$ROOT/.admin-worktrees"/*; do
    [[ -d "$d" ]] || continue
    echo "Removing worktree $d"
    git -C "$ROOT" worktree remove --force "$d" 2>/dev/null || rm -rf "$d"
  done
  git -C "$ROOT" worktree prune 2>/dev/null || true
fi

if [[ "$PURGE_ADMIN" == "1" ]]; then
  git -C "$ROOT" branch --list 'admin/*' | while read -r b; do
    b=$(echo "$b" | tr -d ' *')
    [[ -n "$b" ]] || continue
    echo "Deleting branch $b"
    git -C "$ROOT" branch -D "$b" 2>/dev/null || true
  done
fi

cd "$ROOT"
echo "git reset --hard $WIP_REF"
git reset --hard "$WIP_REF"
# Clear untracked leftovers from overnight that were not in snapshot
# (careful: only untracked under common agent dirs)
rm -rf "$ROOT/.admin-worktrees" 2>/dev/null || true

{
  echo "## RESTORE applied $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- snapshot: \`$ID\`"
  echo "- ref: \`$WIP_REF\`"
} | admin_report_append 2>/dev/null || true

admin_log "RESTORED to $ID ($WIP_REF)"
echo ""
echo "Restored. Working tree matches pre-sleep WIP."
echo "git status:"
git status -sb | head -30
echo ""
echo "Optional: ./scripts/admin-agent/status.sh"
