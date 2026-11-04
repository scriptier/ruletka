# BLUR-F41 multi SoftBlur unlock-gate + device retry — RESULT

## Status
**BLOCKED COMPLETE (keyguard)** — Multi SoftBlur **device NOT claimed**.  
Unlock-gate failed: phone still on keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · AlternateBouncer / fingerprint).  
**Did not** thrash PIN/locksettings. **Did not** invent multi SoftBlur PASS.  
No Settings→Hold, no multi pair, no softNative/Sink evidence this hop.

## Gate (required before multi SoftBlur)

| Check | Result |
|-------|--------|
| Device adb exclusive | **PASS** — `-s 192.168.1.94:43343` only |
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
- Artifacts: `mobile/artifacts/device-smoke/f41-blur/`
- RESULT: this file; card `running/BLUR-F41-multi-soft-unlock-retry.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
Pixel 9 Pro (caiman) · wireless adb 192.168.1.94:43343
```
Evidence:
- `mobile/artifacts/device-smoke/f41-blur/20260812T101628Z-package.txt`
- `mobile/artifacts/device-smoke/f41-blur/package-version.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:5
```
Evidence: `20260812T101628Z-devices.txt` · `adb-devices.txt` · `devices-l.txt` · `20260812T101628Z-devices-final.txt`  
No dual-adb thrash. Port **43343** exclusive (not 42227).

## Keyguard evidence (gate FAIL → stop)

### Sample A — 2026-08-12T10:16:31Z (gate)
```
mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
mFocusedApp=ActivityRecord{206620534 u0 me.ruletka.app/.MainActivity t27064}
mShowingDream=false mDreamingLockscreen=true
isKeyguardShowing=true
mFocusedWindow=Window{556ee35 u0 AlternateBouncerView}
```
Evidence: `20260812T101628Z-keyguard.txt` · `keyguard-gate.txt`

### Sample B — reconfirm (~+30s) 2026-08-12T10:17:01Z
```
mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
mFocusedApp=… me.ruletka.app/.MainActivity t27064
mShowingDream=false mDreamingLockscreen=true
isKeyguardShowing=true
mFocusedWindow=AlternateBouncerView
KeyguardShowing=true AodShowing=false KeyguardGoingAway=false
mKeyguardShowing=true mAodShowing=false mKeyguardGoingAway=false
```
Evidence: `20260812T101628Z-keyguard-s2.txt` · `keyguard-reconfirm.txt`

### Sample C — reconfirm (~+41s) 2026-08-12T10:17:12Z
```
mCurrentFocus=Window{556ee35 u0 AlternateBouncerView}
mFocusedApp=… me.ruletka.app/.MainActivity …
mShowingDream=false mDreamingLockscreen=true
isKeyguardShowing=true
mWakefulness=Awake (power sample)
```
Evidence: `20260812T101628Z-keyguard-s3.txt` · power: `20260812T101628Z-power.txt` (`mWakefulness=Awake` / `mHoldingDisplaySuspendBlocker=true`)

### Screenshot
- Lock / AlternateBouncer (fingerprint path); screen awake; wireless ADB live.
- Files:
  - `mobile/artifacts/device-smoke/f41-blur/20260812T101628Z-keyguard.png`
  - `mobile/artifacts/device-smoke/f41-blur/20260812T101628Z-keyguard-s3.png`
  - Stable: `unlock-gate.png` · `block-keyguard-screen.png`
- Decision: `20260812T101628Z-gate-decision.txt` · `gate-decision.txt` → **BLOCKED**

### Credential
F17–F40 residual + bouncer UI: secure lock (PIN/fingerprint path).  
**No PIN in agent env. Did not** run `locksettings` clear/set or invent unlock.

## What was NOT done (by design)
1. No Settings → Hold chip taps (`Jusqu'à ce que je touche` / `Until I tap`)  
2. No `MODE=web2phone` / multi-pair run this hop  
3. No claim of peers≥2 / softNative / Sink / MULTI_PASS  
4. No product edits, no APK install, no force-push, no MediaSession/live.js thrash  
5. No PIN thrash / dual adb / pool ICE thrash (pool=0 forever)

## Continuity vs F17–F40
Same keyguard block class as F17–F40 unlock-gate retries: screen awake, wireless ADB live, package tip OK, but **human fingerprint/PIN** required before any multi SoftBlur device work. This hop is another honest **BLOCKED COMPLETE** — not a multi SoftBlur PASS. Mirrors F40 honesty.

## Human unblock (next hop)
1. Human unlock Pixel 9 Pro (fingerprint or PIN) while adb stays on **`192.168.1.94:43343`**.
2. Re-run multi SoftBlur unlock-gate (F42+): gate false → Settings Hold → `prefs_load mode=hold` → multi until `peers≥2` → claim PASS only if softNative=1 + ≥N Sink.

## Checklist
- [x] PATH + adb connect + exclusive `-s 192.168.1.94:43343`
- [x] Package **0.1.374+** confirmed (0.1.374 / vc382)
- [x] Gate `isKeyguardShowing` / `mDreamingLockscreen` → both **true** → BLOCK (3 samples)
- [x] dumpsys + screenshot artifacts under `f41-blur/`
- [x] Explicit non-claims table (no invent multi SoftBlur PASS)
- [x] RESULT COMPLETE status = **BLOCKED COMPLETE**
- [x] Card moved running → done
