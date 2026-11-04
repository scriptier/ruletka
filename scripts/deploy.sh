#!/usr/bin/env bash
# One-step Ruletka deploy (ruletka.vip + ruletka.me on one droplet).
#
#   scripts/deploy.sh --dry-run [--bridge PATH]   # plan + read-only checks, touches nothing on prod
#   scripts/deploy.sh --bridge PATH               # real deploy with a prebuilt bridge
#   scripts/deploy.sh                             # real deploy, builds the bridge here (only if the
#                                                 # result links against glibc<=2.39 / OpenSSL 3.0)
#
# Order: refuse dirty tree -> preflight (ssh, disk, binary ABI) -> stage UI
# (vendor-nsfw/face/genital + prod ui/download minus android.html) -> backup
# /opt/ruletka + Caddyfile + turnserver.conf + units -> HUB FIRST (bridge
# swap + restart + /health) -> web (ui rsync, no --delete) -> deploy/ ->
# caddy validate -> reload -> smoke (sites, /live.html, /health, APK, vendor,
# TURN Allocate) -> tag deployed-YYYY-MM-DD (local) + log.
# Any failure after the first prod change rolls back from the backup.
#
# The prod bridge must link against Ubuntu 24.04 (glibc 2.39, OpenSSL 3.0.x).
# Build it on the Grok box (Ubuntu noble libssl-dev 3.0.13), not on omarchy
# (Arch: newer glibc/OpenSSL -> binary will not start on the server).
#
# Env: HOST (root@209.38.204.153)  SSH_KEY (~/.ssh/ruletka_ed25519)
#      LOG_DIR (~/rustore-ru-work)  DOMAINS ("ruletka.vip ruletka.me")
set -euo pipefail

DRY=0; BRIDGE=""; SKIP_VENDOR=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --bridge) BRIDGE="${2:?--bridge needs a path}"; shift ;;
    --skip-vendor) SKIP_VENDOR=1 ;;   # dry-run convenience only
    -h|--help) sed -n '2,23p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done
