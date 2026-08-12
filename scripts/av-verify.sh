#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# av-verify — single source of truth for the black-cam / no-audio problem.
#
# After YOU (human) try PC browser + phone, or after a code change, I run this
# and read the result files. No guessing from half logs.
#
# Agent contract (read these after every run — nothing else required):
#   artifacts/av-verify/latest.json   machine scorecard + gates + snapshot
#   artifacts/av-verify/latest.md     human PASS/FAIL/WARN/IDLE report
#   artifacts/av-verify/HISTORY.jsonl append-only run log (one JSON object/line)
# Exit codes for agents:
#   0 = PASS or IDLE (no matches in window — not a regression)
#   1 = FAIL (signaling or media gates failed — black cam likely)
#   2 = tool/SSH error
#   3 = WARN (partial media / answers incomplete — fix before shipping)
#
# Usage:
#   ./scripts/av-verify.sh                 # last 20 min snapshot → artifacts/
#   ./scripts/av-verify.sh --min 40        # lookback minutes
#   ./scripts/av-verify.sh --wait 90       # poll until a new match or timeout
#   ./scripts/av-verify.sh --watch 15      # re-score every 15s for ≤3 min; stop on PASS/hard FAIL
#   ./scripts/av-verify.sh --coturn        # also run relay self-peer lock test
#   ./scripts/av-verify.sh --headless      # web↔web puppeteer pair (if Chrome)
#   ./scripts/av-verify.sh --json          # print latest.json path only (still writes artifacts)
#
# Gates (when matches>0):
#   FAIL  matches>0 and answers=0
#   FAIL  answers>0 but max_rb<2000 AND no av_path with frames_in>2  (media dead)
#   WARN  PRODUCT one-way / no dual frames (even if TURN HOT) — not ship-ready
#   PASS  signaling OK AND media plane OK AND product ok (both directions or n/a)
#
# latest.json also has:
#   product: { status, web_fin, web_fout, android_fin, android_fout, force_relay_mismatch, app_vc, bind_v, hub_fr, done }
#   Agents MUST read product.status — infrastructure PASS alone is not product success.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MIN="${MIN:-20}"
WAIT_S=0
WATCH_S=0
DO_COTURN=0
DO_HEADLESS=0
JSON_ONLY=0
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
HOST="${HOST:-root@209.38.204.153}"
OUT_DIR="$ROOT/artifacts/av-verify"
mkdir -p "$OUT_DIR"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --min) MIN="${2:-20}"; shift 2 ;;
    --wait) WAIT_S="${2:-90}"; shift 2 ;;
    --watch) WATCH_S="${2:-15}"; shift 2 ;;
    --coturn) DO_COTURN=1; shift ;;
    --headless) DO_HEADLESS=1; shift ;;
    --json) JSON_ONLY=1; shift ;;
    -h|--help)
      sed -n '2,45p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

# validate numeric flags
for pair in "MIN:$MIN" "WAIT_S:$WAIT_S" "WATCH_S:$WATCH_S"; do
  name="${pair%%:*}"
  val="${pair#*:}"
  if ! [[ "$val" =~ ^[0-9]+$ ]]; then
    echo "FAIL: $name must be a non-negative integer (got: $val)" >&2
    exit 2
  fi
done

if [[ ! -f "$SSH_KEY" ]]; then
  echo "FAIL: SSH key missing at $SSH_KEY" >&2
  exit 2
fi

SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=14
  -o StrictHostKeyChecking=accept-new)

ts_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# ── optional wait for next match ────────────────────────────────────────────
if [[ "$WAIT_S" -gt 0 ]]; then
  echo "Waiting up to ${WAIT_S}s for a new solo matched…"
  baseline=$("${SSH[@]}" "$HOST" \
    "journalctl -u roulette-bridge --since '2 min ago' --no-pager 2>/dev/null | grep -c 'solo matched' || true")
  baseline="${baseline//[^0-9]/}"
  baseline="${baseline:-0}"
  end=$((SECONDS + WAIT_S))
  while (( SECONDS < end )); do
    cur=$("${SSH[@]}" "$HOST" \
      "journalctl -u roulette-bridge --since '3 min ago' --no-pager 2>/dev/null | grep -c 'solo matched' || true")
    cur="${cur//[^0-9]/}"
    cur="${cur:-0}"
    if (( cur > baseline )); then
      echo "New match seen (count $baseline → $cur). Settling 12s…"
      sleep 12
      break
    fi
    sleep 3
  done
fi

