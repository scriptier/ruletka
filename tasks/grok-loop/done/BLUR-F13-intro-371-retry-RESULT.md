# BLUR-F13 Intro residual retry on 0.1.371 — RESULT

## Status
**BLOCKED** (honest COMPLETE) — `adb devices` empty; no phone attached. **No invent Intro PASS.**

## Gate
| Check | Result |
|-------|--------|
| `adb devices -l` | **empty** — `List of devices attached` then blank |
| `adb get-state` | `error: no devices/emulators found` |
| USB Google/Android/Pixel | **none** in `lsusb` |
| dmesg residual | prior `usb 1-12: USB disconnect, device number 82` (from F12 hop) |
| Capture ts (UTC) | **20260812T055716Z** |
| Product edits | **none** (read-only) |
| Force-push | **none** |

## OWN
- Phone exclusive one adb (none present — no dual adb)
- RESULT: this file; card `running/BLUR-F13-intro-371-retry.md` → `done/`
- Read-only product
- Intro only residual after F12 Off PASS + USB drop

## Device check (authoritative)
```
adb version: 1.0.41 / 37.0.1-15733141
Installed as /home/drakosik/Android/Sdk/platform-tools/adb

=== adb devices -l ===
List of devices attached

=== adb get-state ===
error: no devices/emulators found

=== lsusb (Google/Android/Pixel filter) ===
(no matching USB device lines)
```

Full capture: `mobile/artifacts/device-smoke/f13-blur/device-absent-20260812T055716Z.txt`  
Latest pointer: `mobile/artifacts/device-smoke/f13-blur/device-absent-latest.txt`

## Smoke runs

### Intro + match on 0.1.371 — **BLOCKED (no device)**
| Field | Value |
|-------|--------|
| Package confirm 0.1.371 / vc379 | **not re-checked this hop** (device absent; last known F11/F12: 0.1.371-vc379) |
| Settings → **Bref (~2,5 s)** / Intro | **not applied** — no adb |
| Match / show→intro_auto | **not exercised** |
| softNative=1 + Sink attached | **not exercised** |
| logcat intro path | **none captured** |

**Cannot invent:** Intro PASS requires live logcat `prefs_load mode=intro` + `[blur] show … mode=intro` → `hide why=intro_auto` + `softNative=1` + SoftBlur Sink. Device absent → not claimed.

## Prior chain (context only — not re-invented)

| Hop | Claim | Status |
|-----|-------|--------|
| **F11** | Hold on **0.1.371-vc379** | **PASS** — `BLUR-F11-apk-resmoke-RESULT.md` |
| **F12** | Off on **0.1.371** | **PASS** — `BLUR-F12-off-intro-371-RESULT.md` |
| **F12** | Intro on **0.1.371** | **BLOCKED** (USB disconnect mid-hop) |
| **F8** | Intro on **0.1.368** only | **PASS** on 368 — **not** tip 371 |
| **F13** (this) | Intro retry on **0.1.371** | **BLOCKED** (device still absent) |

## Verdict table

| Claim | Result | Evidence |
|-------|--------|----------|
| Device present for F13 | **FAIL / absent** | `adb devices` empty; no Google/Android `lsusb` |
| Package **0.1.371 / vc379** reconfirm | **BLOCKED** | no dumpsys without device |
| Settings → Intro (Brief) applied | **BLOCKED** | no device |
| Intro: show then peel (`hide why=intro_auto`) | **BLOCKED** | no device — **not invented** |
| Intro softNative=1 + Sink during privacy | **BLOCKED** | no device — **not invented** |
| Hold mode on 0.1.371 | **PASS (F11 only)** | not re-run; see F11 RESULT |
| Off mode on 0.1.371 | **PASS (F12 only)** | not re-run; see F12 RESULT |
| Multi-party SoftBlur | **NOT claimed** | 1v1 path not even reachable |
| Force-push / product edits | **none** | device probe + RESULT only |

## Paths

| Artifact | Path |
|----------|------|
| Device-absent capture | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f13-blur/device-absent-20260812T055716Z.txt` |
| Latest pointer | `…/f13-blur/device-absent-latest.txt` |
| F11 Hold baseline | `tasks/grok-loop/done/BLUR-F11-apk-resmoke-RESULT.md` |
| F12 Off PASS + Intro residual | `tasks/grok-loop/done/BLUR-F12-off-intro-371-RESULT.md` |
| F8 Intro (0.1.368 only) | `tasks/grok-loop/done/BLUR-F8-off-intro-smoke-RESULT.md` |

## Explicit non-claims
- **No invent Intro PASS** on 0.1.371 (device empty — task step 1 → BLOCKED COMPLETE)
- **No invent package confirm** this hop
- **No multi SoftBlur PASS**
- **No re-claim Hold** (F11) or **Off** (F12)
- **No dual adb**, **no force-push**, **no product code edits**

## Residual / next hop
1. Re-attach Pixel 9 Pro USB (serial **45141FDAP0004F** from F11/F12).
2. `adb devices` → serial present; exclusive one adb.
3. Confirm package `versionName=0.1.371` `versionCode=379`.
4. Settings → **Bref (~2,5 s)** → toast Intro / Brief.
5. Match + web-pair → require `prefs_load mode=intro` + `[blur] show … mode=intro` → `hide why=intro_auto` + `softNative=1` + Sink attached.
6. Artifacts under `mobile/artifacts/device-smoke/f13-blur/intro-*`.
7. Still do **not** invent multi SoftBlur; Hold=F11; Off=F12.

## Done criteria
- [x] `adb devices` — empty → **BLOCKED** honest COMPLETE
- [ ] Package 0.1.371/379 confirm — **BLOCKED no device**
- [ ] Settings Intro/Brief → match → intro_auto + softNative=1 + Sink — **BLOCKED no device**
- [x] Artifacts `mobile/artifacts/device-smoke/f13-blur/` (device-absent capture)
- [x] Multi SoftBlur NOT claimed; Hold=F11; Off=F12 (not re-claimed)
- [x] RESULT written; card → done; **no invent Intro PASS**
