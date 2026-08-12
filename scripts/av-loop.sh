#!/usr/bin/env bash
# av-loop — measure + route + emit job cards for Grok subagents and Claude.
# Does NOT implement fixes. Augmentation: clear next prompts for agents.
#
# Usage:
#   ./scripts/av-loop.sh                 # score + write job cards
#   ./scripts/av-loop.sh --min 10
#   ./scripts/av-loop.sh --wait 90       # wait for match first
#   ./scripts/av-loop.sh --claude-run    # also run `claude -p` on claude-job (narrow, no deploy)
#
# Outputs:
#   artifacts/av-loop/latest.json        route + product + scorecard summary
#   artifacts/av-loop/grok-job.md        spawn_subagent prompt (ONE writer)
#   artifacts/av-loop/claude-job.md      Claude Code / claude -p (narrow)
#   artifacts/av-loop/verify-after.md    mandatory re-score card after implementer
#   artifacts/av-loop/director.md        director spawn protocol
#   artifacts/av-loop/NEXT_ROLE          plain role name
#   artifacts/av-loop/PRODUCT            product.status
#
# Exit: same as av-verify (0 PASS/IDLE, 1 FAIL, 2 tool, 3 WARN) unless --claude-run
# then claude's exit may override after cards are written.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="$ROOT/artifacts/av-loop"
mkdir -p "$OUT"

MIN=15
WAIT=0
CLAUDE_RUN=0
EXTRA=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --min) MIN="${2:-15}"; shift 2 ;;
    --wait) WAIT="${2:-90}"; shift 2 ;;
    --claude-run) CLAUDE_RUN=1; shift ;;
    --coturn) EXTRA+=(--coturn); shift ;;
    -h|--help)
      sed -n '2,28p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "unknown: $1" >&2; exit 2 ;;
  esac
done

ARGS=(--min "$MIN")
[[ "$WAIT" -gt 0 ]] && ARGS+=(--wait "$WAIT")
ARGS+=("${EXTRA[@]}")

set +e
./scripts/av-verify.sh "${ARGS[@]}"
AV_RC=$?
set -e

SCORE="$ROOT/artifacts/av-verify/latest.json"
if [[ ! -f "$SCORE" ]]; then
  echo "FAIL: no scorecard at $SCORE" >&2
  exit 2
fi

python3 - "$SCORE" "$OUT" "$ROOT/artifacts/av-verify/HISTORY.jsonl" <<'PY'
import json, sys
from pathlib import Path

score_path, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
hist_path = Path(sys.argv[3]) if len(sys.argv) > 3 else None
d = json.loads(score_path.read_text())
snap = d.get("snapshot") or {}
av = snap.get("av_path") or {}
beacons = av.get("beacons") or []
by_plat = av.get("by_platform") or {}
product = d.get("product") or {}

def max_frames(plat_key):
    slot = by_plat.get(plat_key) or {}
    fin = int(slot.get("frames_in") or 0)
    fout = int(slot.get("frames_out") or 0)
    if fin or fout:
        return fin, fout
    # beacon fallback
    fin = fout = 0
    for b in beacons:
        if str(b.get("platform") or "") != plat_key:
            continue
        try:
            fin = max(fin, int(b.get("frames_in") or 0))
            fout = max(fout, int(b.get("frames_out") or 0))
        except Exception:
            pass
    return fin, fout

web_fin, web_fout = max_frames("web")
and_fin, and_fout = max_frames("android")

# Prefer product block from av-verify v3
if product:
    web_fin = int(product.get("web_frames_in") or web_fin or 0)
    web_fout = int(product.get("web_frames_out") or web_fout or 0)
    and_fin = int(product.get("android_frames_in") or and_fin or 0)
    and_fout = int(product.get("android_frames_out") or and_fout or 0)

verdict = d.get("verdict") or "UNKNOWN"
prod_status = (product.get("status") if product else None) or "unknown"
gates = d.get("gates") or []
fr = snap.get("last_force_relay")
plat_a = snap.get("last_platform_a") or ""
plat_b = snap.get("last_platform_b") or ""
max_rb = int(snap.get("coturn_max_rb") or 0)
e437 = int(snap.get("coturn_err_437") or 0)
offers = int(snap.get("offers") or 0)
answers = int(snap.get("answers") or 0)
matches = int(snap.get("matches") or 0)
fr_mismatch = bool(product.get("force_relay_mismatch")) if product else False
app_vc = product.get("app_vc") if product else None
bind_v = product.get("bind_v") if product else None

