# BLUR-F69 multi SoftBlur unlock-gate + device retry — RESULT

## Status
**BLOCKED COMPLETE (keyguard)** — Multi SoftBlur **device NOT claimed**.  
Unlock-gate failed: phone still on keyguard (`isKeyguardShowing=true` · `mDreamingLockscreen=true` · NotificationShade / AOD path · initially Dozing).  
**Did not** thrash PIN/locksettings. **Did not** invent multi SoftBlur PASS.  
No Settings→Hold, no multi pair, no softNative/Sink evidence this hop.

Pre-hop probe (~09:14 MDT) predicted `isKeyguardShowing=true` · Dozing · `deviceLocked=1` — **confirmed** at hop (~09:16 MDT). STOP gate ≥ ~09:08 MDT satisfied as once-hourly unlock recheck; still locked → short hop stop.

Independent stamps this hop (all **BLOCKED**):
1. **20260812T151610Z** — connect + package + dumpsys window/power/deviceidle/trust + dozing screenshot + KEYCODE_WAKEUP (no PIN) + after-wakeup screenshot
2. **20260812T151649Z** — compact keyguard-state (Awake after wakeup; keyguard still true)
3. **20260812T151650Z** — multipoll 3× reconfirm (`isKeyguardShowing=true` all polls)
4. **20260812T151654Z** — final reconfirm + trust (`deviceLocked=1`)

## Gate (required before multi SoftBlur)

| Check | Result |
|-------|--------|
| Device adb exclusive | **PASS** — `-s 192.168.1.94:43343` only |
| Package tip | **PASS** — **0.1.374** / **vc382** (`lastUpdateTime=2026-08-12 00:34:14`) ≥ 0.1.374+ |
| Unlock gate `isKeyguardShowing` | **true** → **BLOCK** (initial + after wakeup + multipoll + reconfirm) |
| Unlock gate `mDreamingLockscreen` | **true** → **BLOCK** (all samples) |
| Focus | `mCurrentFocus=NotificationShade` · focused app under keyguard: `com.brave.browser` Main |
| Trust | `trustState=UNTRUSTED` · `deviceLocked=1` · `isActiveUnlockRunning=0` |
| Power (initial) | `mWakefulness=Dozing` · `mScreenOn=false` · `mScreenLocked=true` |
| Power (after KEYCODE_WAKEUP only) | `mWakefulness=Awake` · `mScreenOn=true` · **keyguard still showing** (no unlock) |
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
| PIN / swipe / locksettings thrash | **NOT attempted** (WAKEUP keyevent only for clearer shot) |

## OWN
- Phone exclusive wireless adb: **`192.168.1.94:43343`**
- Partner helpers (`multi-pair.mjs` / `phone-web-pair.mjs`): **not used** (gate blocked)
- Artifacts: `mobile/artifacts/device-smoke/f69-blur/`
- RESULT: this file; card `running/BLUR-F69-multi-soft-unlock-retry.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
Pixel 9 Pro (caiman) · wireless adb 192.168.1.94:43343
```
Evidence:
- `mobile/artifacts/device-smoke/f69-blur/package-full-20260812T151610Z.txt`
- `mobile/artifacts/device-smoke/f69-blur/package-version-20260812T151610Z.txt`
- `mobile/artifacts/device-smoke/f69-blur/package.txt`
- `mobile/artifacts/device-smoke/f69-blur/20260812T151610Z-package.txt`

## ADB exclusive
```
List of devices attached
192.168.1.94:43343     device product:caiman model:Pixel_9_Pro device:caiman transport_id:5
```
Evidence:
- `mobile/artifacts/device-smoke/f69-blur/adb-devices-20260812T151610Z.txt`
- `mobile/artifacts/device-smoke/f69-blur/devices-l.txt`  
No dual-adb thrash. Port **43343** exclusive.

## Keyguard evidence (gate FAIL → stop)

