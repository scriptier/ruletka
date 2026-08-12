#!/usr/bin/env bash
# Device smoke: install latest APK on Pixel (preferred) → deep-link live+autostart
# → tap idle Start if needed → screencaps + logcat FATAL check.
#
# Usage:
#   ./scripts/device-smoke.sh                 # latest APK under artifacts/
#   ./scripts/device-smoke.sh PATH.apk        # explicit APK
#   WEB_PAIR=1 ./scripts/device-smoke.sh      # also spawn one headless web partner
#   WAIT_S=45 ./scripts/device-smoke.sh       # settle time after start (default 20)
#
# Env:
#   ANDROID_HOME          SDK root (default $HOME/Android/Sdk) — required with adb
#   PHONE_MODEL_PREFER    Prefer this model substring (default "Pixel 9 Pro")
#   WEB_PAIR=1            Start scripts/phone-web-pair.mjs in background if available
#   WAIT_S                Seconds to wait after start before final shot/logcat (default 20)
#   SKIP_INSTALL=1        Force-stop/start only (no adb install -r)
#
# Exit: 0 ok, 1 setup/install fail, 2 FATAL EXCEPTION in logcat, 3 crash UI,
#       4 MATCHED but "Looking…" label stuck (regression guard)
# Verdict: writes artifacts/device-smoke/last-verdict.txt, first line one of
#          MATCHED|SEARCHING|IDLE|UNKNOWN (see classify_state() below).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
ART="$ROOT/artifacts"
OUT="$ART/device-smoke"
PKG="${PKG:-me.ruletka.app}"
PHONE_MODEL_PREFER="${PHONE_MODEL_PREFER:-Pixel 9 Pro}"
WAIT_S="${WAIT_S:-20}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"
WEB_PAIR="${WEB_PAIR:-0}"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

mkdir -p "$OUT"

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \?//'
  exit "${1:-0}"
}

APK=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --web-pair) WEB_PAIR=1; shift ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    --) shift; break ;;
    -*)
      echo "Unknown option: $1" >&2
      usage 1
      ;;
    *)
      if [[ -n "$APK" ]]; then
        echo "Extra argument: $1" >&2
        usage 1
      fi
      APK="$1"
      shift
      ;;
  esac
done

# --- adb ---
adb_bin="${ANDROID_HOME}/platform-tools/adb"
if [[ ! -x "$adb_bin" ]]; then
  adb_bin="$(command -v adb 2>/dev/null || true)"
fi
if [[ -z "${adb_bin:-}" || ! -x "$adb_bin" ]]; then
  echo "device-smoke: FAIL — adb not found." >&2
  echo "  Set ANDROID_HOME (got: ${ANDROID_HOME}) so platform-tools/adb exists," >&2
  echo "  or put adb on PATH." >&2
  exit 1
fi
if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "device-smoke: WARN — ANDROID_HOME dir missing ($ANDROID_HOME); using adb at $adb_bin"
fi

adb() { "$adb_bin" "$@"; }

# --- resolve APK ---
if [[ -z "$APK" ]]; then
  if [[ -f "$ART/ruletka-latest.apk" ]]; then
    APK="$ART/ruletka-latest.apk"
  elif [[ -f "$ART/ruletka-android-latest.apk" ]]; then
    APK="$ART/ruletka-android-latest.apk"
  else
    APK="$(ls -t "$ART"/ruletka-0*.apk 2>/dev/null | head -n1 || true)"
  fi
fi
if [[ "$SKIP_INSTALL" != "1" ]]; then
  if [[ -z "${APK:-}" || ! -f "$APK" ]]; then
    echo "device-smoke: FAIL — no APK (pass path or build to $ART/ruletka-0*.apk)" >&2
    exit 1
  fi
fi