# Delta vs previous HISTORY line (if any)
delta = "unknown"
prev_prod = None
prev_verdict = None
if hist_path and hist_path.is_file():
    lines = [ln for ln in hist_path.read_text().splitlines() if ln.strip()]
    if len(lines) >= 2:
        try:
            prev = json.loads(lines[-2])
            prev_verdict = prev.get("verdict")
            prev_prod = (prev.get("product") or {}).get("status")
            if prev_verdict == verdict and prev_prod == prod_status:
                delta = "same"
            elif verdict == "FAIL" and prev_verdict in ("PASS", "WARN"):
                delta = "worse"
            elif prod_status == "one-way" and prev_prod == "ok":
                delta = "worse"
            elif prod_status == "ok" and prev_prod in ("one-way", "partial", "no-media"):
                delta = "better"
            elif verdict == "PASS" and prev_verdict in ("FAIL", "WARN"):
                delta = "better"
            else:
                delta = "changed"
        except Exception:
            delta = "unknown"

# --- ROUTE (table) — product before infrastructure PASS ---
role = "none"
reason = ""
claude_file = ""
own = ""
done_when = ""
wiki_hint = "knowledge/wiki/index.md"

if matches == 0 or prod_status == "idle":
    role = "smoke"
    reason = "IDLE: no matches — human must Start PC+phone"
    done_when = "human Start once both sides ≥20s then re-run av-loop"
elif answers == 0 and offers > 0:
    role = "client-ice"
    reason = "answers=0 — phone not answering"
    own = "mobile/src/media/MediaSession.ts mobile/app/live.tsx"
    done_when = "hub first answer within 5s of offer; answers>=offers"
    claude_file = "mobile/src/media/MediaSession.ts"
    wiki_hint = "knowledge/wiki/gotchas.md"
elif prod_status == "one-way" or (
    and_fout == 0 and and_fin > 0
) or (
    web_fin == 0 and web_fout > 50 and max_rb > 5000
):
    role = "client-ice"
    reason = (
        f"PRODUCT {prod_status}: phone→PC video dead or one-way "
        f"(web fin={web_fin} android fout={and_fout}; android fin={and_fin})"
    )
    if fr_mismatch:
        reason += " + force_relay mismatch (hub pure / phone policy=all)"
    own = "mobile/src/media/MediaSession.ts (bindAnswerOutbound, forceRelay sticky) mobile/app/live.tsx"
    done_when = "product.status=ok (web frames_in>=10 AND android frames_out>=10); android force_relay=1 if hub pure"
    claude_file = "mobile/src/media/MediaSession.ts"
    wiki_hint = "knowledge/wiki/one-way-video.md"
elif str(fr) == "true" and max_rb < 2000 and answers > 0:
    role = "turn-media"
    reason = "force_relay=true but media dead on TURN"
    own = "scripts/test-coturn-relay.sh scripts/deploy/coturn.conf"
    done_when = "test-coturn-relay PASS and max_rb>=5000 on next smoke"
    claude_file = ""
    wiki_hint = "knowledge/wiki/force-relay-same-lan.md"
elif e437 > 40 and max_rb < 5000:
    role = "turn-media"
    reason = "437 ALLOCATE storms + weak media"
    own = "coturn conf + client pool must stay 0 (verify only on clients)"
    done_when = "err_437 low and dual-relay lock PASS"
    wiki_hint = "knowledge/wiki/gotchas.md"
elif prod_status == "ok" or (verdict == "PASS" and prod_status in ("ok", "unknown")):
    role = "verify-only" if prod_status != "ok" else "ship"
    if prod_status == "ok":
        role = "ship"
        reason = "PRODUCT ok — confirm human faces ≥20s then stop thrash"
        done_when = "human both faces + audio ≥20s; optional knowledge-compound"
    else:
        role = "verify-only"
        reason = "infra PASS but product unknown — re-score after smoke or confirm beacons"
        done_when = "product.status=ok or human both faces"
    wiki_hint = "knowledge/specs/current-av.md"
