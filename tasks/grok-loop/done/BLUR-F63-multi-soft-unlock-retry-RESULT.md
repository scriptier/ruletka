# BLUR-F63 multi SoftBlur unlock-gate + device retry — RESULT

## Status
**BLOCKED COMPLETE (keyguard)** — Multi SoftBlur **device NOT claimed**.  
Unlock-gate failed: phone still on keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · AOD/NotificationShade · Dozing).  
**Did not** thrash PIN/locksettings. **Did not** invent multi SoftBlur PASS.  
No Settings→Hold, no multi pair, no softNative/Sink evidence this hop.

Independent stamps this hop (all **BLOCKED**):
1. **20260812T131619Z** — multipoll (3× true) + dumpsys + package + trust + power + primary shot
2. **20260812T131641Z / 131643Z / 131645Z** — samples 1–3 unlock-gate (still true) + screenshots
3. **20260812T131650Z** — gate-final + UI keyguard dump + final screenshot
4. **20260812T131651Z** — multipoll reconfirm (3× true)
5. **20260812T131655Z** — gate-final reconfirm + final screenshot

## Gate (required before multi SoftBlur)

| Check | Result |
|-------|--------|
| Device adb exclusive | **PASS** — `-s 192.168.1.94:43343` only |
| Package tip | **PASS** — **0.1.374** / **vc382** (`lastUpdateTime=2026-08-12 00:34:14`) ≥ 0.1.374+ |
| Unlock gate `isKeyguardShowing` | **true** → **BLOCK** (all samples + multipoll + final) |
| Unlock gate `mDreamingLockscreen` | **true** → **BLOCK** (all samples + multipoll + final) |
| Focus | `NotificationShade` (systemui) · focused app under keyguard: `com.brave.browser` Main |
| Trust | `trustState=UNTRUSTED` · `deviceLocked=1` |
| Power | `mWakefulness=Dozing` · `mHoldingDisplaySuspendBlocker=false` · AOD (`AodShowing=true`) |
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
- Artifacts: `mobile/artifacts/device-smoke/f63-blur/`
- RESULT: this file; card `running/BLUR-F63-multi-soft-unlock-retry.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
firstInstallTime=2026-08-10 14:37:44
Pixel 9 Pro (caiman) · wireless adb 192.168.1.94:43343
```
Evidence:
- `mobile/artifacts/device-smoke/f63-blur/package-version-20260812T131619Z.txt`
- `mobile/artifacts/device-smoke/f63-blur/package-detail-20260812T131619Z.txt`
- `mobile/artifacts/device-smoke/f63-blur/package-times-20260812T131619Z.txt`
- `mobile/artifacts/device-smoke/f63-blur/package.txt`
- `mobile/artifacts/device-smoke/f63-blur/package-full-20260812T131619Z.txt`
- `mobile/artifacts/device-smoke/f63-blur/package-alt-20260812T131619Z.txt`
- `mobile/artifacts/device-smoke/f63-blur/packages-ruletka-20260812T131619Z.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:5
```
Evidence:
- `mobile/artifacts/device-smoke/f63-blur/adb-devices-20260812T131619Z.txt`
- `mobile/artifacts/device-smoke/f63-blur/devices-l.txt`  
No dual-adb thrash. Port **43343** exclusive.

## Keyguard evidence (gate FAIL → stop)

### Multipoll primary — 20260812T131619Z
```
=== multipoll ts_utc=20260812T131619Z serial=192.168.1.94:43343 ===
=== poll 1 13:16:20Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 2 13:16:21Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 3 13:16:23Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence: `keyguard-multipoll-20260812T131619Z.txt` · `keyguard-dumpsys-20260812T131619Z.txt` · `keyguard-state-multipoll.txt`

### Multipoll reconfirm — 20260812T131651Z
```
=== multipoll ts_utc=20260812T131651Z serial=192.168.1.94:43343 ===
=== poll 1 13:16:51Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 2 13:16:52Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 3 13:16:53Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence: `keyguard-multipoll-20260812T131651Z.txt`

### Samples 1–3 — 20260812T131641Z / 131643Z / 131645Z
```
sample=1 ts_utc=20260812T131641Z
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
    mCurrentFocus=NotificationShade
    mWakefulness=Dozing
sample=2 ts_utc=20260812T131643Z
    isKeyguardShowing=true · mDreamingLockscreen=true
sample=3 ts_utc=20260812T131645Z
    isKeyguardShowing=true · mDreamingLockscreen=true
```
Evidence:
- `unlock-gate-sample1-20260812T131641Z.txt` · `keyguard-blocked-sample1-20260812T131641Z.png`
- `unlock-gate-sample2-20260812T131643Z.txt` · `keyguard-blocked-sample2-20260812T131643Z.png`
- `unlock-gate-sample3-20260812T131645Z.txt` · `keyguard-blocked-sample3-20260812T131645Z.png`

