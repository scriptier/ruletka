#!/usr/bin/env bash
# Freeze a full restore point BEFORE overnight automation mutates the tree.
# Does NOT change your working directory (uses a private git index).
#
# Usage:
#   ./scripts/admin-agent/snapshot-pre-sleep.sh
#   ./scripts/admin-agent/snapshot-pre-sleep.sh "optional note"
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
admin_load_config

NOTE="${1:-pre-sleep before overnight automation}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOCAL="$(date +%Y-%m-%dT%H:%M:%S%z)"
ID="pre-sleep-${STAMP}"
BACKUP_DIR="$ROOT/backups/${ID}"
mkdir -p "$BACKUP_DIR" "$ROOT/backups"

cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repo: $ROOT" >&2
  exit 1
fi

HEAD_SHA="$(git rev-parse HEAD)"
HEAD_SHORT="$(git rev-parse --short HEAD)"
BRANCH="$(git branch --show-current 2>/dev/null || echo detached)"

# 1) Branch pointing at current committed HEAD (clean baseline)
git branch "backup/${ID}-head" HEAD 2>/dev/null || true

# 2) WIP snapshot as a commit on a backup branch WITHOUT touching the user index/worktree.
#    Strategy (fast + safe):
#    - stage all **tracked** modifications (`git add -u`)
#    - plus explicit important untracked paths (docs/scripts/tasks/CLAUDE — not node_modules)
export GIT_INDEX_FILE="$BACKUP_DIR/private-index"
rm -f "$GIT_INDEX_FILE" "${GIT_INDEX_FILE}.lock"
git read-tree HEAD
# Tracked changes only (fast)
git add -u
# Important project paths that may be new/untracked
for p in \
  CLAUDE.md CLAUDE-WORKFLOW.md \
  docs scripts tasks tasks/admin-queue mobile/app mobile/src mobile/scripts \
  ui/live.js ui/webrtc.js ui/geoLocalize.js \
  bridge/src \
  .gitignore
do
  if [[ -e "$ROOT/$p" ]]; then
    git add -f -- "$p" 2>/dev/null || git add -- "$p" 2>/dev/null || true
  fi
done
TREE="$(git write-tree)"
# Parent = current HEAD so restore is a normal commit with history
WIP_SHA="$(git commit-tree "$TREE" -p HEAD -m "backup: ${ID}

${NOTE}

Local time: ${LOCAL}
Branch was: ${BRANCH}
HEAD was: ${HEAD_SHA}

RESTORE:
  ./scripts/admin-agent/restore-pre-sleep.sh ${ID}
")"
unset GIT_INDEX_FILE
rm -f "$BACKUP_DIR/private-index" "${BACKUP_DIR}/private-index.lock"

if [[ -z "${WIP_SHA}" ]]; then
  echo "commit-tree failed" >&2
  exit 1
fi

git branch -f "backup/${ID}-wip" "$WIP_SHA"
git branch -f "backup/LATEST-pre-sleep-wip" "$WIP_SHA"
git branch -f "backup/LATEST-pre-sleep-head" "$HEAD_SHA"

# 3) Metadata for humans / morning script
{
  echo "ID=$ID"
  echo "LOCAL=$LOCAL"
  echo "UTC=$STAMP"
  echo "NOTE=$NOTE"
  echo "BRANCH=$BRANCH"
  echo "HEAD_SHA=$HEAD_SHA"
  echo "WIP_SHA=$WIP_SHA"
  echo "HEAD_BRANCH=backup/${ID}-head"
  echo "WIP_BRANCH=backup/${ID}-wip"
  echo "APK_VERSION=0.1.123"
} >"$BACKUP_DIR/meta.env"

git status -sb >"$BACKUP_DIR/status-before.txt" 2>&1 || true
git log -8 --oneline >"$BACKUP_DIR/log-before.txt" 2>&1 || true
git branch --list 'admin/*' >"$BACKUP_DIR/admin-branches.txt" 2>&1 || true
ls -1 "$ROOT/.admin-worktrees" 2>/dev/null >"$BACKUP_DIR/admin-worktrees.txt" || true
crontab -l >"$BACKUP_DIR/crontab.txt" 2>/dev/null || true

# Lightweight file list of dirty paths (for confidence)
git diff --name-only HEAD >"$BACKUP_DIR/dirty-tracked.txt" 2>/dev/null || true
git ls-files --others --exclude-standard >"$BACKUP_DIR/untracked.txt" 2>/dev/null || true

cat >"$BACKUP_DIR/RESTORE.md" <<EOF
# Restore point: ${ID}

**Created:** ${LOCAL}  
**Why:** ${NOTE}

## What was saved

| Ref | Meaning |
|-----|---------|
| \`backup/${ID}-head\` / \`${HEAD_SHORT}\` | Last **committed** HEAD only |
| \`backup/${ID}-wip\` / \`${WIP_SHA:0:12}\` | **Full WIP** (all dirty + untracked files as of snapshot) |
| \`backup/LATEST-pre-sleep-wip\` | Always points at newest pre-sleep WIP |

## How to restore (when you wake up and say "go back")

### Option A — one command (recommended)

\`\`\`bash
cd ~/freenet-roulette
./scripts/admin-agent/restore-pre-sleep.sh
# or explicit id:
./scripts/admin-agent/restore-pre-sleep.sh ${ID}
\`\`\`

This will:
1. Stop overnight admin agent locks
2. Remove \`.admin-worktrees/*\` created overnight
3. \`git reset --hard\` to the WIP snapshot (full pre-sleep tree)
4. Leave overnight \`admin/*\` branches around (not deleted) unless you pass \`--purge-admin\`

### Option B — manual

\`\`\`bash
cd ~/freenet-roulette
git reset --hard backup/${ID}-wip
# committed-only (discards then-uncommitted WIP):
# git reset --hard backup/${ID}-head
\`\`\`

### Option C — inspect without restoring

\`\`\`bash
git log -1 --stat backup/${ID}-wip
git diff backup/${ID}-wip
\`\`\`

## Safety

- Snapshot does **not** deploy or push.
- Overnight agents must only commit on \`admin/*\` worktrees (main dirty tree still at risk if isolation off).
- After restore, re-run: \`./scripts/admin-agent/status.sh\`
EOF

# Symlink latest
ln -sfn "$BACKUP_DIR" "$ROOT/backups/LATEST_PRE_SLEEP"

# Record for morning.sh
echo "$ID" >"$ROOT/scripts/admin-agent/logs/last-snapshot-id.txt"
echo "$WIP_SHA" >"$ROOT/scripts/admin-agent/logs/last-snapshot-wip.sha"

admin_log "SNAPSHOT $ID head=$HEAD_SHORT wip=${WIP_SHA:0:12} → $BACKUP_DIR"

echo "=============================================="
echo "  PRE-SLEEP SNAPSHOT SAVED"
echo "=============================================="
echo "ID:        $ID"
echo "HEAD:      $HEAD_SHORT ($BRANCH)"
echo "WIP:       ${WIP_SHA:0:12}  (full working tree)"
echo "Branches:  backup/${ID}-head , backup/${ID}-wip"
echo "Latest:    backups/LATEST_PRE_SLEEP → $BACKUP_DIR"
echo ""
echo "To restore later:"
echo "  ./scripts/admin-agent/restore-pre-sleep.sh"
echo "  # or tell Grok: go back to before I went to sleep"
echo "=============================================="
