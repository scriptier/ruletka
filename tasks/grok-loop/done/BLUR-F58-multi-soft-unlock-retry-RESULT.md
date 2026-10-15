# BLUR-F58 multi SoftBlur unlock-gate + device retry — RESULT

## Status
**BLOCKED COMPLETE (keyguard)** — Multi SoftBlur **device NOT claimed**.  
Unlock-gate failed: phone still on keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · AlternateBouncer / fingerprint).  
**Did not** thrash PIN/locksettings. **Did not** invent multi SoftBlur PASS.  
No Settings→Hold, no multi pair, no softNative/Sink evidence this hop.

Independent stamps this hop (all **BLOCKED**):
1. **20260812T122646Z** — primary connect + dumpsys + screenshot (sample 1)
2. **20260812T122650Z** — sample 2 screenshot + unlock-gate
3. **20260812T122653Z** — sample 3 unlock-gate (still true)
4. **20260812T122709Z** — worker reconfirm dumpsys + screenshot
5. **20260812T122712Z** — multipoll / window / trust / activity samples
6. **20260812T122730Z** — independent multipoll reconfirm (3× true) + final shot + UI bouncer + package full

## Gate (required before multi SoftBlur)

| Check | Result |
|-------|--------|
| Device adb exclusive | **PASS** — `-s 192.168.1.94:43343` only |
| Package tip | **PASS** — **0.1.374** / **vc382** (`lastUpdateTime=2026-08-12 00:34:14`) ≥ 0.1.374+ |
| Unlock gate `isKeyguardShowing` | **true** → **BLOCK** (samples 1–3 + reconfirm + multipoll + final) |
| Unlock gate `mDreamingLockscreen` | **true** → **BLOCK** (samples 1–3 + reconfirm + multipoll + final) |
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
- Artifacts: `mobile/artifacts/device-smoke/f58-blur/`
- RESULT: this file; card `running/BLUR-F58-multi-soft-unlock-retry.md` → `done/`
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
- `mobile/artifacts/device-smoke/f58-blur/package-detail.txt`
- `mobile/artifacts/device-smoke/f58-blur/package-version.txt`
- `mobile/artifacts/device-smoke/f58-blur/package.txt`
- `mobile/artifacts/device-smoke/f58-blur/package-full-20260812T122730Z.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:5
```
Evidence:
- `mobile/artifacts/device-smoke/f58-blur/devices-l.txt`
- `mobile/artifacts/device-smoke/f58-blur/adb-devices-20260812T122730Z.txt`  
No dual-adb thrash. Port **43343** exclusive.

## Keyguard evidence (gate FAIL → stop)

### Sample 1 — 20260812T122646Z
```
ts_utc=20260812T122646Z
serial=192.168.1.94:43343
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence: `unlock-gate-20260812T122646Z.txt` · `keyguard-dumpsys-20260812T122646Z.txt` · `keyguard-blocked-20260812T122646Z.png`

### Sample 2 — 20260812T122650Z
```
sample=2 ts_utc=20260812T122650Z
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence: `unlock-gate-sample2-20260812T122650Z.txt` · `keyguard-blocked-sample2-20260812T122650Z.png`

### Sample 3 — 20260812T122653Z
```
sample=3 ts_utc=20260812T122653Z
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence: `unlock-gate-sample3-20260812T122653Z.txt`

### Worker reconfirm — 20260812T122709Z
```
ts_utc=20260812T122709Z
serial=192.168.1.94:43343
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
  KeyguardController:
    mKeyguardShowing=true
   KeyguardShowing=true AodShowing=false Occluded=false
  mScreenOn=true mScreenLocked=true
  mWakefulness=Awake mHoldingDisplaySuspendBlocker=true