else:
    role = "diagnose"
    reason = f"verdict={verdict} product={prod_status} — re-read gates before implementing"
    done_when = "NEXT_ROLE chosen with one sentence WHY"
    wiki_hint = "knowledge/wiki/connect-scorecard.md"

gate_lines = "; ".join(f"{g.get('level')}:{g.get('msg','')[:100]}" for g in gates[:8])

summary = {
    "verdict": verdict,
    "product": prod_status,
    "product_detail": product,
    "delta": delta,
    "prev_verdict": prev_verdict,
    "prev_product": prev_prod,
    "next_role": role,
    "reason": reason,
    "matches": matches,
    "offers": offers,
    "answers": answers,
    "force_relay": fr,
    "force_relay_mismatch": fr_mismatch,
    "platforms": f"{plat_a}↔{plat_b}",
    "max_rb": max_rb,
    "err_437": e437,
    "web_frames_in": web_fin,
    "web_frames_out": web_fout,
    "android_frames_in": and_fin,
    "android_frames_out": and_fout,
    "app_vc": app_vc,
    "bind_v": bind_v,
    "gates": gates,
    "own": own,
    "done_when": done_when,
    "claude_file": claude_file,
    "wiki_hint": wiki_hint,
    "scorecard_at": d.get("at"),
}

out_dir.mkdir(parents=True, exist_ok=True)
(out_dir / "latest.json").write_text(json.dumps(summary, indent=2) + "\n")
(out_dir / "NEXT_ROLE").write_text(role + "\n")
(out_dir / "PRODUCT").write_text(prod_status + "\n")

score_blob = f"""verdict={verdict} product={prod_status} delta={delta}
matches={matches} offers={offers} answers={answers}
force_relay={fr} fr_mismatch={fr_mismatch} platforms={plat_a}↔{plat_b}
max_rb={max_rb} err_437={e437}
web frames_in={web_fin} frames_out={web_fout}
android frames_in={and_fin} frames_out={and_fout}
app_vc={app_vc} bind_v={bind_v}
gates: {gate_lines}
scorecard_at={d.get('at')}
"""

output_contract = """OUTPUT (exact keys, last 15 lines of your reply):
LANE: <role>
GOAL_MET: yes|no|blocked
CHANGED: <paths or none>
EVIDENCE: <one line from scorecard/logs>
NEXT: verify-only|smoke|ship|compound|none
PRODUCT_EXPECT: <what product.status should be after smoke>
"""

grok = f"""# Grok subagent job card (spawn ONE writer)

## SCORECARD (authoritative — do not re-litigate)
{score_blob}

## TASK
LANE: {role}
REASON: {reason}
OWN: {own or "(read-only — no product edits)"}
DONE WHEN: {done_when or "report only"}
WIKI FIRST: {wiki_hint}
SPEC: knowledge/specs/current-av.md (if A/V product)

## MUST NOT
- pool>0; dual-offer thrash; unprompted push.sh
- flip hub force_relay without parent order
- edit outside OWN
- claim GOAL_MET=yes without product.status=ok or human smoke
- thrash coturn when max_rb HOT and product is one-way

## VERIFY CONTRACT
After you finish (if you edited code): parent will run verify-after.md.
You do NOT re-score unless LANE is verify-only/diagnose.

{output_contract}

Plugin agent: ruletka-connect agents/{role}.md
Persona: no-thrash (+ strict-verify if diagnose/verify-only).
"""
(out_dir / "grok-job.md").write_text(grok)

claude = f"""# Claude Code job card (narrow worker — not director)

You are a **single-lane implementer** for freenet-roulette. Grok owns measure/route/ship.

## SCORECARD (do not re-litigate)
{score_blob}

## TASK
LANE: {role}
REASON: {reason}
PRIMARY FILE: {claude_file or "(none — do not edit; summarize only)"}
OWN ONLY: {own or "none"}
DONE WHEN: {done_when}
WIKI: {wiki_hint}

## MUST NOT
- Change coturn / hub force_relay policy / iceCandidatePoolSize
- Dual-offer or answerer re-offer spam
- Deploy or push.sh
- Expand scope beyond OWN
- GOAL_MET=yes without frames (use blocked if needs smoke)

## WHEN DONE
{output_contract}
Then stop. Grok will re-run av-verify / verify-after.
"""
(out_dir / "claude-job.md").write_text(claude)

