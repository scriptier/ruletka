# BLUR-F65 multi SoftBlur unlock-gate + device retry — RESULT

## Status
**BLOCKED COMPLETE (keyguard)** — Multi SoftBlur **device NOT claimed**.  
Unlock-gate failed: phone still on keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · AOD/NotificationShade · Dozing).  
**Did not** thrash PIN/locksettings. **Did not** invent multi SoftBlur PASS.  
No Settings→Hold, no multi pair, no softNative/Sink evidence this hop.

Independent stamps this hop (all **BLOCKED**):
1. **20260812T133603Z** — primary dumpsys + screenshot + adb devices + window policy + package full
2. **20260812T133604Z** — multipoll (3× true) + keyguard-state-multipoll
3. **20260812T133607Z / 133609Z / 133611Z** — samples 1–3 unlock-gate (still true) + screenshots · focus/power/trust
4. **20260812T133613Z** — gate-final + DECISION=BLOCKED + final screenshot
5. **20260812T133614Z** — multipoll reconfirm (3× true)

## Gate (required before multi SoftBlur)

| Check | Result |
|-------|--------|
| Device adb exclusive | **PASS** — `-s 192.168.1.94:43343` only |
| Package tip | **PASS** — **0.1.374** / **vc382** (`lastUpdateTime=2026-08-12 00:34:14`) ≥ 0.1.374+ |
| Unlock gate `isKeyguardShowing` | **true** → **BLOCK** (all samples + multipoll + final) |
| Unlock gate `mDreamingLockscreen` | **true** → **BLOCK** (all samples + multipoll + final) |
| Focus | `NotificationShade` (systemui) · focused app under keyguard: `com.brave.browser` Main |
| Trust | `trustState=UNTRUSTED` · `deviceLocked=1` |
| Power | `mWakefulness=Dozing` · `mHoldingDisplaySuspendBlocker=false` · AOD/lock path |
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
- Artifacts: `mobile/artifacts/device-smoke/f65-blur/`
- RESULT: this file; card `running/BLUR-F65-multi-soft-unlock-retry.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
firstInstallTime=2026-08-10 14:37:44
Pixel 9 Pro (caiman) · wireless adb 192.168.1.94:43343
```
Evidence:
- `mobile/artifacts/device-smoke/f65-blur/package-full-20260812T133603Z.txt`
- `mobile/artifacts/device-smoke/f65-blur/package-version-20260812T133603Z.txt`
- `mobile/artifacts/device-smoke/f65-blur/package-detail-20260812T133603Z.txt`
- `mobile/artifacts/device-smoke/f65-blur/package.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:5
```
Evidence:
- `mobile/artifacts/device-smoke/f65-blur/adb-devices-20260812T133603Z.txt`
- `mobile/artifacts/device-smoke/f65-blur/devices-l.txt`  
No dual-adb thrash. Port **43343** exclusive.

## Keyguard evidence (gate FAIL → stop)

### Multipoll primary — 20260812T133604Z
```
=== multipoll ts_utc=20260812T133604Z serial=192.168.1.94:43343 ===
=== poll 1 13:36:04Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 2 13:36:05Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 3 13:36:06Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence: `keyguard-multipoll-20260812T133604Z.txt` · `keyguard-dumpsys-20260812T133603Z.txt` · `keyguard-state-multipoll.txt`

### Multipoll reconfirm — 20260812T133614Z
```
=== multipoll reconfirm ts_utc=20260812T133614Z serial=192.168.1.94:43343 ===
=== poll 1 13:36:14Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 2 13:36:15Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 3 13:36:17Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
```
Evidence: `keyguard-multipoll-20260812T133614Z.txt`

### Samples 1–3 — 20260812T133607Z / 133609Z / 133611Z
```
sample=1 ts_utc=20260812T133607Z
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
    mCurrentFocus=NotificationShade
    mWakefulness=Dozing
    trustState=UNTRUSTED deviceLocked=1
sample=2 ts_utc=20260812T133609Z
    isKeyguardShowing=true · mDreamingLockscreen=true