GATE=KEYGUARD_ON → BLOCKED COMPLETE (no Hold/multi SoftBlur)
```
Evidence: `20260812T122709Z-keyguard-dumpsys.txt` · `20260812T122709Z-keyguard.png` · `keyguard-dumpsys.txt`

### Decision / multipoll — 20260812T122712Z + 20260812T122730Z
```
=== multipoll ts_utc=20260812T122730Z serial=192.168.1.94:43343 ===
=== poll 1 12:27:31Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 2 12:27:32Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 3 12:27:34Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Focus / trust / activity / policy:
```
mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
mFocusedApp=ActivityRecord{206620534 u0 me.ruletka.app/.MainActivity t27064}
ResumedActivity: ActivityRecord{… me.ruletka.app/.MainActivity t27064}
trustState=UNTRUSTED deviceLocked=1
KeyguardController: mKeyguardShowing=true Occluded=false
showing=true occluded=false trusted=false
screenState=SCREEN_STATE_ON interactiveState=INTERACTIVE_STATE_AWAKE
mWakefulness=Awake mHoldingDisplaySuspendBlocker=true
DECISION=BLOCKED
multi_softblur=NOT_CLAIMED
MULTI_PASS=NOT_CLAIMED
reason=isKeyguardShowing=true mDreamingLockscreen=true
```
Evidence:
- `gate-decision.txt` · `gate-final-20260812T122730Z.txt`
- `keyguard-multipoll-20260812T122730Z.txt` · `keyguard-multipoll.txt`
- `window-focus.txt` · `window-policy.txt` · `power.txt` · `trust.txt`
- Shot: `keyguard-final-20260812T122730Z.png` · `keyguard-final.png` · `keyguard.png`
- `adb-devices-20260812T122730Z.txt`

### Screenshot + UI
- Lock / AlternateBouncer (fingerprint path); screen awake; wireless ADB live; app under keyguard.
- PNG files under `mobile/artifacts/device-smoke/f58-blur/`:
  - `keyguard-blocked-20260812T122646Z.png`
  - `keyguard-blocked-sample2-20260812T122650Z.png`
  - `20260812T122709Z-keyguard.png`
  - `keyguard-20260812T122712Z.png`
  - `keyguard-final-20260812T122730Z.png` · `keyguard-final.png` · `keyguard.png`
- UI hierarchy (bouncer):
  - `ui-keyguard.xml` · `ui-bouncer-ids.txt` · `ui-bouncer-snippet.txt`
  - `com.android.systemui:id/alternate_bouncer`
  - `alternate_bouncer_udfps_icon_view` content-desc="Fingerprint sensor"

### Credential
F17–F57 residual + bouncer UI: secure lock (PIN/fingerprint path).  
**No PIN in agent env. Did not** run `locksettings` clear/set or invent unlock.

## What was NOT done (by design)
1. No Settings → Hold chip taps (`Jusqu'à ce que je touche` / `Until I tap`)  
2. No `MODE=web2phone` / multi-pair run this hop  
3. No claim of peers≥2 / softNative / Sink / MULTI_PASS  
4. No product edits, no APK install, no force-push, no MediaSession/live.js thrash  
5. No PIN thrash / dual adb / pool ICE thrash (pool=0 forever)

## Continuity vs F17–F57
Same keyguard block class as F17–F57 unlock-gate retries: screen awake, wireless ADB live, package tip OK, but **human fingerprint/PIN** required before any multi SoftBlur device work. This hop is another honest **BLOCKED COMPLETE** — not a multi SoftBlur PASS. Mirrors F57 honesty.

## Human unblock (next hop)
1. Human unlock Pixel 9 Pro (fingerprint or PIN) while adb stays on **`192.168.1.94:43343`**.
2. Re-run multi SoftBlur unlock-gate (F59+): gate false → Settings Hold → `prefs_load mode=hold` → multi until `peers≥2` → claim PASS only if softNative=1 + ≥N Sink.

## Checklist
- [x] PATH + adb connect + exclusive `-s 192.168.1.94:43343`
- [x] Package **0.1.374+** confirmed (0.1.374 / vc382)
- [x] Gate `isKeyguardShowing` / `mDreamingLockscreen` → both **true** → BLOCK (3 samples + reconfirm + multipoll 3 + final)
- [x] dumpsys + screenshot artifacts under `f58-blur/`
- [x] Explicit non-claims table (no invent multi SoftBlur PASS)
- [x] RESULT COMPLETE status = **BLOCKED COMPLETE**
- [x] Card moved running → done