### First connect — 20260812T151610Z (Dozing)
```
=== F69 keyguard gate 20260812T151610Z ===
device: 192.168.1.94:43343
UTC=2026-08-12T15:16:10Z
MDT=2026-08-12T09:16:10-0600
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
  mWakefulness=Dozing
  mHoldingDisplaySuspendBlocker=false
  mScreenOn=false
  mScreenLocked=true
  trustState=UNTRUSTED deviceLocked=1
```
Evidence: `20260812T151610Z-keyguard-window.txt` · `20260812T151610Z-power.txt` · `20260812T151610Z-deviceidle.txt` · `20260812T151610Z-trust.txt` · `20260812T151610Z-keyguard-gate.png` (dozing/blackish)

### After KEYCODE_WAKEUP only (no PIN) — still locked
```
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
  mWakefulness=Awake
  mCurrentFocus=Window{... NotificationShade}
  mFocusedApp=... com.brave.browser/...Main ...
  trustState=UNTRUSTED deviceLocked=1
  mScreenOn=true
  mScreenLocked=true
```
Evidence: `20260812T151610Z-keyguard-after-wakeup.txt` · `20260812T151610Z-keyguard-after-wakeup.png` · `keyguard-blocked.png` · `01-keyguard-gate.png` · `keyguard-state-20260812T151610Z.txt`

### Multipoll reconfirm — 20260812T151650Z
```
=== multipoll reconfirm ts_utc=20260812T151650Z serial=192.168.1.94:43343 ===
=== poll 1 15:16:50Z ===
    mShowingDream=false mDreamingLockscreen=true
    isKeyguardShowing=true
=== poll 2 15:16:51Z ===
    isKeyguardShowing=true · mDreamingLockscreen=true
=== poll 3 15:16:52Z ===
    isKeyguardShowing=true · mDreamingLockscreen=true
```
Evidence: `keyguard-multipoll-20260812T151610Z.txt` · `keyguard-reconfirm-20260812T151610Z.txt`

## Gate decision (verbatim)
```
TS=20260812T151610Z
SERIAL=192.168.1.94:43343
KEYGUARD_LINE:     isKeyguardShowing=true
DREAM_LINE:     mShowingDream=false mDreamingLockscreen=true
WAKE_LINE_INITIAL:   mWakefulness=Dozing (pre-wakeup sample)
WAKE_LINE_AFTER_KEYCODE_WAKEUP: mWakefulness=Awake (screen on; keyguard STILL showing — no PIN)
TRUST: trustState=UNTRUSTED deviceLocked=1
DECISION=BLOCKED
REASON=isKeyguardShowing=true AND mDreamingLockscreen=true (no unlock thrash; no Hold; no multi SoftBlur)
MULTI_SOFTBLUR_PASS=NOT_CLAIMED
MULTI_PASS=NOT_CLAIMED
PACKAGE=me.ruletka.app versionName=0.1.374 versionCode=382
```
Evidence: `gate-decision.txt` · `gate-decision-20260812T151610Z.txt` · `gate-final-20260812T151610Z.txt`

## What was NOT done (must-not honored)
- No `locksettings` / PIN / swipe unlock thrash (only `KEYCODE_WAKEUP` for screenshot clarity)
- No multi SoftBlur PASS invent / MULTI_PASS invent
- No APK build or install
- No product code edits
- No `iceCandidatePoolSize` / pool thrash (pool remains 0 policy)
- No dual adb; exclusive serial only
- No force-push / deploy

## Continuity
- Prior **F68** same serial **43343** · package **0.1.374-vc382** · BLOCKED keyguard (NotificationShade/AOD/Dozing) ~14:06–14:07 UTC
- **F69** once-hourly recheck (~15:16 UTC / ~09:16 MDT): still BLOCKED; chain **F17–F69** keyguard open for multi SoftBlur device
- Multi SoftBlur device remains **OPEN / NOT claimed** until human unlock + Hold + peers≥2 + softNative=1 + Sink evidence

## Artifacts root
`mobile/artifacts/device-smoke/f69-blur/`

## Card disposition
`tasks/grok-loop/running/BLUR-F69-multi-soft-unlock-retry.md` → `tasks/grok-loop/done/`
