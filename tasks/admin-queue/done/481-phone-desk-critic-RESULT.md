# 481 — phone-desk + linking measure critic — RESULT

Status: DONE (read-only critic)

## 1. scripts/phone-desk.sh
- Exists at `/home/drakosik/freenet-roulette/scripts/phone-desk.sh` (main tree; not present in this worktree).
- `guard` subcommand (lines 72–78): `keyguard_on()` checks `dumpsys window` for `isKeyguardShowing=true|mDreamingLockscreen=true`; on true → `echo "phone-desk: BLOCKED keyguard ..." >&2; exit 2`. Confirmed exits 2 on keyguard.
- No APK install: no `install`/`pm install`/`adb install` anywhere in the script (header comment: "Does not install APK."). Subcommands are `status|stay|guard|dump|logcat` only — none install.

## 2. docs/MOBILE_BUILD.md mentions phone-desk
- **No.** Still a gap. Main-tree `docs/MOBILE_BUILD.md` has an uncommitted diff (` M docs/MOBILE_BUILD.md`) adding only a "Local emulator (optional)" section (`scripts/emu-ruletka.sh`) — no mention of `phone-desk`.
- `grep -in "phone.desk" docs/MOBILE_BUILD.md` → no match (both trees).
- Gap unchanged from prior critic pass: phone-desk.sh exists but is undocumented in MOBILE_BUILD.md.

## 3/4. av-verify linking measure
- `artifacts/av-verify/latest.md` header now reads `at: 2026-08-14T02:51:00Z` → file `20260814T025100Z.json`, mtime confirms. This **is newer** than the residual `20260812T193821Z` cited in the task — the measure moved since the last critic pass (which saw the file stuck at 193821Z).
- Quoted from `latest.md` / `latest.json`:
  - signaling: matches=1 offers=1 answers=1, **max_mto=1097ms**, **max_mta=2153ms** (signaling_ok=True)
  - TURN: alloc_ok=5 peer_hot=26 max_rb=519390 err_437=0 (media_pass=True)
  - **product**: status=`ok` done=`True`, web fin/fout=2827/3071, android fin/fout=3050/2827, fr_mismatch=`False`
  - Caveat: matches=1 → this is a **single sample**, not a real percentile. mto "p50" is therefore identical to the one observed value, 1097ms.
- Gate check against the task's bar (mto p50<800 **and** mta<2500 **and** product.ok):
  - mta 2153ms < 2500 → pass
  - product.ok → pass (status=ok, done=true)
  - **mto 1097ms ≥ 800ms → fail**
  - **Net: do NOT call linking GOAL_MET.** One of three gates (mto p50) is not met, even though product and mta pass. This is one sample, not a multi-pass confirmation — not calling MULTI_PASS either.

## 5. Device-smoke SKIP_INSTALL only
- No device-smoke process is running now (`ps aux` clean); the run that was in flight during the previous critic pass has since finished.
- `artifacts/phone-desk/device-smoke.out` (ts=20260814T024804Z): verdict=`MATCHED`, exit `OK`. No `device-smoke: install -r …` line present — consistent with `--skip-install`.
- No new APK: `mobile/artifacts/ruletka-latest.apk` mtime is 2026-08-12 13:44, unchanged since before this hop's device-smoke and av-verify runs. Confirms no new APK was pushed in this hop.

## Files touched
None (read-only critic). This RESULT file only.

## Verify commands run
- `ls -la scripts/phone-desk.sh artifacts/av-verify/ artifacts/av-verify/latest.md` (main tree)
- Read `scripts/phone-desk.sh`, `artifacts/av-verify/latest.md`
- `grep -n -i "phone-desk\|phonedesk" docs/MOBILE_BUILD.md` → no match
- `git diff docs/MOBILE_BUILD.md` (uncommitted emulator section only, no phone-desk mention)
- `python3` inspection of `artifacts/av-verify/latest.json` (`snapshot.max_mto_ms`, `snapshot.max_mta_ms`, `product`, `verdict`)
- `date -u -d @$(stat -c %Y artifacts/av-verify/latest.md) +%Y%m%dT%H%M%SZ` → `20260814T025100Z` vs residual `20260812T193821Z`
- `grep -n SKIP_INSTALL mobile/scripts/device-smoke.sh`
- `cat artifacts/phone-desk/device-smoke.out`
- `ps aux | grep -i "device-smoke\|phone-web-pair"` → none running
- `stat mobile/artifacts/ruletka-latest.apk` → unchanged mtime

## Connect risk
none

COMPLETE