[[ $SKIP_VENDOR == 1 && $DRY == 0 ]] && { echo "--skip-vendor is only allowed with --dry-run" >&2; exit 2; }

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT"
HOST="${HOST:-root@209.38.204.153}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
LOG_DIR="${LOG_DIR:-$HOME/rustore-ru-work}"
DOMAINS="${DOMAINS:-ruletka.vip ruletka.me}"
APP=/opt/ruletka
TS="$(date -u +%Y%m%dT%H%M%SZ)"
DAY="$(date +%Y-%m-%d)"
SSH_OPTS=(-i "$SSH_KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

mkdir -p "$LOG_DIR"
if [[ $DRY == 1 ]]; then LOG="$LOG_DIR/deploy-dryrun-$TS.log"; else LOG="$LOG_DIR/deploy-$(date +%Y%m%d)-$TS.log"; fi
exec > >(tee -a "$LOG") 2>&1

say()  { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
die()  { say "ABORT: $*"; exit 1; }
ro()   { ssh "${SSH_OPTS[@]}" "$HOST" "$@"; }          # read-only remote command (runs in dry-run too)
rw()   {                                              # remote command that changes prod
  if [[ $DRY == 1 ]]; then say "[dry-run] would run on $HOST: $*"; return 0; fi
  ssh "${SSH_OPTS[@]}" "$HOST" "$@"
}
rsync_up() {                                          # rsync_up <args...> (to prod)
  if [[ $DRY == 1 ]]; then
    say "[dry-run] would rsync $* (preview below, -n)"
    rsync -azn --stats -e "$RSYNC_SSH" "$@" | grep -E 'Number of (regular )?files transferred|Total transferred file size|deleting' | sed 's/^/    /' || true
    return 0
  fi
  rsync -az -e "$RSYNC_SSH" "$@"
}

say "== Ruletka deploy $( [[ $DRY == 1 ]] && echo DRY-RUN ) $TS =="
say "log: $LOG"

# ---------- 1. clean tree ----------
if [[ -n "$(git status --porcelain)" ]]; then
  git status --short | head -20
  die "working tree is dirty; commit or stash first (deploys must match a commit)"
fi
SHA="$(git rev-parse --short HEAD)"; BRANCH="$(git rev-parse --abbrev-ref HEAD)"
say "commit $SHA ($BRANCH): $(git log -1 --format=%s)"
DEPLOY_V="$TS-$SHA"

# ---------- 2. preflight ----------
ro 'echo ssh_ok' >/dev/null || die "ssh to $HOST failed (key $SSH_KEY)"
say "server: $(ro '. /etc/os-release; echo "$PRETTY_NAME"; openssl version | cut -d" " -f1-2; caddy version | cut -d" " -f1' | paste -sd' ')"
say "services: $(ro 'for u in roulette-bridge caddy coturn; do printf "%s=%s " $u $(systemctl is-active $u); done')"
LIVE_V="$(ro "cat $APP/ui/deploy.json 2>/dev/null" || true)"; say "live deploy.json: ${LIVE_V:-none}"
FREE_KB="$(ro "df -Pk $APP | awk 'NR==2{print \$4}'")"
BK_KB="$(ro "du -sk --exclude=$APP/backups --exclude=$APP/ui/download/archive $APP | cut -f1")"
say "prod free: $((FREE_KB/1024)) MB; backup needs ~$((BK_KB/1024)) MB (/opt/ruletka without backups/ and download/archive/)"
(( FREE_KB > BK_KB * 2 + 1048576 )) || die "not enough free disk on prod for a backup"

need_glibc=2.39; need_ssl=3.0.0
check_abi() {  # check_abi <binary>
  local b="$1" g s
  file "$b" | grep -q 'ELF 64-bit.*x86-64' || die "$b is not an x86-64 ELF"
  g="$(objdump -T "$b" | grep -o 'GLIBC_[0-9.]*' | sed 's/GLIBC_//' | sort -Vu | tail -1)"
  s="$(objdump -T "$b" | grep -o 'OPENSSL_[0-9.]*' | sed 's/OPENSSL_//' | sort -Vu | tail -1)"
  say "bridge ABI: max GLIBC_$g, max OPENSSL_${s:-none}"
  [[ "$(printf '%s\n%s\n' "$g" "$need_glibc" | sort -V | tail -1)" == "$need_glibc" ]] || die "needs GLIBC_$g > $need_glibc (server is Ubuntu 24.04). Build on the Grok box and pass --bridge."
  [[ -z "$s" || "$(printf '%s\n%s\n' "$s" "$need_ssl" | sort -V | tail -1)" == "$need_ssl" ]] || die "needs OPENSSL_$s > $need_ssl (server has OpenSSL 3.0.13). Build on the Grok box and pass --bridge."
}
if [[ -n "$BRIDGE" ]]; then
  [[ -x "$BRIDGE" ]] || die "--bridge $BRIDGE is not an executable file"
  say "bridge: $BRIDGE (provided; not built from $SHA here, check it matches)"
elif [[ $DRY == 1 ]]; then
  say "[dry-run] would: cargo build -p freenet-roulette-bridge --release, then ABI check"
else
  source "$HOME/.cargo/env" 2>/dev/null || true
  cargo build -p freenet-roulette-bridge --release
  BRIDGE="$ROOT/target/release/roulette-bridge"
fi
if [[ -n "$BRIDGE" ]]; then
  check_abi "$BRIDGE"
  say "bridge sha256 $(sha256sum "$BRIDGE" | cut -c1-64)"
fi

# ---------- 3. stage (local only) ----------
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/ruletka-deploy-$TS.XXXX")"
trap 'rm -rf "$STAGE"' EXIT
if [[ $SKIP_VENDOR == 1 ]]; then
  say "[dry-run] skipping vendor-nsfw/face/genital fetch (--skip-vendor)"
else
  for v in nsfw face genital; do
    say "vendor-$v"; bash "$ROOT/scripts/vendor-$v.sh" >/dev/null || die "vendor-$v.sh failed"
  done
  [[ -z "$(git status --porcelain)" ]] || die "vendor scripts dirtied the tree (should be gitignored)"
fi
mkdir -p "$STAGE"/{bin,ui,deploy}
rsync -a --exclude '*.map' --exclude 'brand/loading-screen.full.mp4' --exclude 'brand/og-1200.prev.jpg' \
  --exclude 'download/archive/' ui/ "$STAGE/ui/"
printf '{"v":"%s","at":"%s"}\n' "$DEPLOY_V" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$STAGE/ui/deploy.json"
[[ -f scripts/deploy/optimize-ui.sh ]] && bash scripts/deploy/optimize-ui.sh "$STAGE/ui" >/dev/null
# prod ui/download (APKs, helpers, SHA256SUMS) comes from prod; only android.html comes from git
say "pull prod ui/download (excl. android.html, archive/)"
if [[ $DRY == 1 ]]; then   # dry-run: skip the big APKs, just prove they are there
  rsync -a -e "$RSYNC_SSH" --exclude 'android.html' --exclude 'archive/' --exclude '*.apk' "$HOST:$APP/ui/download/" "$STAGE/ui/download/"
  say "  prod APKs: $(ro "cd $APP/ui/download && ls -1 *.apk | paste -sd' '")"
  ro "test -s $APP/ui/download/ruletka-android-latest.apk" || die "prod has no ruletka-android-latest.apk"
else
  rsync -a -e "$RSYNC_SSH" --exclude 'android.html' --exclude 'archive/' "$HOST:$APP/ui/download/" "$STAGE/ui/download/"
  [[ -s "$STAGE/ui/download/ruletka-android-latest.apk" ]] || die "staged download/ has no ruletka-android-latest.apk"
fi
cp -a ui/download/android.html "$STAGE/ui/download/android.html"
for f in Caddyfile roulette-bridge.service install-on-server.sh coturn.conf setup-turn.sh setup-turns-tls.sh \
         ruletka-turns-certs.service ruletka-turns-certs.timer backup-ruletka-data.sh; do
  cp -a "scripts/deploy/$f" "$STAGE/deploy/"
done
[[ -n "$BRIDGE" ]] && install -m 755 "$BRIDGE" "$STAGE/bin/roulette-bridge.new"
PIN_LIVE="$(grep -o 'live\.js?v=[0-9]*' "$STAGE/ui/live.html" | head -1)"
say "staged $(du -sh "$STAGE/ui" | cut -f1) ui, deploy.json $DEPLOY_V, $PIN_LIVE"
for vf in vendor/nsfw vendor/face vendor/genital; do
  [[ -d "$STAGE/ui/$vf" ]] && say "  ui/$vf: $(find "$STAGE/ui/$vf" -type f | wc -l) files" || say "  ui/$vf: MISSING"
done

# ---------- 4. backup ----------
BK="$APP/backups/predeploy-$TS"
say "backup -> $BK (+ /etc/caddy/Caddyfile, /etc/turnserver.conf, units)"
rw "set -e; mkdir -p $BK/etc
  rsync -aH --exclude backups/ --exclude ui/download/archive/ $APP/ $BK/
  cp -a /etc/caddy/Caddyfile $BK/etc/Caddyfile
  cp -a /etc/turnserver.conf $BK/etc/turnserver.conf 2>/dev/null || true
  cp -a /etc/systemd/system/roulette-bridge.service /etc/systemd/system/ruletka-turns-certs.* $BK/etc/ 2>/dev/null || true
  du -sh $BK | cut -f1"

MUTATED=0
rollback() {
  local rc=$?
  [[ $MUTATED == 1 && $DRY == 0 ]] || exit $rc
  MUTATED=0
  say "!! failure (rc=$rc) -> ROLLBACK from $BK"
  ssh "${SSH_OPTS[@]}" "$HOST" "set -x
    cp -a $BK/bin/roulette-bridge $APP/bin/roulette-bridge
    rsync -a --delete --exclude download/archive/ $BK/ui/ $APP/ui/
    rsync -a --delete $BK/deploy/ $APP/deploy/
    cp -a $BK/etc/Caddyfile /etc/caddy/Caddyfile
    systemctl restart roulette-bridge; sleep 2; systemctl reload caddy
    curl -fsS http://127.0.0.1:8790/health | head -c 300; echo" || say "!! rollback itself failed - fix by hand from $BK"
  say "rolled back; prod should be back on: ${LIVE_V:-?}"
  exit $rc
}
trap 'rollback' ERR

# ---------- 5. hub first ----------
if [[ -n "$BRIDGE" || $DRY == 1 ]]; then
  say "hub: upload bridge, --help smoke on server, swap, restart"
  [[ -n "$BRIDGE" ]] && rsync_up --chown=ruletka:ruletka "$STAGE/bin/roulette-bridge.new" "$HOST:$APP/bin/roulette-bridge.new"
  MUTATED=1
  rw "set -e; cd $APP/bin; ./roulette-bridge.new --help >/dev/null; mv -f roulette-bridge.new roulette-bridge; systemctl restart roulette-bridge; sleep 3; systemctl is-active roulette-bridge; curl -fsS http://127.0.0.1:8790/health >/dev/null && echo health_ok"
fi

# ---------- 6. web ----------
say "web: ui/ (no --delete; keeps server-only files), deploy/"
MUTATED=1
rsync_up --chown=ruletka:ruletka "$STAGE/ui/" "$HOST:$APP/ui/"
rsync_up --delete "$STAGE/deploy/" "$HOST:$APP/deploy/"

# ---------- 7. caddy ----------
if ro "cmp -s $APP/deploy/Caddyfile /etc/caddy/Caddyfile" 2>/dev/null && [[ $DRY == 0 ]]; then
  say "caddy: Caddyfile unchanged, no reload"
else
  if [[ $DRY == 1 ]]; then
    say "caddy: diff live /etc/caddy/Caddyfile vs repo (read-only):"
    ro "cat /etc/caddy/Caddyfile" | diff -u - scripts/deploy/Caddyfile | sed 's/^/    /' | head -40 || true
    say "caddy validate of the repo Caddyfile (read-only, on server):"
    ssh "${SSH_OPTS[@]}" "$HOST" 't=$(mktemp); cat >"$t"; caddy validate --config "$t" --adapter caddyfile 2>&1 | tail -1; rm -f "$t"' <scripts/deploy/Caddyfile | sed 's/^/    /'
  fi
  rw "set -e; caddy validate --config $APP/deploy/Caddyfile --adapter caddyfile; install -m 644 $APP/deploy/Caddyfile /etc/caddy/Caddyfile; systemctl reload caddy"
fi

# ---------- 8. smoke ----------
say "smoke"
fails=0
chk() {  # chk <url> <expect-code> [min-bytes]
  local out code size
  out="$(curl -sS -o /dev/null -w '%{http_code} %{size_download}' --max-time 60 "$1" 2>&1)" || true
  code="${out%% *}"; size="${out##* }"
  if [[ "$code" == "$2" && ( -z "${3:-}" || "$size" -ge "${3:-0}" ) ]]; then say "  ok   $code $1 ${3:+($size B)}"
  else say "  FAIL $out $1"; fails=$((fails+1)); fi
}
for d in $DOMAINS; do
  for p in / /live.html /home.html /safety.html /config.json /health; do chk "https://$d$p" 200; done
  chk "https://$d/download/ruletka-android-latest.apk" 200 10000000
  chk "https://$d/vendor/genital/ort-1.22.0/ort.wasm.min.js" 200
done
served_v="$(curl -fsS --max-time 20 "https://${DOMAINS%% *}/deploy.json" || true)"
say "  served deploy.json: $served_v"
if [[ $DRY == 0 ]]; then
  [[ "$served_v" == *"$DEPLOY_V"* ]] || { say "  FAIL deploy.json is not $DEPLOY_V"; fails=$((fails+1)); }
  curl -fsS --max-time 20 "https://${DOMAINS%% *}/live.html" | grep -q "$PIN_LIVE" || { say "  FAIL live.html does not pin $PIN_LIVE"; fails=$((fails+1)); }
fi
say "  TURN allocate:"
python3 "$ROOT/scripts/deploy/turn-alloc-test.py" "https://${DOMAINS%% *}/config.json" | sed 's/^/    /' || fails=$((fails+1))
if (( fails > 0 )); then
  if [[ $DRY == 1 ]]; then say "dry-run: $fails smoke check(s) fail against CURRENT prod"; else false; fi
fi
trap - ERR
MUTATED=0

# ---------- 9. tag + log ----------
TAG="deployed-$DAY"; n=2
while git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; do
  [[ "$(git rev-parse "$TAG^{commit}")" == "$(git rev-parse HEAD)" ]] && break
  TAG="deployed-$DAY.$n"; n=$((n+1))
done
if [[ $DRY == 1 ]]; then
  say "[dry-run] would tag $TAG -> $SHA (local; push later with: git push origin $TAG)"
  say "== DRY-RUN done: nothing on prod was changed =="
else
  git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || git tag "$TAG" HEAD
  say "tagged $TAG -> $SHA (local only; push with: git push origin $TAG)"
  say "rollback by hand if needed: backup $BK"
  say "== DEPLOYED $DEPLOY_V =="
fi
