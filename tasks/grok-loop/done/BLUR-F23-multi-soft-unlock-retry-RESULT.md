# BLUR-F23 multi SoftBlur unlock-gate + device retry — RESULT

## Status
**BLOCKED COMPLETE (keyguard)** — Multi SoftBlur **device NOT claimed**.  
Unlock-gate failed: phone still on keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · AlternateBouncer / fingerprint).  
**Did not** thrash PIN/locksettings. **Did not** invent multi SoftBlur PASS.  
No Settings→Hold, no multi pair, no softNative/Sink evidence this hop.

## Gate (required before multi SoftBlur)

| Check | Result |
|-------|--------|
| Device adb exclusive | **PASS** — `-s 192.168.1.94:43343` only (**not** dead 42227) |
| Package tip | **PASS** — **0.1.374** / **vc382** (`lastUpdateTime=2026-08-12 00:34:14`) ≥ 0.1.374+ |
| Unlock gate `isKeyguardShowing` | **true** → **BLOCK** |
| Unlock gate `mDreamingLockscreen` | **true** → **BLOCK** |
| Focus | `AlternateBouncerView` (systemui) · app record `me.ruletka.app/.MainActivity` under keyguard |
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
| Scaffold multi-pair | **not run** | gate stop before step 3 |
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
- Artifacts: `mobile/artifacts/device-smoke/f23-blur/`
- RESULT: this file; card `running/BLUR-F23-multi-soft-unlock-retry.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
firstInstallTime=2026-08-10 14:37:44
Pixel 9 Pro (caiman) · wireless adb 192.168.1.94:43343
```
Evidence: `mobile/artifacts/device-smoke/f23-blur/package.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:5
```
Evidence: `mobile/artifacts/device-smoke/f23-blur/adb-devices.txt`  
No dual-adb thrash. Port **43343** exclusive; **42227 not used**.

## Keyguard evidence (gate FAIL → stop)

### dumpsys window (2026-08-12T08:06:35Z · reconfirm 08:07:02Z)
```
mKeyguardOccluded=false
mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
mFocusedApp=ActivityRecord{… u0 me.ruletka.app/.MainActivity t27064}
mShowingDream=false mDreamingLockscreen=true
isKeyguardShowing=true
mWakefulness=Awake
```
Reconfirm 2026-08-12T08:07:02Z: still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `AlternateBouncerView`.

### UIAutomator (no PIN thrash)
- Hierarchy is **only** `com.android.systemui` — `alternate_bouncer` + UDFPS (`content-desc="Fingerprint sensor"`).
- **0** `me.ruletka.app` chrome / privacy chips.

### Screenshot
- Lock screen + AlternateBouncer / fingerprint path (same class as F17–F22).
- Visible: lock clock **2:06**, fingerprint icon, wireless debugging chip (~29m), media notification.
- Files:
  - `mobile/artifacts/device-smoke/f23-blur/20260812T080635Z-block-keyguard-screen.png`
  - `mobile/artifacts/device-smoke/f23-blur/block-keyguard-screen.png` (same)
  - `mobile/artifacts/device-smoke/f23-blur/20260812T080635Z-keyguard-blocked.png`
  - `mobile/artifacts/device-smoke/f23-blur/20260812T080635Z-unlock-gate.png`
- State:
  - `mobile/artifacts/device-smoke/f23-blur/20260812T080635Z-block-keyguard-state.txt`
  - `mobile/artifacts/device-smoke/f23-blur/block-keyguard-state.txt`
  - `mobile/artifacts/device-smoke/f23-blur/20260812T080635Z-keyguard-reconfirm.txt`
- UI dump: `mobile/artifacts/device-smoke/f23-blur/block-keyguard-ui.xml`

### Credential
F17–F22 residual + bouncer UI: secure lock (PIN/fingerprint path).  
**No PIN in agent env. Did not** run `locksettings` clear/set or invent unlock.

## What was NOT done (by design)
1. No Settings → Hold chip taps (`Jusqu'à ce que je touche` / `Until I tap`)  
2. No `MODE=web2phone` / multi-pair run this hop  
3. No claim of peers≥2 / softNative / Sink / MULTI_PASS  
4. No product edits, no APK install, no force-push, no MediaSession/live.js thrash  
5. No PIN thrash / dual adb / pool ICE thrash (pool=0 forever)

## Continuity vs F17–F22

| Item | F17 | F18 | F19 | F20 | F21 | F22 | F23 (this hop) |
|------|-----|-----|-----|-----|-----|-----|----------------|
| Serial | 43343 after rotate | 43343 | 43343 | 43343 | 43343 | 43343 | **43343** exclusive |
| Package | 0.1.374 / vc382 | same | same | same | same | same | **same** (≥0.1.374+) |
| Keyguard | BLOCKED | still BLOCKED | still BLOCKED | still BLOCKED | still BLOCKED | still BLOCKED | **still BLOCKED** |
| Multi SoftBlur device | NOT claimed | NOT claimed | NOT claimed | NOT claimed | NOT claimed | NOT claimed | **NOT claimed** |
| multi-pair scaffold | SCAFFOLD_DONE only (web) | not re-run | not re-run | not run | not run | not run | **not run** (gate stop) |

## Unblock for multi SoftBlur device (human)
1. Physically unlock Pixel 9 Pro (fingerprint or PIN) so `isKeyguardShowing=false` and `mDreamingLockscreen=false`.
2. Keep wireless adb on **43343** (or re-export live port).
3. Re-queue hop: Settings → Hold (`Jusqu'à ce que je touche` / `Until I tap`) → confirm `prefs_load mode=hold`.
4. Then true multi (web2phone FIND_THIRD or multi-pair + phone as 3rd) until phone log `peers≥2` / multiRemote.
5. Only if multiRemote + Hold: require `softNative=1` + `SoftBlurVideoView: Sink attached` for remotes → then multi SoftBlur device PASS candidate.

## Artifacts index
```
mobile/artifacts/device-smoke/f23-blur/
  adb-devices.txt
  adb-devices-end.txt
  package.txt
  package-full.txt
  block-keyguard-state.txt
  block-keyguard-screen.png
  block-keyguard-ui.xml
  completed-at.txt
  20260812T080635Z-adb-devices.txt
  20260812T080635Z-package-version.txt
  20260812T080635Z-package-full.txt
  20260812T080635Z-block-keyguard-state.txt
  20260812T080635Z-block-keyguard-screen.png
  20260812T080635Z-block-keyguard-ui.xml
  20260812T080635Z-keyguard-blocked.png
  20260812T080635Z-unlock-gate.png
  20260812T080635Z-keyguard-window.txt
  20260812T080635Z-keyguard-window-detail.txt
  20260812T080635Z-keyguard-reconfirm.txt
  20260812T080635Z-power.txt
  20260812T080635Z-activity-focus.txt
  20260812T080635Z-keyguard-activity.txt
  (+ parallel 20260812T080554Z-* preflight set)
```

## Completed
- UTC: **2026-08-12T08:07:02Z**
- Outcome: **BLOCKED COMPLETE (keyguard)** — multi SoftBlur device **not** PASS
- Honesty: **never invent multi SoftBlur PASS**
