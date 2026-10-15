# BLUR-F60 multi SoftBlur unlock-gate + device retry — RESULT

## Status
**BLOCKED COMPLETE (keyguard)** — Multi SoftBlur **device NOT claimed**.  
Unlock-gate failed: phone still on keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · AlternateBouncer / fingerprint).  
**Did not** thrash PIN/locksettings. **Did not** invent multi SoftBlur PASS.  
No Settings→Hold, no multi pair, no softNative/Sink evidence this hop.

Independent stamps this hop (all **BLOCKED**):
1. **20260812T124549Z** — prior sample dumpsys + multipoll + package + UI (keyguard true)
2. **20260812T124555Z / 124558Z / 124600Z** — samples 1–3 unlock-gate (still true)
3. **20260812T124606Z** — unlock-gate + screenshot
4. **20260812T124706Z** — primary worker multipoll (3× true) + dumpsys + package full + trust + power
5. **20260812T124711Z / 124714Z / 124716Z** — samples 1–3 screenshots + unlock-gate reconfirm
6. **20260812T124719Z** — gate-final + UI bouncer dump + final screenshot

## Gate (required before multi SoftBlur)

| Check | Result |
|-------|--------|
| Device adb exclusive | **PASS** — `-s 192.168.1.94:43343` only |
| Package tip | **PASS** — **0.1.374** / **vc382** (`lastUpdateTime=2026-08-12 00:34:14`) ≥ 0.1.374+ |
| Unlock gate `isKeyguardShowing` | **true** → **BLOCK** (all samples + multipoll + final) |
| Unlock gate `mDreamingLockscreen` | **true** → **BLOCK** (all samples + multipoll + final) |
| Focus | `AlternateBouncerView` (systemui) · app record `me.ruletka.app/.MainActivity` under keyguard |
| Trust | `trustState=UNTRUSTED` · `deviceLocked=1` |
| Power | `mWakefulness=Awake` · `mHoldingDisplaySuspendBlocker=true` (screen on) |
| Hold setup (`prefs_load mode=hold`) | **NOT attempted** (gate stop) |
| Multi SoftBlur device (`peers≥2` + softNative + Sink) | **NOT claimed** |
| Product code edits / APK / force-push / pool | **none** · pool=0 |

## Verdict table (honest — no invent)

| Signal | Value this hop | Notes |
|--------|----------------|-------|
| peers (phone log) | **n/a · 0 evidence** | multi not started (keyguard gate) |
| multiRemote | **false / not observed** | — |
| softNative=1 | **0** | not exercised |
| SoftBlurVideoView Sink attached | **0** | not exercised |
| Hold / prefs_load mode=hold | **not confirmed this hop** | Settings UI unreachable |
| Scaffold multi-pair | **not run** | gate stop before multi |
| multi SoftBlur device | **BLOCKED** | **not PASS** |
| SCAFFOLD_DONE ≠ MULTI_PASS | **honored** | no scaffold invent |

**PASS candidate criteria (from card):** peers≥2 + softNative=1 + ≥N Sink (+ Hold).  
**None met.** Explicit: **no multi SoftBlur PASS** / **no MULTI_PASS**.

## Non-claims table (explicit)

| Claim | This hop |
|-------|----------|
| multi SoftBlur device PASS | **NOT claimed** |
| MULTI_PASS | **NOT claimed** |
| peers≥2 on phone | **NOT observed** |
| softNative=1 mid-multi | **NOT observed** |
| SoftBlurVideoView Sink attached | **NOT observed** |
| prefs_load mode=hold this hop | **NOT confirmed** |
| Settings Hold chip UI | **NOT reached** (keyguard) |
| SCAFFOLD_DONE as multi product PASS | **NOT used** (scaffold not run) |
| Unlock via agent / locksettings | **NOT attempted** |

## OWN
- Phone exclusive wireless adb: **`192.168.1.94:43343`**
- Partner helpers (`multi-pair.mjs` / `phone-web-pair.mjs`): **not used** (gate blocked)
- Artifacts: `mobile/artifacts/device-smoke/f60-blur/`
- RESULT: this file; card `running/BLUR-F60-multi-soft-unlock-retry.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
firstInstallTime=2026-08-10 14:37:44
Pixel 9 Pro (caiman) · wireless adb 192.168.1.94:43343
build=CP2A.260705.006
```
Evidence:
- `mobile/artifacts/device-smoke/f60-blur/package-detail-20260812T124706Z.txt`
- `mobile/artifacts/device-smoke/f60-blur/package-version-20260812T124706Z.txt`
- `mobile/artifacts/device-smoke/f60-blur/package.txt`
- `mobile/artifacts/device-smoke/f60-blur/package-full-20260812T124706Z.txt`
- `mobile/artifacts/device-smoke/f60-blur/package-detail-20260812T124549Z.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:5
```
Evidence:
- `mobile/artifacts/device-smoke/f60-blur/adb-devices-20260812T124706Z.txt`
- `mobile/artifacts/device-smoke/f60-blur/adb-devices-20260812T124549Z.txt`
- `mobile/artifacts/device-smoke/f60-blur/devices-l.txt`  
No dual-adb thrash. Port **43343** exclusive.

## Keyguard evidence (gate FAIL → stop)

### Multipoll primary — 20260812T124706Z
```
=== multipoll ts_utc=20260812T124706Z serial=192.168.1.94:43343 ===
=== poll 1 12:47:06Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 2 12:47:07Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 3 12:47:08Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence: `keyguard-multipoll-20260812T124706Z.txt` · `keyguard-dumpsys-20260812T124706Z.txt`

### Samples 1–3 — 20260812T124711Z / 124714Z / 124716Z
```
sample=1 ts_utc=20260812T124711Z
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
    mCurrentFocus=AlternateBouncerView