# ── pull remote snapshot (JSON via stdout; large fields built on remote) ────
pull_snapshot() {
  "${SSH[@]}" "$HOST" "MIN=$MIN bash -s" <<'REMOTE'
set -euo pipefail
MIN="${MIN:-20}"
tmp=$(mktemp)
tmpc=$(mktemp)
avf=$(mktemp)
recf=$(mktemp)
trap 'rm -f "$tmp" "$tmpc" "$avf" "$recf"' EXIT
journalctl -u roulette-bridge --since "${MIN} min ago" --no-pager -o short-iso 2>/dev/null >"$tmp" || true
journalctl -u coturn --since "${MIN} min ago" --no-pager -o short-iso 2>/dev/null >"$tmpc" || true

matches=$(grep -c 'solo matched' "$tmp" || true)
offers=$(grep -c 'first offer after match' "$tmp" || true)
answers=$(grep -c 'first answer after match' "$tmp" || true)
sig_offers=$(grep -c 'signal relay kind=offer' "$tmp" || true)
sig_answers=$(grep -c 'signal relay kind=answer' "$tmp" || true)
# count real beacon lines (message "av_path"), not accidental substrings
av_paths=$(grep -cE ' (av_path|kind=av_path) ' "$tmp" 2>/dev/null || true)
if [[ "${av_paths:-0}" -eq 0 ]]; then
  av_paths=$(grep -c 'av_path' "$tmp" || true)
fi

last_match=$(grep 'solo matched' "$tmp" | tail -1 || true)
force_relay="?"
if echo "$last_match" | grep -q 'force_relay=true'; then force_relay=true
elif echo "$last_match" | grep -q 'force_relay=false'; then force_relay=false
fi
plat_a=$(echo "$last_match" | grep -oE 'platform_a=[a-z]+' | head -1 | cut -d= -f2 || true)
plat_b=$(echo "$last_match" | grep -oE 'platform_b=[a-z]+' | head -1 | cut -d= -f2 || true)

max_mto=$(grep -oE 'match_to_offer_ms=[0-9]+' "$tmp" | cut -d= -f2 | sort -n | tail -1 || true)
max_mta=$(grep -oE 'match_to_answer_ms=[0-9]+' "$tmp" | cut -d= -f2 | sort -n | tail -1 || true)
max_mti=$(grep -oE 'match_to_ice_ms=[0-9]+' "$tmp" | cut -d= -f2 | sort -n | tail -1 || true)
max_mto=${max_mto:-0}; max_mta=${max_mta:-0}; max_mti=${max_mti:-0}

last_offer_relay=$(grep 'first offer after match' "$tmp" | tail -1 | grep -oE 'relay_candidates=[0-9]+' | cut -d= -f2 || true)
last_answer_relay=$(grep 'first answer after match' "$tmp" | tail -1 | grep -oE 'relay_candidates=[0-9]+' | cut -d= -f2 || true)

grep 'av_path' "$tmp" | tail -16 >"$avf" || true
grep -E 'solo matched|first offer after match|first answer after match|av_path' "$tmp" | tail -24 >"$recf" || true

peer_zero=$(grep -c 'peer usage:.*rp=0, rb=0, sp=0, sb=0' "$tmpc" || true)
peer_hot=$(grep 'peer usage:' "$tmpc" | grep -vE 'rp=0, rb=0, sp=0, sb=0' | wc -l || true)
peer_hot=${peer_hot// /}
max_rb=$(grep -oE 'rb=[0-9]+' "$tmpc" | cut -d= -f2 | sort -n | tail -1 || true)
max_rb=${max_rb:-0}
alloc_ok=$(grep -c 'ALLOCATE processed, success' "$tmpc" || true)
err_437=$(grep -c 'error 437' "$tmpc" || true)
err_403=$(grep -cE '403|Forbidden IP' "$tmpc" || true)

health=$(curl -sS --max-time 3 http://127.0.0.1:8790/health 2>/dev/null || echo '{}')
has_turn=$(echo "$health" | python3 -c "import sys,json
try:
  print(json.load(sys.stdin).get('has_turn', False))
except Exception:
  print(False)
" 2>/dev/null || echo false)

coturn_ports=$(grep -E '^(min-port|max-port|external-ip)=' /etc/turnserver.conf 2>/dev/null | tr '\n' ' ' || true)

# Build JSON from files — never stuff multi-line logs into argv or shell quotes
export SNAP_MATCHES="${matches:-0}"
export SNAP_OFFERS="${offers:-0}"
export SNAP_ANSWERS="${answers:-0}"
export SNAP_SIG_OFFERS="${sig_offers:-0}"
export SNAP_SIG_ANSWERS="${sig_answers:-0}"
export SNAP_AV_PATHS="${av_paths:-0}"
export SNAP_FORCE_RELAY="$force_relay"
export SNAP_PLAT_A="${plat_a:-}"
export SNAP_PLAT_B="${plat_b:-}"
export SNAP_MAX_MTO="$max_mto"
export SNAP_MAX_MTA="$max_mta"
export SNAP_MAX_MTI="$max_mti"
export SNAP_OFFER_RELAY="${last_offer_relay:-}"
export SNAP_ANSWER_RELAY="${last_answer_relay:-}"
export SNAP_PEER_ZERO="${peer_zero:-0}"
export SNAP_PEER_HOT="${peer_hot:-0}"
export SNAP_MAX_RB="$max_rb"
export SNAP_ALLOC_OK="${alloc_ok:-0}"
export SNAP_ERR_437="${err_437:-0}"
export SNAP_ERR_403="${err_403:-0}"
export SNAP_HAS_TURN="$has_turn"
export SNAP_COTURN_PORTS="$coturn_ports"
export SNAP_AVF="$avf"
export SNAP_RECF="$recf"

python3 - <<'PY'
import json, os, re

def i(k, default=0):
    try:
        return int(os.environ.get(k) or default)
    except ValueError:
        return default

def read_lines(path, n=None):
    try:
        with open(path, "r", errors="replace") as f:
            lines = [ln.rstrip("\n") for ln in f]
    except OSError:
        return []
    if n is not None:
        return lines[-n:]
    return lines

def parse_av_path_line(line: str) -> dict:
    """Parse hub av_path log line into structured fields."""
    out = {"raw": line[:400]}
    # from= / platform=
    m = re.search(r"\bfrom=([^\s]+)", line)
    if m:
        out["from"] = m.group(1)
    m = re.search(r"\bplatform=([a-zA-Z0-9_-]+)", line)
    if m:
        out["platform"] = m.group(1)

    # summary= may be JSON (possibly truncated). Prefer first {...} blob.
    summary_raw = None
    m = re.search(r"\bsummary=(\{.*)", line)
    if m:
        summary_raw = m.group(1)
    else:
        m = re.search(r"(\{[^{]*\"frames_in\".*)", line)
        if m:
            summary_raw = m.group(1)
        else:
            m = re.search(r"(\{.*\})", line)
            if m:
                summary_raw = m.group(1)

    payload = None
    if summary_raw:
        s = summary_raw.strip()
        # try progressively shorter suffixes if truncated
        for end in range(len(s), max(len(s) - 80, 1), -1):
            chunk = s[:end]
            # balance braces if truncated mid-object
            if chunk.count("{") > chunk.count("}"):
                chunk = chunk + ("}" * (chunk.count("{") - chunk.count("}")))
            try:
                payload = json.loads(chunk)
                break
            except json.JSONDecodeError:
                continue
        out["summary_raw"] = s[:400]

    if isinstance(payload, dict):
        out["payload"] = payload
        for k in (
            "frames_in", "frames_out", "bytes_in", "bytes_out",
            "local_type", "remote_type", "ice", "cs", "sig",
            "ok", "why", "platform", "policy", "pair", "offerer",
            "force_relay", "hide_ip", "v", "t",
            "app_vc", "bind_v", "hub_fr",
        ):
            if k in payload:
                out[k] = payload[k]
        # normalize ok to bool/int-friendly
        if "ok" in out:
            okv = out["ok"]
            if isinstance(okv, str):
                out["ok"] = okv.lower() in ("1", "true", "yes")
            else:
                out["ok"] = bool(okv)
        for fk in ("frames_in", "frames_out", "bytes_in", "bytes_out"):
            if fk in out:
                try:
                    out[fk] = int(out[fk])
                except (TypeError, ValueError):
                    pass
    else:
        # fallback: fin=/fout= style from console echoes if ever logged
        m = re.search(r"\bframes_in[=:](\d+)", line)
        if m:
            out["frames_in"] = int(m.group(1))
        m = re.search(r"\bfin=(\d+)", line)
        if m:
            out["frames_in"] = int(m.group(1))
        m = re.search(r"\bframes_out[=:](\d+)", line)
        if m:
            out["frames_out"] = int(m.group(1))
        m = re.search(r"\bfout=(\d+)", line)
        if m:
            out["frames_out"] = int(m.group(1))
        m = re.search(r"\bok[=:](\d+|true|false)", line, re.I)
        if m:
            out["ok"] = m.group(1).lower() in ("1", "true")

    return out

av_lines = read_lines(os.environ["SNAP_AVF"])
recent = read_lines(os.environ["SNAP_RECF"])
av_parsed = [parse_av_path_line(ln) for ln in av_lines if "av_path" in ln]

# Aggregate av_path evidence (global + per-platform for product gates)
best_frames_in = 0
best_frames_out = 0
any_ok = False
any_frames = False
by_plat = {}  # platform -> max fin/fout + last force_relay/policy/app_vc
for p in av_parsed:
    fi = int(p.get("frames_in") or 0)
    fo = int(p.get("frames_out") or 0)
    if fi > best_frames_in:
        best_frames_in = fi
    if fo > best_frames_out:
        best_frames_out = fo
    if fi > 2:
        any_frames = True
    if p.get("ok") is True and (fi > 0 or fo > 0 or int(p.get("bytes_in") or 0) > 0):
        any_ok = True
    plat = str(p.get("platform") or "?").lower()
    if plat in ("", "?"):
        continue
    slot = by_plat.setdefault(
        plat,
        {
            "frames_in": 0,
            "frames_out": 0,
            "force_relay": None,
            "policy": None,
            "app_vc": None,
            "bind_v": None,
            "hub_fr": None,
        },
    )
    if fi > int(slot["frames_in"] or 0):
        slot["frames_in"] = fi
    if fo > int(slot["frames_out"] or 0):
        slot["frames_out"] = fo
    for k in ("force_relay", "policy", "app_vc", "bind_v", "hub_fr"):
        if p.get(k) is not None and p.get(k) != "":
            slot[k] = p.get(k)

av_path_ok = any_ok
av_path_frames = any_frames  # frames_in > 2 on any beacon

has_turn = str(os.environ.get("SNAP_HAS_TURN", "false")).lower() in ("true", "1", "yes")

snap = {
    "matches": i("SNAP_MATCHES"),
    "offers": i("SNAP_OFFERS"),
    "answers": i("SNAP_ANSWERS"),
    "sig_offers": i("SNAP_SIG_OFFERS"),
    "sig_answers": i("SNAP_SIG_ANSWERS"),
    "av_paths": i("SNAP_AV_PATHS"),
    "last_force_relay": os.environ.get("SNAP_FORCE_RELAY") or "?",
    "last_platform_a": os.environ.get("SNAP_PLAT_A") or "",
    "last_platform_b": os.environ.get("SNAP_PLAT_B") or "",
    "max_mto_ms": i("SNAP_MAX_MTO"),
    "max_mta_ms": i("SNAP_MAX_MTA"),
    "max_mti_ms": i("SNAP_MAX_MTI"),
    "last_offer_relay_candidates": os.environ.get("SNAP_OFFER_RELAY") or "",
    "last_answer_relay_candidates": os.environ.get("SNAP_ANSWER_RELAY") or "",
    "coturn_peer_usage_zero": i("SNAP_PEER_ZERO"),
    "coturn_peer_usage_hot": i("SNAP_PEER_HOT"),
    "coturn_max_rb": i("SNAP_MAX_RB"),
    "coturn_alloc_ok": i("SNAP_ALLOC_OK"),
    "coturn_err_437": i("SNAP_ERR_437"),
    "coturn_err_403": i("SNAP_ERR_403"),
    "has_turn": has_turn,
    "coturn_ports": (os.environ.get("SNAP_COTURN_PORTS") or "").strip(),
    "recent_lines": recent[-24:],
    "av_path_lines": av_lines[-16:],
    "av_path": {
        "count": len(av_parsed),
        "best_frames_in": best_frames_in,
        "best_frames_out": best_frames_out,
        "any_frames_in_gt2": av_path_frames,
        "any_ok": av_path_ok,
        "by_platform": by_plat,
        "beacons": av_parsed[-12:],
    },
}
print(json.dumps(snap, ensure_ascii=False))
PY
REMOTE
}

# ── optional coturn lock (once per invocation, not every watch tick) ───────
COTURN_VERDICT="skip"
if [[ "$DO_COTURN" == "1" ]]; then
  if bash "$ROOT/scripts/test-coturn-relay.sh" >"$OUT_DIR/coturn-lock.out" 2>&1; then
    COTURN_VERDICT="PASS"
  else
    COTURN_VERDICT="FAIL"
  fi
fi

# ── optional headless pair (once) ──────────────────────────────────────────
HEADLESS_VERDICT="skip"
HEADLESS_NOTE=""
if [[ "$DO_HEADLESS" == "1" ]]; then
  if command -v node >/dev/null && [[ -f "$ROOT/scripts/prod-pair-media.mjs" ]]; then
    set +e
    BUDGET_MS=35000 timeout 55 node "$ROOT/scripts/prod-pair-media.mjs" \
      >"$OUT_DIR/headless.out" 2>&1
    set -e
    if grep -qE 'PASS|frames.*>|inbound.*frame' "$OUT_DIR/headless.out" 2>/dev/null; then
      HEADLESS_VERDICT="PASS"
    elif grep -q 'matched.: false' "$OUT_DIR/headless.out" 2>/dev/null; then
      HEADLESS_VERDICT="IDLE"
      HEADLESS_NOTE="headless never matched (age gate or queue)"
    else
      HEADLESS_VERDICT="FAIL"
      HEADLESS_NOTE="no remote frames in budget"
    fi
  else
    HEADLESS_VERDICT="skip"
    HEADLESS_NOTE="no node/chrome"
  fi
fi

# ── score one snapshot → artifacts; print exit code on last line ───────────
score_once() {
  local snap_file="$1"
  local at stamp
  at="$(ts_utc)"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"

  # Pass paths/scalars via env — never large JSON on argv
  AT="$at" STAMP="$stamp" WINDOW_MIN="$MIN" \
  SNAP_FILE="$snap_file" OUT_DIR="$OUT_DIR" \
  COTURN_V="$COTURN_VERDICT" HEADLESS_V="$HEADLESS_VERDICT" HEADLESS_NOTE="$HEADLESS_NOTE" \
  python3 - <<'PY'
import json, os, sys
from pathlib import Path

out_dir = Path(os.environ["OUT_DIR"])
at = os.environ["AT"]
stamp = os.environ["STAMP"]
window = int(os.environ["WINDOW_MIN"])
coturn_v = os.environ.get("COTURN_V") or "skip"
headless_v = os.environ.get("HEADLESS_V") or "skip"
headless_note = os.environ.get("HEADLESS_NOTE") or ""

snap_path = Path(os.environ["SNAP_FILE"])
try:
    snap = json.loads(snap_path.read_text(encoding="utf-8"))
except Exception as e:
    print(f"FAIL: cannot parse snapshot JSON: {e}", file=sys.stderr)
    sys.exit(2)

m = int(snap.get("matches") or 0)
o = int(snap.get("offers") or 0)
a = int(snap.get("answers") or 0)
hot = int(snap.get("coturn_peer_usage_hot") or 0)
max_rb = int(snap.get("coturn_max_rb") or 0)
e437 = int(snap.get("coturn_err_437") or 0)

av = snap.get("av_path") or {}
av_frames = bool(av.get("any_frames_in_gt2"))
av_ok = bool(av.get("any_ok"))
best_fi = int(av.get("best_frames_in") or 0)
best_fo = int(av.get("best_frames_out") or 0)
by_plat = av.get("by_platform") or {}
web_slot = by_plat.get("web") or {}
and_slot = by_plat.get("android") or {}
web_fin = int(web_slot.get("frames_in") or 0)
web_fout = int(web_slot.get("frames_out") or 0)
and_fin = int(and_slot.get("frames_in") or 0)
and_fout = int(and_slot.get("frames_out") or 0)
# If by_platform empty, fall back to global bests (weaker signal)
if not by_plat:
    web_fin = web_fout = and_fin = and_fout = 0

def _truthy_fr(v):
    if v is True or v == 1:
        return True
    if v is False or v == 0:
        return False
    s = str(v).strip().lower()
    if s in ("1", "true", "yes"):
        return True
    if s in ("0", "false", "no", "", "none", "?"):
        return False
    return None

hub_fr = snap.get("last_force_relay")
hub_fr_b = _truthy_fr(hub_fr)
web_fr_b = _truthy_fr(web_slot.get("force_relay"))
# Only treat android FR as known when the key was present on a beacon
and_fr_raw = and_slot.get("force_relay")
and_fr_b = _truthy_fr(and_fr_raw) if and_fr_raw is not None else None
and_policy = and_slot.get("policy")
app_vc = and_slot.get("app_vc")
if app_vc is None:
    app_vc = web_slot.get("app_vc")
bind_v = and_slot.get("bind_v")
hub_fr_beacon = and_slot.get("hub_fr")
# Mismatch only when hub wants pure AND phone explicitly reports non-relay
fr_mismatch = bool(
    hub_fr_b is True
    and (
        and_fr_b is False
        or (and_policy is not None and str(and_policy).lower() in ("all", "0"))
    )
)

# Product: both directions of video (PC sees phone + phone sees PC)
# phone→PC: web frames_in (primary) or android frames_out (sender proof)
# PC→phone: android frames_in (primary) — do NOT use web frames_out alone
#   (web fout only means PC is encoding, not that the phone receives)
min_frames = 10
phone_to_pc = web_fin >= min_frames or and_fout >= min_frames
pc_to_phone = and_fin >= min_frames
has_pair_platforms = bool(web_slot or and_slot)
# Strong ok: both receive OR (web receives + phone encodes)
product_ok_frames = (
    web_fin >= min_frames
    and (and_fout >= min_frames or and_fin >= min_frames)
)

gates = []  # list of (level, msg)
signaling_ok = False
media_pass = False
media_dead = False
hard_fail = False
product_status = "unknown"

# ── Signaling ──────────────────────────────────────────────────────────────
if m == 0:
    gates.append(("IDLE", "no matches in window — run a PC+phone smoke then re-run"))
else:
    if a == 0:
        # FAIL if matches>0 and answers=0 (covers offers=0 or phone not answering)
        msg = "matches>0 but answers=0"
        if o == 0:
            msg = "matches>0 but zero first offers and answers"
        else:
            msg = "matches>0 offers>0 but answers=0 (phone not answering)"
        gates.append(("FAIL", msg))
        hard_fail = True
    elif o == 0:
        gates.append(("FAIL", "matches>0 answers>0 but zero first offers (log anomaly)"))
        hard_fail = True
    elif a < o:
        gates.append(("WARN", f"answers ({a}) < offers ({o}) — some pairs no answer"))
        signaling_ok = True  # partial but had answers
    else:
        gates.append(("PASS", f"signaling OK: matches={m} offers={o} answers={a}"))
        signaling_ok = True

    if snap.get("max_mto_ms", 0) > 8000:
        gates.append(("WARN", f"slow offer max_mto={snap['max_mto_ms']}ms"))
    if snap.get("max_mta_ms", 0) > 10000:
        gates.append(("WARN", f"slow answer max_mta={snap['max_mta_ms']}ms"))

    # ── Media plane ────────────────────────────────────────────────────────
    # PASS: max_rb>=5000 OR av_path ok=1 with frames
    # FAIL media dead: answers>0 and max_rb<2000 AND no av_path frames_in>2
    if max_rb >= 5000:
        gates.append(("PASS", f"TURN media HOT max_rb={max_rb} peer_hot={hot}"))
        media_pass = True
    elif av_ok and (best_fi > 0 or best_fo > 0 or av_frames):
        gates.append((
            "PASS",
            f"av_path ok=1 with frames (best frames_in={best_fi} frames_out={best_fo})",
        ))
        media_pass = True
    elif a > 0 and max_rb < 2000 and not av_frames:
        gates.append((
            "FAIL",
            f"media dead: answers>0 max_rb={max_rb}<2000 and no av_path frames_in>2",
        ))
        media_dead = True
        hard_fail = True
    elif max_rb >= 2000 or av_frames:
        detail = f"max_rb={max_rb}"
        if av_frames:
            detail += f" av_frames_in={best_fi}"
        gates.append(("WARN", f"media partial ({detail}) — need max_rb>=5000 or av_path ok=1"))
    else:
        gates.append((
            "WARN",
            f"no strong media evidence (max_rb={max_rb}, av_path frames_in={best_fi})",
        ))

    if e437 > 20:
        gates.append(("WARN", f"coturn 437 mismatched-allocation storms count={e437}"))

    # ── Product A/V (both faces) — independent of TURN HOT ───────────────
    if a > 0 and has_pair_platforms:
        if product_ok_frames:
            product_status = "ok"
            gates.append((
                "PASS",
                f"PRODUCT both directions: web fin/fout={web_fin}/{web_fout} "
                f"android fin/fout={and_fin}/{and_fout}",
            ))
        elif not phone_to_pc and (pc_to_phone or web_fout >= min_frames):
            # Classic PC black: PC encodes / phone may recv; phone not sending / web fin=0
            product_status = "one-way"
            gates.append((
                "WARN",
                f"PRODUCT one-way (phone→PC dead / PC black): web fin={web_fin} "
                f"android fout={and_fout} (need web fin≥{min_frames} or android fout≥{min_frames})",
            ))
        elif phone_to_pc and not pc_to_phone:
            product_status = "one-way"
            gates.append((
                "WARN",
                f"PRODUCT one-way (PC→phone weak): web fin/fout={web_fin}/{web_fout} "
                f"android fin/fout={and_fin}/{and_fout}",
            ))
        elif web_fout > 0 or and_fin > 0 or web_fin > 0 or and_fout > 0:
            product_status = "partial"
            gates.append((
                "WARN",
                f"PRODUCT partial frames web={web_fin}/{web_fout} android={and_fin}/{and_fout}",
            ))
        else:
            product_status = "no-media"
            gates.append((
                "WARN",
                "PRODUCT no frames either side after answer (check av_path / APK)",
            ))
        if fr_mismatch:
            gates.append((
                "WARN",
                f"force_relay mismatch: hub=true android fr={and_slot.get('force_relay')} "
                f"policy={and_policy} (client latch)",
            ))
    elif a > 0 and not has_pair_platforms:
        product_status = "unknown"
        gates.append(("INFO", "PRODUCT unknown — no per-platform av_path beacons"))

    if int(snap.get("av_paths") or 0) > 0 or (av.get("count") or 0) > 0:
        if not media_pass and not media_dead:
            gates.append((
                "INFO",
                f"av_path beacons={snap.get('av_paths', 0)} "
                f"best_fin={best_fi} best_fout={best_fo} any_ok={av_ok}",
            ))
    else:
        gates.append((
            "INFO",
            "no av_path beacons yet — install web/APK with beacon after next deploy",
        ))

if m == 0:
    product_status = "idle"

if coturn_v == "PASS":
    gates.append(("PASS", "coturn self-peer ChannelBind lock"))
elif coturn_v == "FAIL":
    gates.append(("FAIL", "coturn self-peer ChannelBind lock FAILED"))
    hard_fail = True

if headless_v == "PASS":
    gates.append(("PASS", "headless pair saw frames"))
    media_pass = True
elif headless_v == "FAIL":
    gates.append(("FAIL", f"headless pair: {headless_note}"))
elif headless_v == "IDLE":
    gates.append(("INFO", headless_note))

# ── Overall verdict ────────────────────────────────────────────────────────
# PASS only when signaling OK AND media plane OK AND product ok (when measurable)
#   and no FAIL / WARN gates.
# FAIL if any FAIL gate (answers=0, media dead, coturn lock, …).
# IDLE if no matches and no FAIL.
# WARN otherwise (partial media, PRODUCT one-way, answers<offers, 437, …).
any_fail = any(g[0] == "FAIL" for g in gates)
any_warn = any(g[0] == "WARN" for g in gates)
if any_fail or hard_fail:
    worst = "FAIL"
elif m == 0:
    worst = "IDLE"
elif signaling_ok and media_pass and product_status == "ok" and not any_warn:
    worst = "PASS"
elif signaling_ok and media_pass and product_status in ("unknown",) and not any_warn:
    # No per-platform beacons but infra green — keep PASS (legacy) but product stays unknown
    worst = "PASS"
else:
    worst = "WARN"

product = {
    "status": product_status,
    "done": bool(product_status == "ok"),
    "min_frames": min_frames,
    "web_frames_in": web_fin,
    "web_frames_out": web_fout,
    "android_frames_in": and_fin,
    "android_frames_out": and_fout,
    "phone_to_pc": bool(phone_to_pc) if a > 0 else None,
    "pc_to_phone": bool(pc_to_phone) if a > 0 else None,
    "force_relay_hub": hub_fr,
    "force_relay_web": web_slot.get("force_relay"),
    "force_relay_android": and_slot.get("force_relay"),
    "android_policy": and_policy,
    "force_relay_mismatch": fr_mismatch,
    "app_vc": app_vc,
    "bind_v": bind_v,
    "hub_fr_beacon": hub_fr_beacon,
}

report = {
    "v": 3,
    "tool": "av-verify",
    "at": at,
    "stamp": stamp,
    "window_min": window,
    "verdict": worst,
    "product": product,
    "hard_fail": hard_fail,
    "signaling_ok": signaling_ok,
    "media_pass": media_pass,
    "gates": [{"level": g, "msg": msg} for g, msg in gates],
    "snapshot": snap,
    "coturn_lock": coturn_v,
    "headless": {"verdict": headless_v, "note": headless_note},
    "how_to_read": {
        "PASS": "Signaling + media + PRODUCT both directions (or no product beacons yet)",
        "FAIL": "Black cams likely: answers=0 or media dead (max_rb<2000, no frames)",
        "IDLE": "No human/headless match in window — not a code verdict",
        "WARN": "Partial / PRODUCT one-way — not ship-ready even if TURN HOT",
        "product": "ok|one-way|partial|no-media|idle|unknown — agents route on this",
    },
    "exit_codes": {
        "0": "PASS or IDLE",
        "1": "FAIL",
        "2": "tool/SSH error",
        "3": "WARN (includes PRODUCT one-way)",
    },
    "next": [
        "Human: PC hard-refresh + phone Start; leave linked 20s",
        "Then: ./scripts/av-verify.sh --min 10  (or ./scripts/av-loop.sh)",
        "Agent: read verdict AND product.status in latest.json",
        "PRODUCT one-way → client-ice (not turn thrash if media_pass)",
    ],
}

out_dir.mkdir(parents=True, exist_ok=True)
text = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
(out_dir / "latest.json").write_text(text, encoding="utf-8")
(out_dir / f"{stamp}.json").write_text(text, encoding="utf-8")
with open(out_dir / "HISTORY.jsonl", "a", encoding="utf-8") as f:
    f.write(json.dumps(report, separators=(",", ":"), ensure_ascii=False) + "\n")

md = []
md.append(f"# av-verify **{worst}** · product **{product_status}**")
md.append("")
md.append(f"- at: `{at}`")
md.append(f"- window: last **{window} min**")
md.append(
    f"- last match: force_relay=`{snap.get('last_force_relay')}` "
    f"platforms=`{snap.get('last_platform_a')}`↔`{snap.get('last_platform_b')}`"
)
md.append(
    f"- signaling: matches={m} offers={o} answers={a} "
    f"max_mto={snap.get('max_mto_ms', 0)}ms max_mta={snap.get('max_mta_ms', 0)}ms "
    f"(signaling_ok={signaling_ok})"
)
md.append(
    f"- TURN: alloc_ok={snap.get('coturn_alloc_ok')} peer_hot={hot} "
    f"max_rb={max_rb} err_437={e437} (media_pass={media_pass})"
)
md.append(
    f"- relay_candidates last offer/answer: "
    f"{snap.get('last_offer_relay_candidates')}/{snap.get('last_answer_relay_candidates')}"
)
md.append(
    f"- av_path: count={av.get('count', 0)} best_fin={best_fi} "
    f"best_fout={best_fo} any_ok={av_ok} frames_in>2={av_frames}"
)
md.append(
    f"- **PRODUCT**: status=`{product_status}` done=`{product.get('done')}` "
    f"web fin/fout=`{web_fin}/{web_fout}` android fin/fout=`{and_fin}/{and_fout}` "
    f"fr_mismatch=`{fr_mismatch}` app_vc=`{app_vc}` bind_v=`{bind_v}`"
)
md.append("")
md.append("## Gates")
for g, msg in gates:
    md.append(f"- **{g}**: {msg}")
md.append("")
md.append("## Recent hub lines")
md.append("```")
for line in (snap.get("recent_lines") or [])[-24:]:
    md.append(line[:220])
md.append("```")
if snap.get("av_path_lines"):
    md.append("")
    md.append("## Client av_path beacons")
    md.append("```")
    for line in snap["av_path_lines"]:
        md.append(line[:240])
    md.append("```")
beacons = av.get("beacons") or []
if beacons:
    md.append("")
    md.append("## Parsed av_path")
    md.append("| platform | ice | local→remote | frames_in | frames_out | fr | policy | ok | why |")
    md.append("|----------|-----|--------------|-----------|------------|----|--------|----|-----|")
    for b in beacons[-8:]:
        lt = b.get("local_type", "?")
        rt = b.get("remote_type", "?")
        md.append(
            f"| {b.get('platform', '?')} | {b.get('ice', '?')} | {lt}→{rt} | "
            f"{b.get('frames_in', '')} | {b.get('frames_out', '')} | "
            f"{b.get('force_relay', '')} | {b.get('policy', '')} | "
            f"{b.get('ok', '')} | {b.get('why', '')} |"
        )
md.append("")
md.append("## What FAIL / WARN means for black cam")
md.append("| Symptom | Gate |")
md.append("|---------|------|")
md.append("| Linking forever, no partner | answers=0 FAIL |")
md.append("| Offer+answer but black/silent | media dead FAIL or PRODUCT no-media WARN |")
md.append("| Phone sees PC, PC black | PRODUCT one-way WARN → client-ice |")
md.append("| Hub pure, phone policy=all | force_relay mismatch WARN |")
md.append("| 437 storms | coturn err_437 high WARN |")
md.append("")
md.append("Agent contract: read `verdict` **and** `product` in `latest.json`")
md.append(f"Full JSON: `artifacts/av-verify/latest.json`")

(out_dir / "latest.md").write_text("\n".join(md) + "\n", encoding="utf-8")
print("\n".join(md))
print(f"\n→ {out_dir / 'latest.md'}")
print(f"→ {out_dir / 'latest.json'}")

# Exit codes: 0=PASS/IDLE, 1=FAIL, 2=tool error, 3=WARN
if worst == "FAIL":
    code = 1
elif worst == "WARN":
    code = 3
else:
    code = 0  # PASS or IDLE
# Emit machine-readable trailer for bash (not part of md)
print(f"__AV_VERIFY_EXIT__={code}")
print(f"__AV_VERIFY_VERDICT__={worst}")
print(f"__AV_VERIFY_PRODUCT__={product_status}")
print(f"__AV_VERIFY_HARD_FAIL__={1 if hard_fail else 0}")
sys.exit(0)  # always 0 from python; bash maps trailer → process exit
PY
}

# Sets globals: SCORE_RC, VERDICT, HARD_FAIL. Never returns non-zero (set -e safe).
run_score() {
  local snap_tmp out rc
  SCORE_RC=2
  VERDICT="UNKNOWN"
  HARD_FAIL=0
  snap_tmp=$(mktemp)

  if ! pull_snapshot >"$snap_tmp" 2>"$OUT_DIR/ssh.err"; then
    echo "FAIL: SSH snapshot failed" >&2
    if [[ -s "$OUT_DIR/ssh.err" ]]; then
      tail -20 "$OUT_DIR/ssh.err" >&2 || true
    fi
    rm -f "$snap_tmp"
    SCORE_RC=2
    return 0
  fi

  # Validate JSON before scoring
  if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$snap_tmp" 2>/dev/null; then
    echo "FAIL: remote snapshot is not valid JSON" >&2
    head -c 500 "$snap_tmp" >&2 || true
    echo >&2
    rm -f "$snap_tmp"
    SCORE_RC=2
    return 0
  fi

  # Capture scorer stdout; python always exits 0 (code in trailer)
  out=$(score_once "$snap_tmp" 2>&1) || rc=$?
  rc=${rc:-0}
  rm -f "$snap_tmp"
  if [[ $rc -ne 0 ]]; then
    echo "$out" >&2
    echo "FAIL: scorer crashed (exit $rc)" >&2
    SCORE_RC=2
    return 0
  fi
  SCORE_RC=$(echo "$out" | grep '^__AV_VERIFY_EXIT__=' | tail -1 | cut -d= -f2)
  SCORE_RC="${SCORE_RC:-2}"
  VERDICT=$(echo "$out" | grep '^__AV_VERIFY_VERDICT__=' | tail -1 | cut -d= -f2)
  HARD_FAIL=$(echo "$out" | grep '^__AV_VERIFY_HARD_FAIL__=' | tail -1 | cut -d= -f2)
  VERDICT="${VERDICT:-UNKNOWN}"
  HARD_FAIL="${HARD_FAIL:-0}"
  # Human report (suppressed when --json: path only after run)
  if [[ "${JSON_ONLY:-0}" != "1" ]]; then
    echo "$out" | grep -v '^__AV_VERIFY_' || true
  fi
  return 0
}

# ── watch mode: re-score every N seconds for up to 3 minutes ───────────────
WATCH_BUDGET_S=180
SCORE_RC=0
VERDICT="UNKNOWN"
HARD_FAIL=0

if [[ "$WATCH_S" -gt 0 ]]; then
  echo "Watch mode: every ${WATCH_S}s for up to ${WATCH_BUDGET_S}s — stop on PASS or hard FAIL"
  watch_end=$((SECONDS + WATCH_BUDGET_S))
  tick=0
  while true; do
    tick=$((tick + 1))
    echo ""
    echo "── watch tick $tick @ $(ts_utc) ──"
    run_score
    echo "verdict=${VERDICT} hard_fail=${HARD_FAIL} rc=${SCORE_RC}"

    if [[ "$VERDICT" == "PASS" || "$VERDICT" == "IDLE" ]]; then
      echo "Stopping early: ${VERDICT}"
      break
    fi
    if [[ "$HARD_FAIL" == "1" || "$SCORE_RC" -eq 1 ]]; then
      echo "Stopping early: hard FAIL"
      break
    fi
    if [[ "$SCORE_RC" -eq 2 ]]; then
      echo "Stopping: tool error"
      break
    fi
    if (( SECONDS >= watch_end )); then
      echo "Watch budget (${WATCH_BUDGET_S}s) exhausted — last verdict=${VERDICT}"
      break
    fi
    # sleep remaining interval, but not past budget
    sleep_for=$WATCH_S
    left=$((watch_end - SECONDS))
    if (( left <= 0 )); then
      break
    fi
    if (( sleep_for > left )); then
      sleep_for=$left
    fi
    sleep "$sleep_for"
  done
else
  run_score
fi

if [[ "$JSON_ONLY" == "1" ]]; then
  echo "$OUT_DIR/latest.json"
fi

exit "$SCORE_RC"
