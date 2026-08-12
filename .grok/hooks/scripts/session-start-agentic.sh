#!/usr/bin/env bash
# SessionStart: point agent at agentic OS (non-blocking; stdout is context).
set -euo pipefail
ROOT="${GROK_PROJECT_DIR:-}"
if [[ -z "$ROOT" && -f AGENTS.md ]]; then
  ROOT="$(pwd)"
elif [[ -z "$ROOT" ]]; then
  ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
fi
cd "$ROOT" 2>/dev/null || true

msg="ruletka agentic: Spec→Verifier→Environment. Prefer ./scripts/agentic-loop.sh; never claim fixed without product.ok/smoke. Never: pool>0, unprompted push.sh."
if [[ -f knowledge/specs/current-av.md ]]; then
  if grep -q 'one-way\|Active' knowledge/specs/current-av.md 2>/dev/null; then
    msg="$msg Active A/V: knowledge/specs/current-av.md (install APK 0.1.295+ then smoke)."
  fi
fi
# SessionStart is non-blocking; print for scrollback / additionalContext if harness captures it
echo "$msg"
exit 0