verify_after = f"""# verify-after job card (run after ANY implementer hop)

You are **verify-only**. No product code edits. No APK.

## BEFORE (this loop's baseline)
{score_blob}

## STEPS
1. ./scripts/av-verify.sh --min 10
   # if human just smoked: --wait 60
2. Read artifacts/av-verify/latest.json — fields: verdict, product, gates
3. Compare product.status and frames to BEFORE above (delta)

## OUTPUT
VERDICT: …
PRODUCT: …
DELTA: better|worse|same|unknown
FRAMES: web_fin= web_fout= and_fin= and_fout=
APP_VC: …
FORCE_RELAY_MISMATCH: yes|no
REVERT: yes|no
HUMAN_NEEDED: smoke|install-apk|none
NEXT: smoke|client-ice|turn-media|ship|compound|none
SUMMARY: ≤3 sentences

## RULES
- product one-way + media_pass → NEXT=client-ice (not turn thrash)
- worse than BEFORE → REVERT=yes
- product ok → NEXT=ship or compound; ask human faces if not confirmed
- missing/old app_vc after mobile ship → HUMAN_NEEDED=install-apk
"""
(out_dir / "verify-after.md").write_text(verify_after)

director = f"""# Director protocol (Grok parent — do not skip)

## 1. Measure (done if you just ran av-loop)
NEXT_ROLE={role}
PRODUCT={prod_status}
DELTA={delta}
REASON={reason}

## 2. Spawn rules
| NEXT_ROLE | Action |
|-----------|--------|
| smoke | Tell human /smoke-hint. No implementer. |
| diagnose / verify-only | Spawn RO Grok with grok-job.md |
| client-ice / turn-media | Spawn **ONE** writer: Grok **or** Claude (not both thrashing same file) |
| ship | Stop thrash; human faces; offer compound |

## 3. After implementer returns
1. Spawn or yourself run **verify-after.md** (re-score)
2. If DELTA=worse → REVERT last change
3. If product still one-way and hops≥2 without smoke → STUCK → human
4. If mobile changed → smoke (install APK); do not claim fixed
5. Solid diagnosis or product ok → /knowledge-compound

## 4. Dual Claude+Grok
Prefer one writer. If both used: reconcile MediaSession, rebuild APK if source mtime > APK.

## 5. Artifacts
- grok-job.md / claude-job.md / verify-after.md / latest.json / NEXT_ROLE / PRODUCT
"""
(out_dir / "director.md").write_text(director)

print("=== av-loop route ===")
print(f"VERDICT={verdict}")
print(f"PRODUCT={prod_status}")
print(f"DELTA={delta}")
print(f"NEXT_ROLE={role}")
print(f"REASON={reason}")
print(f"DONE WHEN={done_when}")
print(f"WIKI={wiki_hint}")
print(f"→ {out_dir / 'grok-job.md'}")
print(f"→ {out_dir / 'claude-job.md'}")
print(f"→ {out_dir / 'verify-after.md'}")
print(f"→ {out_dir / 'director.md'}")
print(f"→ {out_dir / 'latest.json'}")
PY

echo "av-verify_exit=$AV_RC"

if [[ "$CLAUDE_RUN" == "1" && -f "$OUT/claude-job.md" ]]; then
  ROLE=$(cat "$OUT/NEXT_ROLE")
  if [[ "$ROLE" == "client-ice" || "$ROLE" == "turn-media" ]]; then
    FILE=$(python3 -c "import json;print(json.load(open('$OUT/latest.json')).get('claude_file') or '')")
    if [[ -n "$FILE" && -x "$(command -v claude)" ]]; then
      echo "=== running claude -p (narrow) ==="
      set +e
      claude -p "$(cat "$OUT/claude-job.md")" \
        --print \
        --allowedTools "Read,Edit,Grep,Glob,Bash" \
        --add-dir "$ROOT" \
        2>&1 | tee "$OUT/claude-run.log"
      CLAUDE_RC=$?
      set -e
      echo "claude_exit=$CLAUDE_RC"
      echo "=== next: run verify-after (do not skip) ==="
      echo "Prompt: artifacts/av-loop/verify-after.md"
    else
      echo "skip claude-run: no primary file or claude CLI missing"
    fi
  else
    echo "skip claude-run: role=$ROLE is not an implementer"
  fi
fi

exit "$AV_RC"
