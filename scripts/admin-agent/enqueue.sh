#!/usr/bin/env bash
# Enqueue a task for the overnight admin agent.
# Usage:
#   ./scripts/admin-agent/enqueue.sh 015 "short-slug" <<'EOF'
#   # Task body markdown
#   EOF
# Or:
#   ./scripts/admin-agent/enqueue.sh auto "fix title"
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
admin_load_config

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <NNN|auto> [slug]   (body on stdin or empty stub)" >&2
  exit 1
fi

num="$1"
slug="${2:-task}"
slug="$(echo "$slug" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9._-' | cut -c1-40)"

if [[ "$num" == "auto" ]]; then
  # next free number 100+
  n=100
  while [[ -f "$ROOT/tasks/admin-queue/pending/$(printf '%03d' "$n")-"* ]]; do
    n=$((n + 1))
  done
  num=$(printf '%03d' "$n")
fi

out="$ROOT/tasks/admin-queue/pending/${num}-${slug}.md"
if [[ -f "$out" ]]; then
  echo "Already exists: $out" >&2
  exit 1
fi

if [[ -t 0 ]]; then
  # no stdin — write stub from vibecoder task template
  cat >"$out" <<EOF
# Task: $slug

## Goal
(one measurable outcome)

## Context
- Why now:
- Baseline already shipped (do not undo):

## Scope (only these)
- path/...

## Done criteria
- [ ] …
- [ ] No production deploy
- [ ] RESULT written with Status + files + connect risk

## Completion promise
When all done criteria are met, put the word \`COMPLETE\` in the RESULT under **Completion promise**.

## Do not
- Deploy / push / merge main
- Touch CONNECTIVITY_LOCK invariants without explicit ask

## Verify hints (optional)
- geoLocalize / tsc / script path

## Notes
Enqueued $(date -u +%Y-%m-%dT%H:%M:%SZ)
Template: scripts/admin-agent/prompts/task-template.md
EOF
else
  cat >"$out"
fi

echo "Enqueued: $out"
ls -la "$out"