sample=2 ts_utc=20260812T124714Z
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
sample=3 ts_utc=20260812T124716Z
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence:
- `unlock-gate-sample1-20260812T124711Z.txt` · `keyguard-blocked-sample1-20260812T124711Z.png`
- `unlock-gate-sample2-20260812T124714Z.txt` · `keyguard-blocked-sample2-20260812T124714Z.png`
- `unlock-gate-sample3-20260812T124716Z.txt` · `keyguard-blocked-sample3-20260812T124716Z.png`

### Earlier hop samples (same serial, same gate) — 20260812T124549Z–124606Z
```
isKeyguardShowing=true · mDreamingLockscreen=true (samples 1–3 + multipoll)
```
Evidence:
- `keyguard-multipoll-20260812T124549Z.txt` · `gate-final-20260812T124549Z.txt`
- `unlock-gate-sample1-20260812T124555Z.txt` · `keyguard-blocked-sample1-20260812T124555Z.png`
- `unlock-gate-sample2-20260812T124558Z.txt` · `keyguard-blocked-sample2-20260812T124558Z.png`
- `unlock-gate-sample3-20260812T124600Z.txt` · `keyguard-blocked-sample3-20260812T124600Z.png`
- `unlock-gate-20260812T124606Z.txt` · `keyguard-blocked-20260812T124606Z.png`

### Focus / trust / activity / policy (20260812T124719Z)
```
mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
mFocusedApp=ActivityRecord{… me.ruletka.app/.MainActivity t27064}
mKeyguardOccluded=false
isKeyguardShowing=true mDreamingLockscreen=true
trustState=UNTRUSTED deviceLocked=1
mWakefulness=Awake mHoldingDisplaySuspendBlocker=true
DECISION=BLOCKED
multi_softblur=NOT_CLAIMED
MULTI_PASS=NOT_CLAIMED
reason=isKeyguardShowing=true mDreamingLockscreen=true (human fingerprint/PIN required)
Hold=NOT_ATTEMPTED
prefs_load_mode_hold=NOT_CONFIRMED
peers=n/a softNative=0 Sink=0
```
Evidence:
- `gate-final-20260812T124719Z.txt` · `gate-decision.txt`
- `window-focus-20260812T124706Z.txt` · `power-20260812T124706Z.txt` · `trust-20260812T124706Z.txt`
- Shot: `keyguard-final-20260812T124719Z.png` · `keyguard-final.png` · `keyguard.png`
- `adb-devices-20260812T124706Z.txt`

### Screenshot + UI
- Lock / AlternateBouncer (fingerprint path); screen awake; wireless ADB live; app under keyguard.
- PNG files under `mobile/artifacts/device-smoke/f60-blur/`:
  - `keyguard-blocked-20260812T124706Z.png`
  - `keyguard-blocked-sample1-20260812T124711Z.png`
  - `keyguard-blocked-sample2-20260812T124714Z.png`
  - `keyguard-blocked-sample3-20260812T124716Z.png`
  - `keyguard-final-20260812T124719Z.png` · `keyguard-final.png` · `keyguard.png`
  - Earlier: `keyguard-blocked-20260812T124606Z.png` · samples `…124555Z` / `…124558Z` / `…124600Z` · `keyguard-gate.png`
- UI hierarchy (bouncer):
  - `ui-keyguard-20260812T124719Z.xml` · `ui-keyguard.xml`
  - `ui-bouncer-ids-20260812T124719Z.txt` · `ui-bouncer-ids.txt` · `ui-bouncer-snippet.txt`
  - `com.android.systemui:id/alternate_bouncer`
  - `alternate_bouncer_udfps_icon_view` content-desc="Fingerprint sensor"

### Credential
F17–F59 residual + bouncer UI: secure lock (PIN/fingerprint path).  
**No PIN in agent env. Did not** run `locksettings` clear/set or invent unlock.

## What was NOT done (by design)
1. No Settings → Hold chip taps (`Jusqu'à ce que je touche` / `Until I tap`)  
2. No `MODE=web2phone` / multi-pair run this hop  
3. No claim of peers≥2 / softNative / Sink / MULTI_PASS  
4. No product edits, no APK install, no force-push, no MediaSession/live.js thrash  
5. No PIN thrash / dual adb / pool ICE thrash (pool=0 forever)

## Continuity vs F17–F59
Same keyguard block class as F17–F59 unlock-gate retries: screen awake, wireless ADB live, package tip OK, but **human fingerprint/PIN** required before any multi SoftBlur device work. This hop is another honest **BLOCKED COMPLETE** — not a multi SoftBlur PASS. Mirrors F59 honesty style.

## Human unblock (next hop)
1. Human unlock Pixel 9 Pro (fingerprint or PIN) while adb stays on **`192.168.1.94:43343`**.
2. Re-run multi SoftBlur unlock-gate (F61+): gate false → Settings Hold → `prefs_load mode=hold` → multi until `peers≥2` → claim PASS only if softNative=1 + ≥N Sink.

## Checklist
- [x] PATH + adb connect + exclusive `-s 192.168.1.94:43343`
- [x] Package **0.1.374+** confirmed (0.1.374 / vc382)
- [x] Gate `isKeyguardShowing` / `mDreamingLockscreen` → both **true** → BLOCK (samples + multipoll 3 + final)
- [x] dumpsys + screenshot artifacts under `f60-blur/`
- [x] Explicit non-claims table (no invent multi SoftBlur PASS)
- [x] RESULT COMPLETE status = **BLOCKED COMPLETE**
- [x] Card moved running → done