# --- pick device: prefer PHONE_MODEL_PREFER, then physical over emulator ---
mapfile -t serials < <(adb devices 2>/dev/null | awk 'NR>1 && $2=="device"{print $1}')
if [[ ${#serials[@]} -eq 0 ]]; then
  echo "device-smoke: FAIL — no adb device online (plug Pixel, USB debugging on)." >&2
  exit 1
fi

pick_serial=""
pick_model=""
# 1) exact prefer match
for s in "${serials[@]}"; do
  m="$(adb -s "$s" shell getprop ro.product.model 2>/dev/null | tr -d '\r')"
  if [[ "$m" == *"$PHONE_MODEL_PREFER"* ]]; then
    pick_serial="$s"
    pick_model="$m"
    break
  fi
done
# 2) any non-emulator physical
if [[ -z "$pick_serial" ]]; then
  for s in "${serials[@]}"; do
    if [[ "$s" == emulator-* ]]; then
      continue
    fi
    m="$(adb -s "$s" shell getprop ro.product.model 2>/dev/null | tr -d '\r')"
    # skip generic emulator models
    if [[ "$m" == sdk_gphone* || "$m" == *Emulator* ]]; then
      continue
    fi
    pick_serial="$s"
    pick_model="$m"
    echo "device-smoke: no '${PHONE_MODEL_PREFER}' — using physical: ${pick_model:-?} ($s)"
    break
  done
fi
# 3) first device (may be emulator)
if [[ -z "$pick_serial" ]]; then
  pick_serial="${serials[0]}"
  pick_model="$(adb -s "$pick_serial" shell getprop ro.product.model 2>/dev/null | tr -d '\r')"
  echo "device-smoke: WARN — using ${pick_model:-?} ($pick_serial) (prefer ${PHONE_MODEL_PREFER})"
else
  echo "device-smoke: device ${pick_model:-?} ($pick_serial)"
fi

S=(-s "$pick_serial")
TS="$(date -u +%Y%m%dT%H%M%SZ)"
echo "device-smoke: out=$OUT ts=$TS"
[[ -n "${APK:-}" ]] && echo "device-smoke: apk=$(basename "$APK") path=$APK"

# --- optional web partner (one Chromium tab) ---
WEB_PAIR_PID=""
cleanup() {
  if [[ -n "${WEB_PAIR_PID:-}" ]] && kill -0 "$WEB_PAIR_PID" 2>/dev/null; then
    echo "device-smoke: stopping web pair pid=$WEB_PAIR_PID"
    kill "$WEB_PAIR_PID" 2>/dev/null || true
    wait "$WEB_PAIR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ "$WEB_PAIR" == "1" ]]; then
  PAIR_JS="$REPO/scripts/phone-web-pair.mjs"
  if [[ -f "$PAIR_JS" ]] && command -v node >/dev/null 2>&1; then
    echo "device-smoke: starting web pair → $PAIR_JS"
    # BUDGET slightly longer than WAIT_S so partner stays up through settle
    BUDGET_MS=$(( (WAIT_S + 40) * 1000 )) \
      node "$PAIR_JS" >"$OUT/web-pair-${TS}.log" 2>&1 &
    WEB_PAIR_PID=$!
    sleep 2
    if ! kill -0 "$WEB_PAIR_PID" 2>/dev/null; then
      echo "device-smoke: WARN — web pair exited early (see $OUT/web-pair-${TS}.log)"
      WEB_PAIR_PID=""
    else
      echo "device-smoke: web pair pid=$WEB_PAIR_PID log=$OUT/web-pair-${TS}.log"
    fi
  else
    echo "device-smoke: WARN — WEB_PAIR=1 but phone-web-pair.mjs or node missing; skipping"
  fi
fi

# --- helpers ---
shot() {
  local name="$1"
  local remote="/sdcard/ruletka-smoke-${name}.png"
  local localp="$OUT/${TS}-${name}.png"
  adb "${S[@]}" shell screencap -p "$remote" 2>/dev/null || return 0
  adb "${S[@]}" pull "$remote" "$localp" >/dev/null 2>&1 || true
  adb "${S[@]}" shell rm -f "$remote" >/dev/null 2>&1 || true
  if [[ -f "$localp" ]]; then
    # also keep short alias for latest of this step
    cp -f "$localp" "$OUT/${name}.png" 2>/dev/null || true
    echo "  shot: $localp"
  else
    echo "  shot: FAIL $name" >&2
  fi
}

dump_ui() {
  local dest="$1"
  timeout 12 adb "${S[@]}" shell uiautomator dump /sdcard/device-smoke-ui.xml >/dev/null 2>&1 || true
  adb "${S[@]}" pull /sdcard/device-smoke-ui.xml "$dest" >/dev/null 2>&1 || true
}

alive_or_warn() {
  local label="$1"
  local pid
  pid="$(adb "${S[@]}" shell pidof "$PKG" 2>/dev/null | tr -d '\r' || true)"
  if [[ -z "$pid" ]]; then
    echo "device-smoke: CRASHED at $label (no pid)"
    return 1
  fi
  echo "device-smoke: ALIVE ($label) pid=$pid"
  return 0
}

# Classify a uiautomator dump as MATCHED|SEARCHING|IDLE|UNKNOWN.
# Signals (see mobile/src/live/LiveBottomBar.tsx + app/live.tsx uiPhase):
#   MATCHED   — live-report-btn only renders when barPhase==="matched"
#               (Stop+Report+Next together), OR the native Gifts panel
#               ("Gifts" title, matched-only), OR a rendered call timer
#               "m:ss" (starts counting from matchStartedAt).
#   SEARCHING — live-stop-btn/live-next-btn without live-report-btn, or
#               the "Looking…" search label (mobile.live.looking).
#   IDLE      — live-start-btn visible.
# Sets classify_verdict + classify_signals globals (avoids subshell cost).
classify_verdict=""
classify_signals=""
classify_state() {
  local xml="$1"
  classify_verdict="UNKNOWN"
  classify_signals="no-dump"
  if [[ ! -s "$xml" ]]; then
    return 0
  fi
  local has_start=0 has_stop=0 has_next=0 has_report=0 has_gifts=0 has_timer=0 has_looking=0
  grep -qE 'resource-id="live-start-btn"' "$xml" 2>/dev/null && has_start=1
  grep -qE 'resource-id="live-stop-btn"' "$xml" 2>/dev/null && has_stop=1
  grep -qE 'resource-id="live-next-btn"' "$xml" 2>/dev/null && has_next=1
  grep -qE 'resource-id="live-report-btn"' "$xml" 2>/dev/null && has_report=1
  grep -qE 'text="Gifts"|content-desc="Gifts"' "$xml" 2>/dev/null && has_gifts=1
  grep -qE 'text="[0-9]{1,2}:[0-9]{2}"' "$xml" 2>/dev/null && has_timer=1
  grep -qE 'text="Looking' "$xml" 2>/dev/null && has_looking=1

  local sig=""
  [[ $has_start -eq 1 ]] && sig="${sig}start,"
  [[ $has_stop -eq 1 ]] && sig="${sig}stop,"
  [[ $has_next -eq 1 ]] && sig="${sig}next,"
  [[ $has_report -eq 1 ]] && sig="${sig}report,"
  [[ $has_gifts -eq 1 ]] && sig="${sig}gifts,"
  [[ $has_timer -eq 1 ]] && sig="${sig}timer,"
  [[ $has_looking -eq 1 ]] && sig="${sig}looking,"
  classify_signals="${sig%,}"
  [[ -z "$classify_signals" ]] && classify_signals="none"

  if [[ $has_report -eq 1 || $has_gifts -eq 1 || $has_timer -eq 1 ]]; then
    classify_verdict="MATCHED"
  elif [[ $has_stop -eq 1 || $has_next -eq 1 || $has_looking -eq 1 ]]; then
    classify_verdict="SEARCHING"
  elif [[ $has_start -eq 1 ]]; then
    classify_verdict="IDLE"
  fi
}

# Tap first matching content-desc or text "Start" (prefer live-start-btn / bottom Start)
tap_start_if_idle() {
  local xml="$OUT/${TS}-ui-pre-start.xml"
  dump_ui "$xml"
  if [[ ! -f "$xml" ]]; then
    echo "  uiautomator dump missing — skip Start tap"
    return 0
  fi
  # Only act when idle Start is visible (not already Next/Stop/Searching)
  if ! grep -qE 'content-desc="Start"|text="Start"|resource-id="live-start-btn"' "$xml" 2>/dev/null; then
    echo "  no idle Start in UI (already searching/matched?)"
    return 0
  fi
  if grep -qE 'content-desc="Next"|content-desc="Stop"|text="Looking|Searching' "$xml" 2>/dev/null; then
    # Start may still appear as last-chat card; prefer live-start-btn
    :
  fi
  python3 - "$xml" <<'PY'
import re, subprocess, sys
from pathlib import Path
xml_path = Path(sys.argv[1])
text = xml_path.read_text(errors="ignore") if xml_path.exists() else ""

def bounds_center(m):
    x = (int(m.group(1)) + int(m.group(3))) // 2
    y = (int(m.group(2)) + int(m.group(4))) // 2
    return x, y

# Prefer the live-start-btn resource-id
patterns = [
    r'resource-id="live-start-btn"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
    r'content-desc="Start"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
    r'text="Start"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
    # attributes may be ordered differently
    r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*resource-id="live-start-btn"',
    r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*content-desc="Start"',
]
serial = None
import os
# parent exports via env for adb -s
serial = os.environ.get("DEVICE_SMOKE_SERIAL", "")
adb = os.environ.get("DEVICE_SMOKE_ADB", "adb")

for pat in patterns:
    ms = list(re.finditer(pat, text))
    if not ms:
        continue
    # Prefer lower-on-screen Start (live bar) over last-chat card
    best = None
    best_y = -1
    for m in ms:
        x, y = bounds_center(m)
        if y > best_y:
            best_y = y
            best = (x, y)
    if best:
        x, y = best
        print(f"  tap Start @ {x},{y}")
        cmd = [adb]
        if serial:
            cmd += ["-s", serial]
        cmd += ["shell", "input", "tap", str(x), str(y)]
        subprocess.run(cmd, check=False)
        raise SystemExit(0)
print("  Start visible in dump but no bounds parsed")
raise SystemExit(1)
PY
}

pass_onboarding_light() {
  # grant media; dismiss age/got-it if present (best-effort)
  adb "${S[@]}" shell pm grant "$PKG" android.permission.CAMERA 2>/dev/null || true
  adb "${S[@]}" shell pm grant "$PKG" android.permission.RECORD_AUDIO 2>/dev/null || true
  local xml="$OUT/${TS}-ui-onboard.xml"
  for _ in $(seq 1 8); do
    dump_ui "$xml"
    [[ -f "$xml" ]] || break
    if grep -qE 'Something went wrong|useHub outside' "$xml" 2>/dev/null; then
      echo "device-smoke: FAIL crash UI during onboarding" >&2
      shot "crash-onboard"
      exit 3
    fi
    if grep -q "Yes, I'm 18 or older" "$xml" 2>/dev/null; then
      python3 - "$xml" <<'PY'
import re, subprocess, sys, os
from pathlib import Path
text = Path(sys.argv[1]).read_text(errors="ignore")
m = re.search(r'text="Yes, I.m 18 or older"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', text)
if not m:
    m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="Yes, I.m 18 or older"', text)
adb = os.environ.get("DEVICE_SMOKE_ADB", "adb")
serial = os.environ.get("DEVICE_SMOKE_SERIAL", "")
cmd = [adb] + (["-s", serial] if serial else []) + ["shell", "input", "tap"]
if m:
    x = (int(m.group(1))+int(m.group(3)))//2
    y = (int(m.group(2))+int(m.group(4)))//2
    subprocess.run(cmd + [str(x), str(y)], check=False)
else:
    subprocess.run(cmd + ["540", "1688"], check=False)
PY
      sleep 1.2
      continue
    fi
    if grep -qE 'content-desc="Got it"|text="Got it"' "$xml" 2>/dev/null; then
      python3 - "$xml" <<'PY'
import re, subprocess, sys, os
from pathlib import Path
text = Path(sys.argv[1]).read_text(errors="ignore")
m = re.search(r'content-desc="Got it"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', text)
if not m:
    m = re.search(r'text="Got it"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', text)
if m:
    x = (int(m.group(1))+int(m.group(3)))//2
    y = (int(m.group(2))+int(m.group(4)))//2
    adb = os.environ.get("DEVICE_SMOKE_ADB", "adb")
    serial = os.environ.get("DEVICE_SMOKE_SERIAL", "")
    cmd = [adb] + (["-s", serial] if serial else []) + ["shell", "input", "tap", str(x), str(y)]
    subprocess.run(cmd, check=False)
PY
      sleep 0.6
      continue
    fi
    if grep -qE 'content-desc="Start"|Start chatting|live-start-btn|Your camera' "$xml" 2>/dev/null; then
      return 0
    fi
    sleep 0.6
  done
}

export DEVICE_SMOKE_SERIAL="$pick_serial"
export DEVICE_SMOKE_ADB="$adb_bin"

# --- install ---
if [[ "$SKIP_INSTALL" != "1" ]]; then
  echo "device-smoke: install -r …"
  if ! adb "${S[@]}" install -r "$APK"; then
    echo "device-smoke: FAIL install (signature mismatch? uninstall old first)" >&2
    exit 1
  fi
fi

# clear logcat for FATAL window
adb "${S[@]}" logcat -c 2>/dev/null || true

echo "device-smoke: force-stop $PKG"
adb "${S[@]}" shell am force-stop "$PKG" 2>/dev/null || true
sleep 0.5

echo "device-smoke: start ruletka://live?autostart=1"
adb "${S[@]}" shell am start -a android.intent.action.VIEW \
  -d "ruletka://live?autostart=1" "$PKG" >/dev/null 2>&1 || \
adb "${S[@]}" shell am start -a android.intent.action.VIEW \
  -d "ruletka:///live?autostart=1" "$PKG" >/dev/null 2>&1 || true
sleep 3

pass_onboarding_light
alive_or_warn "post-deeplink" || true
shot "01-after-deeplink"
dump_ui "$OUT/${TS}-ui-after-deeplink.xml"
cp -f "$OUT/${TS}-ui-after-deeplink.xml" "$OUT/ui-after-deeplink.xml" 2>/dev/null || true

# If still idle Start, tap it
echo "device-smoke: check idle Start → tap if needed"
tap_start_if_idle || true
sleep 2
shot "02-after-start"
dump_ui "$OUT/${TS}-ui-after-start.xml"
cp -f "$OUT/${TS}-ui-after-start.xml" "$OUT/ui-after-start.xml" 2>/dev/null || true

echo "device-smoke: wait ${WAIT_S}s for match settle…"
sleep "$WAIT_S"
shot "03-final"
dump_ui "$OUT/${TS}-ui-final.xml"
cp -f "$OUT/${TS}-ui-final.xml" "$OUT/ui-final.xml" 2>/dev/null || true
alive_or_warn "final" || true

# --- logcat snippet ---
SNIP="$OUT/logcat-snippet.txt"
{
  echo "# device-smoke logcat filter @ $TS serial=$pick_serial model=$pick_model"
  echo "# apk=${APK:-skip-install}"
  echo "# grep: FATAL|ReactNative|AndroidRuntime"
  adb "${S[@]}" logcat -d 2>/dev/null | grep -E 'FATAL|ReactNative|AndroidRuntime' || true
} >"$SNIP"
# also timestamped copy
cp -f "$SNIP" "$OUT/logcat-snippet-${TS}.txt" 2>/dev/null || true
echo "device-smoke: logcat → $SNIP"

FATAL=0
if grep -q 'FATAL EXCEPTION' "$SNIP" 2>/dev/null; then
  FATAL=1
  echo "device-smoke: FAIL — FATAL EXCEPTION in logcat" >&2
  grep -A3 'FATAL EXCEPTION' "$SNIP" | head -40 >&2 || true
fi

# --- classify matched/searching/idle state (final dump, fall back to after-start) ---
CLASSIFY_XML="$OUT/${TS}-ui-final.xml"
[[ -s "$CLASSIFY_XML" ]] || CLASSIFY_XML="$OUT/${TS}-ui-after-start.xml"
classify_state "$CLASSIFY_XML"
VERDICT="$classify_verdict"

# Still IDLE after the main wait — autostart's own retries may have raced
# app boot. Give it one more tap + settle window before calling it a fail.
if [[ "$VERDICT" == "IDLE" ]]; then
  echo "device-smoke: verdict=IDLE — tap Start once more, wait 8s, reclassify"
  tap_start_if_idle || true
  sleep 8
  shot "04-idle-retry"
  dump_ui "$OUT/${TS}-ui-idle-retry.xml"
  cp -f "$OUT/${TS}-ui-idle-retry.xml" "$OUT/ui-idle-retry.xml" 2>/dev/null || true
  CLASSIFY_XML="$OUT/${TS}-ui-idle-retry.xml"
  classify_state "$CLASSIFY_XML"
  VERDICT="$classify_verdict"
fi
{
  echo "$VERDICT"
  echo "ts=$TS"
  echo "signals=$classify_signals"
  echo "device=${pick_model:-?} ($pick_serial)"
  echo "xml=$CLASSIFY_XML"
} >"$OUT/last-verdict.txt"
echo "device-smoke: verdict=$VERDICT signals=$classify_signals → $OUT/last-verdict.txt"

# crash UI check
if [[ -f "$OUT/${TS}-ui-final.xml" ]] && grep -qE 'Something went wrong|useHub outside' "$OUT/${TS}-ui-final.xml" 2>/dev/null; then
  echo "device-smoke: FAIL — crash UI in final dump" >&2
  exit 3
fi

# version line
adb "${S[@]}" shell dumpsys package "$PKG" 2>/dev/null | grep -E 'versionName|versionCode' | head -3 || true

echo "device-smoke: artifacts under $OUT/"
ls -1t "$OUT"/${TS}-* "$OUT"/logcat-snippet.txt 2>/dev/null | head -20 || true

if [[ "$FATAL" -eq 1 ]]; then
  exit 2
fi

# soft: process must still be alive
if ! alive_or_warn "exit-check"; then
  exit 2
fi

# regression guard: matched but the search "Looking…" label is still stuck
# on screen (uiPhase==="matched" should hide LiveSearchLabel — see live.tsx)
if [[ "$VERDICT" == "MATCHED" && "$classify_signals" == *looking* ]]; then
  echo "device-smoke: FAIL — MATCHED but 'Looking…' label stuck (regression)" >&2
  exit 4
fi

echo "device-smoke: OK (verdict=$VERDICT)"
exit 0
