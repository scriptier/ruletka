# BLUR-F18 multi SoftBlur unlock-gate + device retry — RESULT

## Status
**BLOCKED COMPLETE (keyguard)** — Multi SoftBlur **device NOT claimed**.  
Unlock-gate failed: phone still on keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · AlternateBouncer / fingerprint).  
**Did not** thrash PIN/locksettings. **Did not** invent multi SoftBlur PASS.  
No Settings→Hold, no multi pair, no softNative/Sink evidence this hop.

## Gate (required before multi SoftBlur)

| Check | Result |
|-------|--------|
| Device adb exclusive | **PASS** — `-s 192.168.1.94:43343` only (F17 rotated; **not** dead 42227) |
| Package tip | **PASS** — **0.1.374** / **vc382** (`lastUpdateTime=2026-08-12 00:34:14`) |
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

**PASS candidate criteria (from card):** multiRemote + Hold + softNative=1 + Sink for remotes.  
**None met.** Explicit: **no multi SoftBlur PASS**.

## OWN
- Phone exclusive wireless adb: **`192.168.1.94:43343`**
- Partner helpers (`multi-pair.mjs` / `phone-web-pair.mjs`): **not used** (gate blocked)
- Artifacts: `mobile/artifacts/device-smoke/f18-blur/`
- RESULT: this file; card `running/BLUR-F18-multi-soft-unlock-retry.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
firstInstallTime=2026-08-10 14:37:44
Pixel 9 Pro (caiman)
```
Evidence: `mobile/artifacts/device-smoke/f18-blur/package.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:1
```
Evidence: `mobile/artifacts/device-smoke/f18-blur/adb-devices.txt`  
No dual-adb thrash. Port **43343** (F17 rotate); **42227 not used**.

## Keyguard evidence (gate FAIL → stop)

### dumpsys window (2026-08-12T07:28:06Z)
```
mKeyguardOccluded=false
mCurrentFocus=Window{… u0 AlternateBouncerView}
mFocusedApp=ActivityRecord{… u0 me.ruletka.app/.MainActivity t27064}
mShowingDream=false mDreamingLockscreen=true
isKeyguardShowing=true
mWakefulness=Awake
```
Reconfirm ~07:28:23Z: still `isKeyguardShowing=true` · `mDreamingLockscreen=true`.

### UIAutomator (no PIN thrash)
- Hierarchy is **only** `com.android.systemui` — `alternate_bouncer` + UDFPS fingerprint sensor.
- **No** `me.ruletka.app` chrome / privacy chips.

### Screenshot
- Lock screen + media widget + **“Wireless debugging connected · 18m”** + fingerprint pad.
- Files:
  - `mobile/artifacts/device-smoke/f18-blur/20260812T072801Z-block-keyguard-screen.png`
  - `mobile/artifacts/device-smoke/f18-blur/block-keyguard-screen.png` (same)
- State:
  - `mobile/artifacts/device-smoke/f18-blur/20260812T072801Z-block-keyguard-state.txt`
  - `mobile/artifacts/device-smoke/f18-blur/block-keyguard-state.txt`
- UI dump: `mobile/artifacts/device-smoke/f18-blur/block-keyguard-ui.xml`

### Credential
F17 residual + bouncer UI: secure lock (PIN/fingerprint path).  
**No PIN in agent env. Did not** run `locksettings` clear/set or invent unlock.

## What was NOT done (by design)
1. No Settings → Hold chip taps  
2. No `MODE=web2phone` / multi-pair run this hop  
3. No claim of peers≥2 / softNative / Sink  
4. No product edits, no APK install, no force-push, no MediaSession/live.js thrash  
5. No PIN thrash / dual adb / pool ICE thrash  

## Continuity vs F17
| Item | F17 | F18 (this hop) |
|------|-----|----------------|
| Serial | 43343 after rotate | **43343** exclusive |
| Package | 0.1.374 / vc382 | **same** |
| Keyguard | BLOCKED | **still BLOCKED** |
| Multi SoftBlur device | NOT claimed | **NOT claimed** |
| multi-pair scaffold | SCAFFOLD_DONE only (web) | **not re-run** (gate stop) |

## Unblock for multi SoftBlur device (human)
1. Physically unlock Pixel 9 Pro (fingerprint or PIN) so `isKeyguardShowing=false` and `mDreamingLockscreen=false`.
2. Keep wireless adb on **43343** (or re-export live port).
3. Re-queue hop: Settings → Hold (`Jusqu'à ce que je touche` / `Until I tap`) → confirm `prefs_load mode=hold`.
4. Then true multi (web2phone FIND_THIRD or multi-pair + phone as 3rd) until phone log `peers≥2` / multiRemote.
5. Only if multiRemote + Hold: require `softNative=1` + `SoftBlurVideoView: Sink attached` for remotes → then multi SoftBlur device PASS candidate.

## Artifacts index
```
mobile/artifacts/device-smoke/f18-blur/
  adb-devices.txt
  package.txt
  package-ver.txt
  block-keyguard-state.txt
  block-keyguard-screen.png
  block-keyguard-ui.xml
  completed-at.txt
  20260812T072801Z-block-keyguard-state.txt
  20260812T072801Z-block-keyguard-screen.png
  (+ earlier 20260812T072713Z-* from pre-flight capture)
```

## Completed
- UTC: **2026-08-12T07:28:23Z**
- Outcome: **BLOCKED COMPLETE (keyguard)** — multi SoftBlur device **not** PASS
- Honesty: **never invent multi SoftBlur PASS**
