#!/usr/bin/env bash
# Print human-readable status of CURRENT herd run lanes.
# Exit 0 always unless no CURRENT/run (exit 1 with hint to new-run).
set -euo pipefail

HERD_BIN="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$HERD_BIN"/*.sh 2>/dev/null || true

# shellcheck source=lib.sh
source "$HERD_BIN/lib.sh"
herd_load

if ! RUN_DIR="$(herd_require_run)"; then
  exit 1
fi

RUN_ID="$(basename "$RUN_DIR")"
RUN_GOAL="$(herd_json_get "$RUN_DIR/run.json" goal "")"
RUN_STATUS="$(herd_json_get "$RUN_DIR/run.json" status "?")"
RUN_CREATED="$(herd_json_get "$RUN_DIR/run.json" created_at "")"

echo "=== Herd status ==="
echo "run:     $RUN_ID"
echo "path:    $RUN_DIR"
echo "status:  $RUN_STATUS"
echo "created: ${RUN_CREATED:-"-"}"
echo "goal:    ${RUN_GOAL:-"(none)"}"
echo ""

python3 - "$RUN_DIR" <<'PY'
import json, os, sys, glob
from collections import Counter

run_dir = sys.argv[1]
lanes_dir = os.path.join(run_dir, "lanes")
lanes = []
if os.path.isdir(lanes_dir):
    for path in sorted(glob.glob(os.path.join(lanes_dir, "*.json"))):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                lanes.append(data)
        except Exception as e:
            lanes.append({
                "id": os.path.basename(path).replace(".json", ""),
                "status": "failed",
                "agent": "",
                "goal": f"(bad json: {e})",
                "goal_met": "",
                "blocked_reason": "",
                "updated_at": "",
                "own": [],
            })

counts = Counter(l.get("status") or "?" for l in lanes)
order = ["idle", "claimed", "working", "blocked", "done", "failed"]

print("── Lanes ──")
if not lanes:
    print("(no lanes yet — pulse.sh <lane_id> --status claimed ...)")
else:
    # header
    fmt = "{:<14} {:<10} {:<12} {:<8} {:<20} {}"
    print(fmt.format("ID", "STATUS", "AGENT", "GOAL_MET", "UPDATED", "GOAL"))
    print(fmt.format("-"*14, "-"*10, "-"*12, "-"*8, "-"*20, "-"*24))
    for l in lanes:
        lid = str(l.get("id") or "?")[:14]
        st = str(l.get("status") or "?")[:10]
        ag = str(l.get("agent") or "-")[:12]
        gm = str(l.get("goal_met") if l.get("goal_met") is not None else "") or "-"
        gm = gm[:8]
        up = str(l.get("updated_at") or "-")[:20]
        goal = str(l.get("goal") or "")
        if l.get("status") == "blocked" and l.get("blocked_reason"):
            goal = f"{goal} [blocked: {l.get('blocked_reason')}]"
        if len(goal) > 60:
            goal = goal[:57] + "..."
        print(fmt.format(lid, st, ag, gm, up, goal))
        own = l.get("own") or []
        if own:
            own_s = ", ".join(str(x) for x in own)
            if len(own_s) > 70:
                own_s = own_s[:67] + "..."
            print(f"  own: {own_s}")

print("")
print("── Counts ──")
total = len(lanes)
parts = [f"{k}={counts.get(k, 0)}" for k in order if counts.get(k, 0)]
# include any unexpected statuses
for k, v in sorted(counts.items()):
    if k not in order:
        parts.append(f"{k}={v}")
if not parts:
    parts = ["(none)"]
print(f"total={total}  " + "  ".join(parts))

# Terminal summary line for scripts/greps
active = sum(counts.get(s, 0) for s in ("idle", "claimed", "working"))
terminal = sum(counts.get(s, 0) for s in ("done", "failed", "blocked"))
print(f"active={active}  terminal={terminal}")
PY

exit 0
