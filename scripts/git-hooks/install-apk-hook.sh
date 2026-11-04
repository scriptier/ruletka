#!/usr/bin/env bash
# Install the OPT-IN post-commit hook that rebuilds the local APK when mobile/
# changes. Writes a tiny wrapper (not a symlink) into the real hooks dir, so it
# works from the main tree and from every `git worktree`, on Linux and Windows.
#
# The old installer did `ln -sfn ../../scripts/... .git/hooks/post-commit`,
# which breaks in worktrees (.git is a file there) and, when made from
# Cygwin/MSYS, became an "IntxLNK" text file that git cannot execute.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
HOOKS="$(git rev-parse --path-format=absolute --git-common-dir)/hooks"
HOOK="$HOOKS/post-commit"
SRC="$ROOT/scripts/git-hooks/post-commit-apk"
[[ -f "$SRC" ]] || { echo "Missing $SRC" >&2; exit 1; }

if [[ -e "$HOOK" || -L "$HOOK" ]] && ! grep -q 'ruletka-apk-hook-wrapper' "$HOOK" 2>/dev/null; then
  echo "Refusing: $HOOK exists and is not ours. Move it aside first, e.g.:" >&2
  echo "  mv '$HOOK' '$HOOK.old'" >&2
  exit 1
fi
mkdir -p "$HOOKS"
cat >"$HOOK" <<'HOOK'
#!/usr/bin/env bash
# ruletka-apk-hook-wrapper: runs the checked-out tree's post-commit-apk.
s="$(git rev-parse --show-toplevel)/scripts/git-hooks/post-commit-apk"
[[ -f "$s" ]] && exec bash "$s"
exit 0
HOOK
chmod +x "$HOOK"
echo "Installed wrapper: $HOOK"
echo "Turn it on:  git config ruletka.apkHook true   (off by default)"
echo "Skip once:   SKIP_APK_HOOK=1 git commit ..."
