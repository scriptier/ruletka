# BLUR-F57 multi SoftBlur unlock-gate + device retry — RESULT

## Status
**BLOCKED COMPLETE (keyguard)** — Multi SoftBlur **device NOT claimed**.  
Unlock-gate failed: phone still on keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · AlternateBouncer / fingerprint).  
**Did not** thrash PIN/locksettings. **Did not** invent multi SoftBlur PASS.  
No Settings→Hold, no multi pair, no softNative/Sink evidence this hop.

Independent stamps this hop (all **BLOCKED**):
1. **20260812T121546Z** — primary connect + dumpsys + screenshot
2. **20260812T121600Z** — sample 2 (focus: `me.ruletka.app/.MainActivity` under keyguard)
3. **20260812T121603Z** — sample 3 (still true)
4. **20260812T121617Z** — gate-decision + AlternateBouncerView + UI hierarchy
5. **20260812T121647Z** — independent multipoll reconfirm (3× true) + shot + window/trust/activity
6. **20260812T121703Z** — final gate reconfirm (still true · trust UNTRUSTED · Awake)

## Gate (required before multi SoftBlur)

| Check | Result |
|-------|--------|
| Device adb exclusive | **PASS** — `-s 192.168.1.94:43343` only |
| Package tip | **PASS** — **0.1.374** / **vc382** (`lastUpdateTime=2026-08-12 00:34:14`) ≥ 0.1.374+ |
| Unlock gate `isKeyguardShowing` | **true** → **BLOCK** (samples 1–3 + decision + multipoll + final) |
| Unlock gate `mDreamingLockscreen` | **true** → **BLOCK** (samples 1–3 + decision + multipoll + final) |
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
- Artifacts: `mobile/artifacts/device-smoke/f57-blur/`
- RESULT: this file; card `running/BLUR-F57-multi-soft-unlock-retry.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
firstInstallTime=2026-08-10 14:37:44
Pixel 9 Pro (caiman) · wireless adb 192.168.1.94:43343
```
Evidence:
- `mobile/artifacts/device-smoke/f57-blur/package-detail.txt`
- `mobile/artifacts/device-smoke/f57-blur/package-version.txt`
- `mobile/artifacts/device-smoke/f57-blur/package.txt`
- `mobile/artifacts/device-smoke/f57-blur/package-full-20260812T121703Z.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:5
```
Evidence:
- `mobile/artifacts/device-smoke/f57-blur/devices-l.txt`
- `mobile/artifacts/device-smoke/f57-blur/adb-devices-20260812T121647Z.txt`  
No dual-adb thrash. Port **43343** exclusive.

## Keyguard evidence (gate FAIL → stop)

### Sample 1 — 20260812T121546Z
```
ts_utc=20260812T121546Z
serial=192.168.1.94:43343
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
---
CP2A.260705.006
Pixel 9 Pro
```
Evidence: `unlock-gate-20260812T121546Z.txt` · `keyguard-dumpsys-20260812T121546Z.txt` · `keyguard-blocked-20260812T121546Z.png`

### Sample 2 — 20260812T121600Z
```
sample=2 ts_utc=20260812T121600Z
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
  ResumedActivity: ActivityRecord{206620534 u0 me.ruletka.app/.MainActivity t27064}
  mFocusedApp=ActivityRecord{206620534 u0 me.ruletka.app/.MainActivity t27064}
```
Evidence: `unlock-gate-sample2-20260812T121600Z.txt` · `keyguard-blocked-sample2-20260812T121600Z.png`

### Sample 3 — 20260812T121603Z
```
sample=3 ts_utc=20260812T121603Z
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence: `unlock-gate-sample3-20260812T121603Z.txt`

### Decision stamp — 20260812T121617Z
```
ts_utc=20260812T121617Z
DECISION=BLOCKED
multi_softblur=NOT_CLAIMED
MULTI_PASS=NOT_CLAIMED
reason=isKeyguardShowing=true mDreamingLockscreen=true
  mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
  mFocusedApp=ActivityRecord{206620534 u0 me.ruletka.app/.MainActivity t27064}
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Window / power / trust / policy:
```
mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
mFocusedApp=ActivityRecord{206620534 u0 me.ruletka.app/.MainActivity t27064}
mDreamingLockscreen=true isKeyguardShowing=true
trustState=UNTRUSTED deviceLocked=1
mWakefulness=Awake mHoldingDisplaySuspendBlocker=true
showing=true occluded=false trusted=false
screenState=SCREEN_STATE_ON interactiveState=INTERACTIVE_STATE_AWAKE
```
Evidence:
- `gate-decision.txt`
- `window-focus.txt` · `window-policy.txt` · `power.txt` · `trust.txt`

