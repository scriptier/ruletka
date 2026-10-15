#!/usr/bin/env bash
# Self-contained herd smoke under scripts/herd/:
#   new-run → register 2 fake lanes (non-overlapping OWN) → pulse done → status → wait-all → finish
# Uses sibling herd CLI only (no network, no real subagents).
#
# Usage:
#   ./scripts/herd/smoke-test.sh
#   KEEP_CURRENT=1 ./scripts/herd/smoke-test.sh
set -euo pipefail

HERD_BIN="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$HERD_BIN"/*.sh 2>/dev/null || true

# shellcheck source=lib.sh
source "$HERD_BIN/lib.sh"
herd_load

KEEP_CURRENT="${KEEP_CURRENT:-0}"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

echo "=== herd smoke-test ==="
echo "ROOT=$HERD_ROOT"
echo "HERD_DIR=$HERD_DIR"

# ── 1. new-run ──
"$HERD_BIN/new-run.sh" "smoke-test: dual fake lanes non-overlapping OWN"
RUN_DIR="$(herd_require_run)" || fail "no CURRENT after new-run"
RUN_ID="$(basename "$RUN_DIR")"
ok "new-run run_id=$RUN_ID"

# ── 2. register two lanes (non-overlapping OWN) via pulse + own-lock ──
# (register.sh job-card path is best-effort; pulse is source of truth for lane JSON)
LANE_A="docs-smoke"
LANE_B="agents-note"
OWN_A="docs/HERD.md"
OWN_B="scripts/agents/status.sh"

# Preflight: B must not already be locked (A not held yet)
if [[ -x "$HERD_BIN/own-check.sh" ]]; then
  "$HERD_BIN/own-check.sh" "$OWN_A" "$OWN_B" || fail "own-check preflight failed"
  ok "own-check free: $OWN_A · $OWN_B"
fi

"$HERD_BIN/pulse.sh" "$LANE_A" \
  --status claimed \
  --goal "fake docs OWN only" \
  --own "$OWN_A" \
  --agent smoke \
  --notes "smoke-test lane A"
"$HERD_BIN/pulse.sh" "$LANE_A" --status working --agent smoke

if [[ -x "$HERD_BIN/own-lock.sh" ]]; then
  "$HERD_BIN/own-lock.sh" acquire "$LANE_A" "$OWN_A" || fail "own-lock acquire $LANE_A"
fi
ok "register $LANE_A own=$OWN_A"

"$HERD_BIN/pulse.sh" "$LANE_B" \
  --status claimed \
  --goal "fake agents status OWN only" \
  --own "$OWN_B" \
  --agent smoke \
  --notes "smoke-test lane B"
"$HERD_BIN/pulse.sh" "$LANE_B" --status working --agent smoke

if [[ -x "$HERD_BIN/own-lock.sh" ]]; then
  # Overlap must fail if we try A's path under B
  if "$HERD_BIN/own-lock.sh" acquire "$LANE_B" "$OWN_A" 2>/dev/null; then
    fail "expected OWN overlap reject for $OWN_A under $LANE_B"
  fi
  ok "OWN overlap rejected (good)"
  "$HERD_BIN/own-lock.sh" acquire "$LANE_B" "$OWN_B" || fail "own-lock acquire $LANE_B"
fi
ok "register $LANE_B own=$OWN_B"

# Minimal job cards (spawn_subagent paste surface) under the real run layout
mkdir -p "$RUN_DIR/lanes"
for pair in "$LANE_A|$OWN_A" "$LANE_B|$OWN_B"; do
  lid="${pair%%|*}"
  own="${pair##*|}"
  cat >"$RUN_DIR/lanes/${lid}.md" <<EOF
# Lane job card — ${lid}

| Field | Value |
|-------|--------|
| **LANE** | \`${lid}\` |
| **RUN** | \`${RUN_ID}\` |
| **AGENT** | smoke |
| **STATUS** | working |

## GOAL
smoke-test fake lane

## OWN (write only these)
- \`${own}\`

## DONE WHEN
COMPLETE (smoke)

## DO NOT
MediaSession, deploy, APK, pool>0

## REPORT
\`\`\`
GOAL_MET=yes|no|blocked
FILES_CHANGED:
NOTES:
\`\`\`
EOF
done
ok "wrote lane cards under $RUN_DIR/lanes/"

# ── 3. pulse done (finish each lane) ──
"$HERD_BIN/pulse.sh" "$LANE_A" --status done --goal-met yes --notes "smoke COMPLETE"
"$HERD_BIN/pulse.sh" "$LANE_B" --status done --goal-met yes --notes "smoke COMPLETE"
if [[ -x "$HERD_BIN/own-lock.sh" ]]; then
  "$HERD_BIN/own-lock.sh" release "$LANE_A" || true
  "$HERD_BIN/own-lock.sh" release "$LANE_B" || true
fi
# Stamp REPORT on cards (finish.sh may use runs/ layout; stamp here for consistency)
for lid in "$LANE_A" "$LANE_B"; do
  card="$RUN_DIR/lanes/${lid}.md"
  if [[ -f "$card" ]]; then
    python3 - "$card" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
text = re.sub(r"(\|\s*\*\*STATUS\*\*\s*\|\s*)[^|\n]+", r"\1done ", text, count=1)
report = (
    "## REPORT\n\n```\nGOAL_MET=yes\nFILES_CHANGED:\n(none — smoke)\n"
    "NOTES:\nsmoke-test COMPLETE\n```\n"
)
if re.search(r"(?im)^## REPORT\b", text):
    text = re.sub(r"(?ims)^## REPORT\b.*?(?=\Z)", report.rstrip() + "\n", text, count=1)
else:
    text = text.rstrip() + "\n\n" + report
open(path, "w", encoding="utf-8").write(text)
PY
  fi
done
ok "pulse done + finish stamp for $LANE_A · $LANE_B"

# ── 4. status ──
echo ""
"$HERD_BIN/status.sh" || fail "status.sh failed"
ok "status"

# ── 5. wait-all (should be terminal immediately) ──
"$HERD_BIN/wait-all.sh" --timeout 10 --interval 1 || fail "wait-all not clear"
ok "wait-all"

# ── 6. mark run finished + optional clear CURRENT ──
python3 - "$RUN_DIR/run.json" <<'PY'
import json, sys, os, tempfile
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
data["status"] = "finished"
dir_ = os.path.dirname(path) or "."
fd, tmp = tempfile.mkstemp(prefix=".herd-", suffix=".json", dir=dir_)
with os.fdopen(fd, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
os.replace(tmp, path)
PY

if [[ "$KEEP_CURRENT" == "1" ]]; then
  ok "run STATUS=finished (KEEP_CURRENT=1 — CURRENT left)"
else
  rm -f "$HERD_DIR/CURRENT"
  ok "run STATUS=finished, CURRENT cleared"
fi

echo ""
echo "=== herd smoke-test PASS run=$RUN_ID ==="
echo "run dir: $RUN_DIR"
echo "agents status: ./scripts/agents/status.sh"
exit 0
