#!/usr/bin/env bash
# Create/push public GitHub repo (requires gh auth + SSH key for git).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO="${GITHUB_REPO:-scriptier/ruletka}"
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -i $HOME/.ssh/github_ed25519 -o IdentitiesOnly=yes}"

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged into gh. Run: gh auth login"
  echo "Or complete device flow if one is pending."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repo"
  exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin already set: $(git remote get-url origin)"
else
  if gh repo view "$REPO" >/dev/null 2>&1; then
    git remote add origin "git@github.com:${REPO}.git"
  else
    echo "Creating public repo $REPO …"
    gh repo create "$REPO" --public --source=. --remote=origin --description "Open-source P2P video roulette — multi-hub, LGPL-2.1"
  fi
fi

git push -u origin HEAD:main
echo "Pushed → https://github.com/${REPO}"
echo "Homepage: https://ruletka.vip"