### Independent multipoll reconfirm — 20260812T121647Z
```
=== poll 1 12:16:49Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 2 12:16:51Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 3 12:16:52Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Focus / trust / activity:
```
mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
mFocusedApp=ActivityRecord{206620534 u0 me.ruletka.app/.MainActivity t27064}
mIme*Target=AlternateBouncerView
trustState=UNTRUSTED deviceLocked=1
KeyguardController: mKeyguardShowing=true Occluded=false
```
Evidence:
- `keyguard-multipoll-20260812T121647Z.txt` · `keyguard-multipoll.txt`
- `keyguard-window-20260812T121647Z.txt`
- `trust-20260812T121647Z.txt` · `activity-20260812T121647Z.txt`
- `window-policy-20260812T121647Z.txt`
- Shot: `keyguard-20260812T121647Z.png` · `keyguard-final.png`
- `timestamp-utc.txt` · `adb-devices-20260812T121647Z.txt`

### Final reconfirm — 20260812T121703Z
```
ts_utc=20260812T121703Z
serial=192.168.1.94:43343
DECISION=BLOCKED
multi_softblur=NOT_CLAIMED
MULTI_PASS=NOT_CLAIMED
reason=isKeyguardShowing=true mDreamingLockscreen=true
  mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
  mFocusedApp=ActivityRecord{206620534 u0 me.ruletka.app/.MainActivity t27064}
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
trustState=UNTRUSTED deviceLocked=1
mWakefulness=Awake mHoldingDisplaySuspendBlocker=true
```
Evidence: `gate-final-20260812T121703Z.txt` · `package-full-20260812T121703Z.txt`

### Screenshot + UI
- Lock / AlternateBouncer (fingerprint path); screen awake; wireless ADB live; app under keyguard.
- Screenshot shows lockscreen fingerprint path / wireless debugging connected.
- PNG files (960×2142 RGBA):
  - `mobile/artifacts/device-smoke/f57-blur/keyguard-blocked-20260812T121546Z.png`
  - `mobile/artifacts/device-smoke/f57-blur/keyguard-blocked-sample2-20260812T121600Z.png`
  - `mobile/artifacts/device-smoke/f57-blur/keyguard-20260812T121647Z.png`
  - `mobile/artifacts/device-smoke/f57-blur/keyguard-final.png`
- UI hierarchy (bouncer):
  - `ui-keyguard.xml` · `ui-bouncer-ids.txt` · `ui-bouncer-snippet.txt`
  - `com.android.systemui:id/alternate_bouncer`
  - `alternate_bouncer_udfps_icon_view` content-desc="Fingerprint sensor"

### Credential
F17–F56 residual + bouncer UI: secure lock (PIN/fingerprint path).  
**No PIN in agent env. Did not** run `locksettings` clear/set or invent unlock.

## What was NOT done (by design)
1. No Settings → Hold chip taps (`Jusqu'à ce que je touche` / `Until I tap`)  
2. No `MODE=web2phone` / multi-pair run this hop  
3. No claim of peers≥2 / softNative / Sink / MULTI_PASS  
4. No product edits, no APK install, no force-push, no MediaSession/live.js thrash  
5. No PIN thrash / dual adb / pool ICE thrash (pool=0 forever)

## Continuity vs F17–F56
Same keyguard block class as F17–F56 unlock-gate retries: screen awake, wireless ADB live, package tip OK, but **human fingerprint/PIN** required before any multi SoftBlur device work. This hop is another honest **BLOCKED COMPLETE** — not a multi SoftBlur PASS. Mirrors F56 honesty.

## Human unblock (next hop)
1. Human unlock Pixel 9 Pro (fingerprint or PIN) while adb stays on **`192.168.1.94:43343`**.
2. Re-run multi SoftBlur unlock-gate (F58+): gate false → Settings Hold → `prefs_load mode=hold` → multi until `peers≥2` → claim PASS only if softNative=1 + ≥N Sink.

## Checklist
- [x] PATH + adb connect + exclusive `-s 192.168.1.94:43343`
- [x] Package **0.1.374+** confirmed (0.1.374 / vc382)
- [x] Gate `isKeyguardShowing` / `mDreamingLockscreen` → both **true** → BLOCK (3 samples + decision + multipoll 3 + final)
- [x] dumpsys + screenshot artifacts under `f57-blur/`
- [x] Explicit non-claims table (no invent multi SoftBlur PASS)
- [x] RESULT COMPLETE status = **BLOCKED COMPLETE**
- [x] Card moved running → done
