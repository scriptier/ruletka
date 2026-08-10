#!/usr/bin/env bash
# Enqueue a daytime Claude task (wrapper around admin enqueue numbering).
#
# Usage:
#   ./scripts/agents/enqueue.sh auto "short-slug" <<'EOF'
#   # Task: title
#   ## Goal
#   ...
#   EOF
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$ROOT/scripts/admin-agent/enqueue.sh" "$@"