sample=3 ts_utc=20260812T133611Z
    isKeyguardShowing=true · mDreamingLockscreen=true
```
Evidence:
- `unlock-gate-sample1-20260812T133607Z.txt` · `keyguard-blocked-sample1-20260812T133607Z.png`
- `unlock-gate-sample2-20260812T133609Z.txt` · `keyguard-blocked-sample2-20260812T133609Z.png`
- `unlock-gate-sample3-20260812T133611Z.txt` · `keyguard-blocked-sample3-20260812T133611Z.png`

### Focus / trust / activity / policy (20260812T133607Z + 133613Z)
```
mCurrentFocus=Window{… u0 NotificationShade}
mFocusedApp=ActivityRecord{… com.brave.browser/…Main t27065}
mKeyguardOccluded=false
isKeyguardShowing=true mDreamingLockscreen=true
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
- `gate-final-20260812T133603Z.txt` · `gate-final-20260812T133613Z.txt`
- `gate-decision.txt`
- `window-policy-20260812T133603Z.txt`
- Shots: `keyguard-screenshot-20260812T133603Z.png` · `keyguard-final-20260812T133613Z.png` · `keyguard-final.png` · `keyguard.png` · `01-keyguard-gate.png` · `keyguard-blocked.png`

### Screenshot + UI
- Lock / AOD (NotificationShade); device Dozing; wireless ADB live; Settings/app UI not reachable for Hold.
- PNG files under `mobile/artifacts/device-smoke/f65-blur/` (dark AOD frames ~12KB each):
  - `keyguard-screenshot-20260812T133603Z.png`
  - `keyguard-blocked-sample1-20260812T133607Z.png`
  - `keyguard-blocked-sample2-20260812T133609Z.png`
  - `keyguard-blocked-sample3-20260812T133611Z.png`
  - `keyguard-final-20260812T133613Z.png` · `keyguard-final.png` · `keyguard.png`
  - `01-keyguard-gate.png` · `keyguard-blocked.png`

### Credential
F17–F64 residual + keyguard/AOD UI: secure lock (PIN/fingerprint path).  
**No PIN in agent env. Did not** run `locksettings` clear/set or invent unlock.

## What was NOT done (by design)
1. No Settings → Hold chip taps (`Jusqu'à ce que je touche` / `Until I tap`)  
2. No `MODE=web2phone` / multi-pair run this hop  
3. No claim of peers≥2 / softNative / Sink / MULTI_PASS  
4. No product edits, no APK install, no force-push, no MediaSession/live.js thrash  
5. No PIN thrash / dual adb / pool ICE thrash (pool=0 forever)

## Continuity vs F17–F64
Same keyguard block class as F17–F64 unlock-gate retries: wireless ADB live, package tip OK (**0.1.374 / vc382**), but **human fingerprint/PIN** required before any multi SoftBlur device work.  
Delta vs F64: still **Dozing/AOD** + NotificationShade; gate still **true** (no unlock between hops).  
This hop is another honest **BLOCKED COMPLETE** — not a multi SoftBlur PASS. Mirrors F64 honesty style.

## Human unblock (next hop)
1. Human wake + unlock Pixel 9 Pro (fingerprint or PIN) while adb stays on **`192.168.1.94:43343`**.
2. Re-run multi SoftBlur unlock-gate (F66+): gate false → Settings Hold → `prefs_load mode=hold` → multi until `peers≥2` → claim PASS only if softNative=1 + ≥N Sink.

## Checklist
- [x] PATH + adb connect + exclusive `-s 192.168.1.94:43343`
- [x] Package **0.1.374+** confirmed (0.1.374 / vc382)
- [x] Gate `isKeyguardShowing` / `mDreamingLockscreen` → both **true** → BLOCK (samples + multipoll + final)
- [x] dumpsys + screenshot artifacts under `f65-blur/`
- [x] Explicit non-claims table (no invent multi SoftBlur PASS)
- [x] RESULT COMPLETE status = **BLOCKED COMPLETE**
- [x] Card moved running → done
