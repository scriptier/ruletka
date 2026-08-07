#!/usr/bin/env bash
# Install post-commit hook that rebuilds local APK when mobile/ changes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK="$ROOT/.git/hooks/post-commit"
SRC="$ROOT/scripts/git-hooks/post-commit-apk"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "Not a git repo: $ROOT" >&2
  exit 1
fi
if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC" >&2
  exit 1
fi
chmod +x "$SRC"
# Prefer symlink so updates to scripts/git-hooks apply automatically
ln -sfn "../../scripts/git-hooks/post-commit-apk" "$HOOK"
chmod +x "$HOOK" 2>/dev/null || true
echo "Installed: $HOOK -> scripts/git-hooks/post-commit-apk"
echo "Skip once: SKIP_APK_HOOK=1 git commit ..."
echo "Disable:   rm $HOOK"
