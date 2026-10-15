# BLUR-F26 multi SoftBlur unlock-gate + device retry — RESULT

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
- Artifacts: `mobile/artifacts/device-smoke/f26-blur/`
- RESULT: this file; card `running/BLUR-F26-multi-soft-unlock-retry.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
firstInstallTime=2026-08-10 14:37:44
Pixel 9 Pro (caiman) · wireless adb 192.168.1.94:43343
```
Evidence: `mobile/artifacts/device-smoke/f26-blur/20260812T083627Z-package-version.txt` · `package-version-retry.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:5
```
Evidence: `mobile/artifacts/device-smoke/f26-blur/20260812T083627Z-adb-devices.txt` · `adb-devices-end-retry.txt`  
No dual-adb thrash. Port **43343** exclusive; **42227 not used**.

## Keyguard evidence (gate FAIL → stop)

### dumpsys window (2026-08-12T08:36:27Z · reconfirm 08:37:07Z)
```
mKeyguardOccluded=false
mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
mFocusedApp=ActivityRecord{… u0 me.ruletka.app/.MainActivity t27064}
mShowingDream=false mDreamingLockscreen=true
isKeyguardShowing=true
mWakefulness=Awake
```
KeyguardController: `mKeyguardShowing=true` · `mKeyguardGoingAway=false` · `Occluded=false`.  
Reconfirm (same hop): still `isKeyguardShowing=true` · `mDreamingLockscreen=true`.

### UIAutomator (no PIN thrash)
- Hierarchy is **only** `com.android.systemui` (7 package nodes) — alternate bouncer + UDFPS (`content-desc="Fingerprint sensor"`).
- **0** `me.ruletka.app` chrome / privacy chips.

### Screenshot
- Lock screen + AlternateBouncer / fingerprint path (same class as F17–F25).
- Visible: lock clock **2:36**, fingerprint icon, wireless debugging chip (~59m), media notification (YouTube / WesHammer), battery ~53%.
- Files:
  - `mobile/artifacts/device-smoke/f26-blur/20260812T083627Z-block-keyguard-screen.png`
  - `mobile/artifacts/device-smoke/f26-blur/20260812T083627Z-unlock-gate.png`
  - Stable copies: `block-keyguard-screen.png` · `unlock-gate.png` · prior session shots
- State:
  - `mobile/artifacts/device-smoke/f26-blur/20260812T083627Z-block-keyguard-state.txt`
  - `mobile/artifacts/device-smoke/f26-blur/20260812T083627Z-keyguard-reconfirm.txt`
  - `mobile/artifacts/device-smoke/f26-blur/20260812T083627Z-keyguard-window-detail.txt`
  - `mobile/artifacts/device-smoke/f26-blur/20260812T083627Z-keyguard-window.txt`
- UI dump: `mobile/artifacts/device-smoke/f26-blur/20260812T083627Z-block-keyguard-ui.xml`

### Credential
F17–F25 residual + bouncer UI: secure lock (PIN/fingerprint path).  
**No PIN in agent env. Did not** run `locksettings` clear/set or invent unlock.

## What was NOT done (by design)
1. No Settings → Hold chip taps (`Jusqu'à ce que je touche` / `Until I tap`)  
2. No `MODE=web2phone` / multi-pair run this hop  
3. No claim of peers≥2 / softNative / Sink / MULTI_PASS  
4. No product edits, no APK install, no force-push, no MediaSession/live.js thrash  
5. No PIN thrash / dual adb / pool ICE thrash (pool=0 forever)

## Continuity vs F17–F25
Same keyguard block class as F17–F25 unlock-gate retries: screen awake, wireless ADB live, package tip OK, but **human fingerprint/PIN** required before any multi SoftBlur device work. This hop is another honest **BLOCKED COMPLETE** — not a multi SoftBlur PASS.

## Next hop (human)
1. **Human unlock** Pixel 9 Pro (fingerprint or PIN) with screen remaining unlocked.  
2. Re-queue unlock-gate retry **or** direct Hold + multi SoftBlur hop once gate is green.  
3. Only then: Settings Hold → `prefs_load mode=hold` → multi until `peers≥2` → softNative=1 + Sink count.

## Done
- RESULT written: `tasks/grok-loop/done/BLUR-F26-multi-soft-unlock-retry-RESULT.md`
- Card moved: `running/BLUR-F26-multi-soft-unlock-retry.md` → `done/`
- Artifacts under `mobile/artifacts/device-smoke/f26-blur/` (TS `20260812T083627Z`)
- **Status: BLOCKED COMPLETE (keyguard)** — multi SoftBlur **not PASS**
