# BLUR-F68 multi SoftBlur unlock-gate + device retry — RESULT

## Status
**BLOCKED COMPLETE (keyguard)** — Multi SoftBlur **device NOT claimed**.  
Unlock-gate failed: phone still on keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · NotificationShade / AOD path · Dozing).  
**Did not** thrash PIN/locksettings. **Did not** invent multi SoftBlur PASS.  
No Settings→Hold, no multi pair, no softNative/Sink evidence this hop.

Independent stamps this hop (all **BLOCKED**):
1. **20260812T140657Z** — first connect + keyguard-state + screenshot + package + adb devices + window policy + gate-decision
2. **20260812T140659Z / 140701Z / 140703Z** — samples 1–3 unlock-gate (still true) + screenshots · focus/power
3. **20260812T140726Z** — reconfirm dumpsys + multipoll reconfirm (3× true) + gate-final + screenshot
4. **20260812T140752Z** — trust/focus extract (`trustState=UNTRUSTED` · `deviceLocked=1`)

## Gate (required before multi SoftBlur)

| Check | Result |
|-------|--------|
| Device adb exclusive | **PASS** — `-s 192.168.1.94:43343` only |
| Package tip | **PASS** — **0.1.374** / **vc382** (`lastUpdateTime=2026-08-12 00:34:14`) ≥ 0.1.374+ |
| Unlock gate `isKeyguardShowing` | **true** → **BLOCK** (all samples + multipoll + reconfirm) |
| Unlock gate `mDreamingLockscreen` | **true** → **BLOCK** (all samples + multipoll + reconfirm) |
| Focus | `mCurrentFocus=NotificationShade` · focused app under keyguard: `com.brave.browser` Main |
| Trust | `trustState=UNTRUSTED` · `deviceLocked=1` |
| Power | `mWakefulness=Dozing` · `mHoldingDisplaySuspendBlocker=false` |
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
- Artifacts: `mobile/artifacts/device-smoke/f68-blur/`
- RESULT: this file; card `running/BLUR-F68-multi-soft-unlock-retry.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
firstInstallTime=2026-08-10 14:37:44
Pixel 9 Pro (caiman) · wireless adb 192.168.1.94:43343
```
Evidence:
- `mobile/artifacts/device-smoke/f68-blur/package-full-20260812T140657Z.txt`
- `mobile/artifacts/device-smoke/f68-blur/package-version-20260812T140657Z.txt`
- `mobile/artifacts/device-smoke/f68-blur/package-detail-20260812T140657Z.txt`
- `mobile/artifacts/device-smoke/f68-blur/package.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:5
```
Evidence:
- `mobile/artifacts/device-smoke/f68-blur/adb-devices-20260812T140657Z.txt`
- `mobile/artifacts/device-smoke/f68-blur/devices-l.txt`  
No dual-adb thrash. Port **43343** exclusive.

## Keyguard evidence (gate FAIL → stop)

### First connect — 20260812T140657Z
```
=== F68 keyguard gate 20260812T140657Z ===
device: 192.168.1.94:43343
Pixel 9 Pro
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
  mWakefulness=Dozing
  mHoldingDisplaySuspendBlocker=false
  mCurrentFocus=Window{e1c80cf u0 NotificationShade}
  mFocusedApp=ActivityRecord{... com.brave.browser/...Main ...}
  trustState=UNTRUSTED deviceLocked=1
```
Evidence: `keyguard-state-20260812T140657Z.txt` · `keyguard-state-compact-20260812T140657Z.txt` · `keyguard-dumpsys-20260812T140657Z.txt` · `keyguard-screenshot-20260812T140657Z.png` · `keyguard-blocked.png` · `01-keyguard-gate.png` · `gate-decision.txt`

### Samples 1–3 — 20260812T140659Z / 140701Z / 140703Z
```
sample=1 ts_utc=20260812T140659Z
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
    mWakefulness=Dozing
    mFocusedApp=com.brave.browser Main
sample=2 ts_utc=20260812T140701Z
    isKeyguardShowing=true · mDreamingLockscreen=true · Dozing
sample=3 ts_utc=20260812T140703Z
    isKeyguardShowing=true · mDreamingLockscreen=true · Dozing
```
Evidence: `unlock-gate-sample{1,2,3}-20260812T140657Z.txt` · `keyguard-blocked-sample{1,2,3}-20260812T140657Z.png` · `keyguard-multipoll-20260812T140657Z.txt` · `keyguard-state-multipoll.txt`

### Multipoll reconfirm — 20260812T140726Z
```
=== multipoll reconfirm ts_utc=20260812T140726Z serial=192.168.1.94:43343 ===
=== poll 1 14:07:31Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 2 14:07:32Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 3 14:07:33Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence: `keyguard-multipoll-20260812T140726Z.txt` · `keyguard-reconfirm-20260812T140726Z.txt` · `gate-final-20260812T140726Z.txt` · `keyguard-20260812T140726Z.png`

### Trust / focus — 20260812T140752Z
```
trustState=UNTRUSTED, trustManaged=1, deviceLocked=1
mCurrentFocus=NotificationShade
mFocusedApp=com.brave.browser Main
isKeyguardShowing=true · mDreamingLockscreen=true
```
Evidence: `trust-focus-20260812T140752Z.txt`

## Gate decision (verbatim)
```
TS=20260812T140657Z
SERIAL=192.168.1.94:43343
KEYGUARD_LINE:     isKeyguardShowing=true
DREAM_LINE:     mShowingDream=false mDreamingLockscreen=true
WAKE_LINE:   mWakefulness=Dozing
DECISION=BLOCKED
REASON=isKeyguardShowing=true AND mDreamingLockscreen=true (no unlock thrash; no Hold; no multi SoftBlur)
MULTI_SOFTBLUR_PASS=NOT_CLAIMED
MULTI_PASS=NOT_CLAIMED
```

## What was NOT done (must-not honored)
- No `locksettings` / PIN / swipe unlock thrash
- No multi SoftBlur PASS invent / MULTI_PASS invent
- No APK build or install
- No product code edits
- No `iceCandidatePoolSize` / pool thrash (pool remains 0 policy)
- No dual adb; exclusive serial only
- No force-push / deploy

## Continuity
- Prior **F67** same serial **43343** · package **0.1.374-vc382** · BLOCKED keyguard (NotificationShade/AOD/Dozing)
- **F68** re-check: still BLOCKED; chain **F17–F68** keyguard open for multi SoftBlur device
- Multi SoftBlur device remains **OPEN / NOT claimed** until human unlock + Hold + peers≥2 + softNative=1 + Sink evidence

## Artifacts root
`mobile/artifacts/device-smoke/f68-blur/`

## Card disposition
`tasks/grok-loop/running/BLUR-F68-multi-soft-unlock-retry.md` → `tasks/grok-loop/done/`
