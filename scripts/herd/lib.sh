#!/usr/bin/env bash
# Shared helpers for herd shepherd status runtime (P0).
# Portable: bash + python3 only (no jq required).
set -euo pipefail

herd_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

herd_load() {
  HERD_ROOT="$(herd_root)"
  HERD_DIR="$HERD_ROOT/artifacts/herd"
  mkdir -p "$HERD_DIR"
  export HERD_ROOT HERD_DIR
}

herd_now() {
  # UTC ISO-8601 (seconds)
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

herd_run_id_now() {
  # Compact UTC run id, e.g. 20260813T143022Z
  date -u +"%Y%m%dT%H%M%SZ"
}

# Latest run dir: prefer CURRENT symlink if valid, else newest mtime under HERD_DIR.
herd_latest_run() {
  herd_load
  local current="$HERD_DIR/CURRENT"
  local resolved=""
  if [[ -L "$current" ]]; then
    # Resolve relative symlink without requiring the link target name be absolute
    if command -v readlink >/dev/null 2>&1; then
      resolved="$(readlink -f "$current" 2>/dev/null || true)"
    fi
    if [[ -z "${resolved:-}" ]]; then
      resolved="$(cd "$current" 2>/dev/null && pwd)" || true
    fi
    if [[ -n "${resolved:-}" && -d "$resolved" && -f "$resolved/run.json" ]]; then
      printf '%s\n' "$resolved"
      return 0
    fi
  elif [[ -d "$current" && -f "$current/run.json" ]]; then
    # Legacy: CURRENT was a real directory (avoid in new-run)
    resolved="$(cd "$current" && pwd)"
    printf '%s\n' "$resolved"
    return 0
  fi
  # Fallback: newest directory with run.json by mtime
  local latest=""
  local d
  # shellcheck disable=SC2012
  while IFS= read -r d; do
    [[ -z "$d" ]] && continue
    if [[ -f "$d/run.json" ]]; then
      latest="$d"
      break
    fi
  done < <(ls -1dt "$HERD_DIR"/*/ 2>/dev/null || true)
  if [[ -n "$latest" ]]; then
    # strip trailing slash
    printf '%s\n' "${latest%/}"
    return 0
  fi
  return 1
}

# Require CURRENT (or latest) run; print path or die with hint.
herd_require_run() {
  local run
  if ! run="$(herd_latest_run)"; then
    echo "FAIL: no herd run found under $HERD_DIR" >&2
    echo "  hint: ./scripts/herd/new-run.sh \"goal text\"" >&2
    return 1
  fi
  printf '%s\n' "$run"
}

# --- JSON helpers (python3) -------------------------------------------------

herd_json_get() {
  # usage: herd_json_get <file> <key> [default]
  local file="$1"
  local key="$2"
  local default="${3:-}"
  if [[ ! -f "$file" ]]; then
    printf '%s\n' "$default"
    return 0
  fi
  python3 - "$file" "$key" "$default" <<'PY'
import json, sys
path, key, default = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
except Exception:
    print(default)
    sys.exit(0)
val = data.get(key, default)
if val is None:
    print(default)
elif isinstance(val, (list, dict)):
    print(json.dumps(val, ensure_ascii=False))
else:
    print(val)
PY
}

herd_json_write() {
  # usage: herd_json_write <file> <json-string>
  local file="$1"
  local payload="$2"
  local dir
  dir="$(dirname "$file")"
  mkdir -p "$dir"
  python3 - "$file" "$payload" <<'PY'
import json, sys, os, tempfile
path, payload = sys.argv[1], sys.argv[2]
data = json.loads(payload)
dir_ = os.path.dirname(path) or "."
fd, tmp = tempfile.mkstemp(prefix=".herd-", suffix=".json", dir=dir_)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)
except Exception:
    try:
        os.unlink(tmp)
    except OSError:
        pass
    raise
PY
}

# Merge patch into existing lane JSON (or create defaults). Writes file.
# Args: file, id, and optional KEY=value pairs for top-level fields.
# Special: own may be comma-separated string → array.
herd_lane_merge() {
  local file="$1"
  shift
  local lane_id="$1"
  shift
  local now
  now="$(herd_now)"
  # Build env-style patches as lines: KEY\tVALUE
  local patches=()
  local arg key val
  for arg in "$@"; do
    if [[ "$arg" == *"="* ]]; then
      key="${arg%%=*}"
      val="${arg#*=}"
      patches+=("${key}"$'\t'"${val}")
    fi
  done
  python3 - "$file" "$lane_id" "$now" "${patches[@]}" <<'PY'
import json, sys, os, tempfile

path = sys.argv[1]
lane_id = sys.argv[2]
now = sys.argv[3]
patches = sys.argv[4:]

defaults = {
    "id": lane_id,
    "status": "idle",
    "own": [],
    "goal": "",
    "goal_met": "",
    "blocked_reason": "",
    "updated_at": now,
    "agent": "",
    "notes": "",
}

data = dict(defaults)
if os.path.isfile(path):
    try:
        with open(path, encoding="utf-8") as f:
            existing = json.load(f)
        if isinstance(existing, dict):
            data.update(existing)
    except Exception:
        pass

data["id"] = lane_id
data["updated_at"] = now

# Allowed status values
VALID_STATUS = {"idle", "claimed", "working", "blocked", "done", "failed"}
VALID_GOAL_MET = {"yes", "no", "blocked", ""}

for item in patches:
    if "\t" not in item:
        continue
    key, val = item.split("\t", 1)
    if key == "own":
        if val.strip() == "":
            data["own"] = []
        else:
            data["own"] = [p.strip() for p in val.split(",") if p.strip()]
    elif key == "status":
        if val not in VALID_STATUS:
            print(f"FAIL: invalid status '{val}' (want: {'|'.join(sorted(VALID_STATUS))})", file=sys.stderr)
            sys.exit(2)
        data["status"] = val
    elif key == "goal_met":
        if val not in VALID_GOAL_MET:
            print(f"FAIL: invalid goal_met '{val}' (want: yes|no|blocked|)", file=sys.stderr)
            sys.exit(2)
        data["goal_met"] = val
    elif key == "blocked_reason":
        data["blocked_reason"] = val
    elif key in ("goal", "agent", "notes"):
        data[key] = val
    elif key == "reason":
        # alias for blocked_reason
        data["blocked_reason"] = val
    else:
        # allow unknown string fields for forward compat
        data[key] = val

dir_ = os.path.dirname(path) or "."
os.makedirs(dir_, exist_ok=True)
fd, tmp = tempfile.mkstemp(prefix=".herd-", suffix=".json", dir=dir_)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)
except Exception:
    try:
        os.unlink(tmp)
    except OSError:
        pass
    raise

print(path)
PY
}

# List lane json files in a run dir (basename without .json).
herd_list_lanes() {
  local run_dir="$1"
  local f
  if [[ ! -d "$run_dir/lanes" ]]; then
    return 0
  fi
  for f in "$run_dir/lanes"/*.json; do
    [[ -e "$f" ]] || continue
    basename "$f" .json
  done | sort
}

# Read all lanes as JSON array to stdout.
herd_lanes_json() {
  local run_dir="$1"
  python3 - "$run_dir" <<'PY'
import json, os, sys, glob
run_dir = sys.argv[1]
lanes_dir = os.path.join(run_dir, "lanes")
out = []
if os.path.isdir(lanes_dir):
    for path in sorted(glob.glob(os.path.join(lanes_dir, "*.json"))):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                out.append(data)
        except Exception as e:
            out.append({"id": os.path.basename(path).replace(".json",""), "status": "failed", "notes": f"bad json: {e}"})
print(json.dumps(out, ensure_ascii=False))
PY
}