### Focus / trust / activity / policy (20260812T131650Z + 131655Z)
```
mCurrentFocus=Window{… u0 NotificationShade}
mFocusedApp=ActivityRecord{… com.brave.browser/…Main t27065}
mKeyguardOccluded=false
isKeyguardShowing=true mDreamingLockscreen=true
AodShowing=true · KeyguardShowing=true
trustState=UNTRUSTED deviceLocked=1
mWakefulness=Dozing mHoldingDisplaySuspendBlocker=false
DECISION=BLOCKED
multi_softblur=NOT_CLAIMED
MULTI_PASS=NOT_CLAIMED
reason=isKeyguardShowing=true mDreamingLockscreen=true (human fingerprint/PIN required)
Hold=NOT_ATTEMPTED
prefs_load_mode_hold=NOT_CONFIRMED
peers=n/a softNative=0 Sink=0
```
Evidence:
- `gate-final-20260812T131650Z.txt` · `gate-decision.txt`
- `gate-final-20260812T131655Z.txt`
- `gate-meta-20260812T131650Z.txt` · `keyguard-gate-20260812T131650Z.txt`
- `window-focus-20260812T131619Z.txt` · `power-20260812T131619Z.txt`
- `trust-20260812T131619Z.txt` · `activity-keyguard-20260812T131619Z.txt`
- Shots: `keyguard-blocked-20260812T131619Z.png` · `keyguard-final-20260812T131650Z.png` · `keyguard-final-20260812T131655Z.png` · `keyguard-shot-20260812T131650Z.png` · `keyguard-final.png` · `keyguard.png` · `01-keyguard-gate.png`

### Screenshot + UI
- Lock / AOD (NotificationShade); device Dozing; wireless ADB live; Settings/app UI not reachable for Hold.
- PNG files under `mobile/artifacts/device-smoke/f63-blur/` (960×2142 RGBA; dark AOD frames ~12KB each):
  - `keyguard-blocked-20260812T131619Z.png`
  - `keyguard-blocked-sample1-20260812T131641Z.png`
  - `keyguard-blocked-sample2-20260812T131643Z.png`
  - `keyguard-blocked-sample3-20260812T131645Z.png`
  - `keyguard-final-20260812T131650Z.png` · `keyguard-final-20260812T131655Z.png` · `keyguard-final.png` · `keyguard.png`
  - `keyguard-shot-20260812T131650Z.png` · `01-keyguard-gate.png`
- UI hierarchy (keyguard/AOD):
  - `ui-keyguard-20260812T131647Z.xml` · `ui-keyguard.xml`
  - `ui-bouncer-ids-20260812T131647Z.txt` · `ui-bouncer-ids.txt` · `ui-bouncer-snippet.txt`
  - `com.android.systemui:id/keyguard_long_press` · notification/scrim stack present

### Credential
F17–F62 residual + keyguard/AOD UI: secure lock (PIN/fingerprint path).  
**No PIN in agent env. Did not** run `locksettings` clear/set or invent unlock.

## What was NOT done (by design)
1. No Settings → Hold chip taps (`Jusqu'à ce que je touche` / `Until I tap`)  
2. No `MODE=web2phone` / multi-pair run this hop  
3. No claim of peers≥2 / softNative / Sink / MULTI_PASS  
4. No product edits, no APK install, no force-push, no MediaSession/live.js thrash  
5. No PIN thrash / dual adb / pool ICE thrash (pool=0 forever)

## Continuity vs F17–F62
Same keyguard block class as F17–F62 unlock-gate retries: wireless ADB live, package tip OK (**0.1.374 / vc382**), but **human fingerprint/PIN** required before any multi SoftBlur device work.  
Delta vs F62: still **Dozing/AOD** + NotificationShade; gate still **true**.  
This hop is another honest **BLOCKED COMPLETE** — not a multi SoftBlur PASS. Mirrors F62 honesty style.

## Human unblock (next hop)
1. Human wake + unlock Pixel 9 Pro (fingerprint or PIN) while adb stays on **`192.168.1.94:43343`**.
2. Re-run multi SoftBlur unlock-gate (F64+): gate false → Settings Hold → `prefs_load mode=hold` → multi until `peers≥2` → claim PASS only if softNative=1 + ≥N Sink.

## Checklist
- [x] PATH + adb connect + exclusive `-s 192.168.1.94:43343`
- [x] Package **0.1.374+** confirmed (0.1.374 / vc382)
- [x] Gate `isKeyguardShowing` / `mDreamingLockscreen` → both **true** → BLOCK (samples + multipoll 3×2 + final)
- [x] dumpsys + screenshot artifacts under `f63-blur/`
- [x] Explicit non-claims table (no invent multi SoftBlur PASS)
- [x] RESULT COMPLETE status = **BLOCKED COMPLETE**
- [x] Card moved running → done
