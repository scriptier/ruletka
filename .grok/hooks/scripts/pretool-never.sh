#!/usr/bin/env bash
# Marchese/Karpathy Layer 3: hard Never walls (not mere AGENTS requests).
# PreToolUse: read JSON on stdin; print {"decision":"allow"|"deny","reason":...}
set -euo pipefail

input=$(cat || true)
# Fail-open if empty/malformed (hooks fail-open anyway on crash — keep explicit allow)
if [[ -z "$input" ]]; then
  echo '{"decision":"allow"}'
  exit 0
fi

python3 -c '
import json, re, sys

try:
    d = json.loads(sys.stdin.read() or "{}")
except Exception:
    print(json.dumps({"decision": "allow"}))
    raise SystemExit(0)

tool = str(d.get("toolName") or "")
tin = d.get("toolInput") or {}
if not isinstance(tin, dict):
    tin = {}

# Flatten common command / path / content fields
cmd = " ".join(
    str(tin.get(k) or "")
    for k in ("command", "cmd", "bash", "script")
)
path = " ".join(
    str(tin.get(k) or "")
    for k in (
        "file_path", "path", "target_file", "filePath",
        "file", "old_string", "new_string", "content",
    )
)
blob = (cmd + "\n" + path + "\n" + json.dumps(tin, default=str)).lower()

def deny(reason: str) -> None:
    print(json.dumps({"decision": "deny", "reason": reason}))
    raise SystemExit(0)

# --- Never: production push / Play without explicit human (block script paths) ---
if re.search(r"scripts/deploy/push\.sh|push\.sh\s+prod|/scripts/deploy/push", blob):
    deny(
        "NEVER: production push.sh blocked by project hook. "
        "Human must run deploy explicitly outside the agent (or ask to disable hook)."
    )

# --- Never: iceCandidatePoolSize > 0 (437 storms) ---
if re.search(r"icecandidatepoolsize\s*[=:]\s*[1-9]", blob, re.I):
    deny(
        "NEVER: iceCandidatePoolSize must stay 0 (pool storms → 437). "
        "See docs/CONNECTIVITY_LOCK.md and av-fix-loop gotchas."
    )
if re.search(r"icecandidatepoolsize\s*[=:]\s*[\"'']?[1-9]", blob, re.I):
    deny("NEVER: iceCandidatePoolSize > 0 forbidden.")

# --- Never: raise pool via sed-style thrash ---
if "icecandidatepoolsize" in blob and re.search(r"\b(pool\s*=\s*[1-9]|poolsize.{0,12}[1-9])", blob):
    deny("NEVER: raising ICE candidate pool size is forbidden.")

# --- Never: dual-offer thrash markers in intentional bulk rewrites (soft) ---
# (allow single-file edits; only block obvious pool thrash above)

# --- Never: install git hooks unprompted ---
if re.search(r"git-hooks/install|install-apk-hook", blob):
    deny(
        "NEVER: agents must not install git APK hooks without explicit human ask. "
        "See AGENTS.md."
    )

print(json.dumps({"decision": "allow"}))
' <<<"$input" 2>/dev/null || echo '{"decision":"allow"}'
