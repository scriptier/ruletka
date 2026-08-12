#!/usr/bin/env bash
# agentic-check — soft gate: are we in agentic mode or about to vibe?
# Exit 0 = ok enough to proceed; 1 = missing Spec/Verifier pieces (still prints advice).
# Does not block CI by default — education + director preflight.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONNECT=0
STRICT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --connect) CONNECT=1; shift ;;
    --strict) STRICT=1; shift ;;
    -h|--help)
      echo "Usage: ./scripts/agentic-check.sh [--connect] [--strict]"
      echo "  --connect  require fresh av-verify scorecard"
      echo "  --strict   exit 1 if any check fails"
      exit 0
      ;;
    *) echo "unknown: $1" >&2; exit 2 ;;
  esac
done

fail=0
warn=0
ok() { echo "  OK  $1"; }
bad() { echo "  MISS $1"; fail=$((fail + 1)); }
note() { echo "  NOTE $1"; warn=$((warn + 1)); }

echo "=== agentic-check (vibe → agentic preflight) ==="
echo "repo: $ROOT"
echo

echo "## 1. Spec (Layer 1 — Marchese/Karpathy)"
check_spec_file() {
  local f="$1"
  local label="$2"
  [[ -f "$f" ]] || return 0
  ok "$label present"
  if grep -qE 'DONE WHEN' "$f" 2>/dev/null; then
    ok "$label has DONE WHEN"
  else
    bad "$label missing DONE WHEN"
  fi
  if grep -qiE '^(EVAL|VERIFY):|EVAL:|VERIFY:' "$f" 2>/dev/null || grep -q 'VERIFY' "$f" 2>/dev/null; then
    ok "$label has VERIFY/EVAL criteria"
  else
    note "$label missing EVAL/VERIFY — add precise criteria (/spec)"
  fi
  if grep -qiE 'CHECKPOINT' "$f" 2>/dev/null; then
    ok "$label has CHECKPOINTS"
  else
    note "$label no CHECKPOINTS — ok for small specs; add for high-risk"
  fi
}
if [[ -f knowledge/specs/current-av.md ]]; then
  check_spec_file knowledge/specs/current-av.md "current-av"
else
  note "no current-av.md — ok for non-A/V work; use /spec for new goals"
fi
# Any other active-looking specs (skip template/README)
for f in knowledge/specs/*.md; do
  base=$(basename "$f")
  [[ "$base" == "_TEMPLATE.md" || "$base" == "README.md" || "$base" == "current-av.md" ]] && continue
  if grep -qiE 'Status.*Active|^\*\*Active' "$f" 2>/dev/null; then
    check_spec_file "$f" "$base"
  fi
done
if [[ -f knowledge/specs/_TEMPLATE.md ]]; then
  if grep -q 'EVAL' knowledge/specs/_TEMPLATE.md 2>/dev/null; then
    ok "spec template has EVAL (Marchese)"
  else
    note "template missing EVAL field"
  fi
else
  note "no _TEMPLATE.md"
fi

echo
echo "## 2. Environment (Layer 3)"
[[ -f AGENTS.md ]] && ok "AGENTS.md" || bad "AGENTS.md missing"
[[ -f knowledge/SCHEMA.md ]] && ok "knowledge/SCHEMA.md" || note "no SCHEMA.md"
[[ -f knowledge/wiki/index.md ]] && ok "wiki/index.md" || note "no wiki index"
[[ -d .grok/skills/av-fix-loop ]] && ok "av-fix-loop skill" || note "no av-fix-loop"
[[ -f docs/AGENTIC_ENGINEERING.md ]] && ok "docs/AGENTIC_ENGINEERING.md" || note "no agentic doc"
if [[ -f .grok/hooks/never-rules.json ]]; then
  ok "Never hooks present (.grok/hooks/) — enable with /hooks-trust"
else
  note "no project Never hooks"
fi

echo
echo "## 3. Verifier tooling (Layer 2)"
[[ -x scripts/av-verify.sh ]] && ok "av-verify.sh (external signal)" || bad "av-verify.sh missing/not executable"
[[ -x scripts/av-loop.sh ]] && ok "av-loop.sh" || bad "av-loop.sh missing/not executable"
[[ -f .grok/plugins/ruletka-connect/agents/verify-only.md ]] && ok "verify-only agent (post-hop critic)" || note "no verify-only agent file"
[[ -f ~/.grok/skills/check-work/SKILL.md || -f /home/drakosik/.grok/skills/check-work/SKILL.md ]] && ok "check-work skill (second critic)" || note "check-work skill not found"

if [[ "$CONNECT" == "1" ]]; then
  echo
  echo "## 4. Connect scorecard freshness (--connect)"
  SCORE=artifacts/av-verify/latest.json
  if [[ ! -f "$SCORE" ]]; then
    bad "no $SCORE — run ./scripts/av-verify.sh or av-loop.sh"
  else
    ok "latest.json exists"
    python3 - "$SCORE" <<'PY' || true
import json, sys
from pathlib import Path
from datetime import datetime, timezone
p = Path(sys.argv[1])
d = json.loads(p.read_text())
at = d.get("at") or ""
verdict = d.get("verdict")
prod = (d.get("product") or {}).get("status")
print(f"  OK  verdict={verdict} product={prod} at={at}")
# age check
try:
    # 2026-08-10T21:35:24Z
    ts = datetime.strptime(at.replace("Z",""), "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    age_min = (datetime.now(timezone.utc) - ts).total_seconds() / 60.0
    if age_min > 60:
        print(f"  NOTE scorecard age {age_min:.0f}m — re-run av-verify for live work")
    else:
        print(f"  OK  scorecard age {age_min:.0f}m")
except Exception as e:
    print(f"  NOTE could not parse scorecard age: {e}")
if prod == "one-way":
    print("  NOTE product=one-way → NEXT client-ice / smoke — not vibe thrash")
if verdict == "PASS" and prod not in ("ok", "unknown", None, ""):
    print(f"  NOTE verdict PASS but product={prod} — do not ship on vibe")
PY
  fi
  if [[ -f artifacts/av-loop/NEXT_ROLE ]]; then
    ok "av-loop NEXT_ROLE=$(tr -d '\n' < artifacts/av-loop/NEXT_ROLE)"
  else
    note "no av-loop route yet — ./scripts/av-loop.sh"
  fi
fi

echo
echo "## 5. Recommended next"
if [[ "$CONNECT" == "1" ]]; then
  echo "  → ./scripts/av-loop.sh --min 10"
  echo "  → read artifacts/av-loop/director.md then spawn ONE writer"
  echo "  → always verify-after; never GOAL_MET without product.ok / human smoke"
else
  echo "  → /spec or copy knowledge/specs/_TEMPLATE.md"
  echo "  → /agentic for full loop"
  echo "  → connect work: ./scripts/agentic-check.sh --connect"
fi

echo
if [[ "$fail" -gt 0 ]]; then
  echo "RESULT: $fail missing required piece(s) — fix before thrashing code"
  if [[ "$STRICT" == "1" ]]; then
    exit 1
  fi
  exit 1
elif [[ "$warn" -gt 0 ]]; then
  echo "RESULT: OK with $warn note(s) — agentic path available"
  exit 0
else
  echo "RESULT: OK — agentic preflight clean"
  exit 0
fi
