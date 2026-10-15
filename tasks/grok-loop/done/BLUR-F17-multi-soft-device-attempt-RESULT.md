# BLUR-F17 multi SoftBlur device attempt — RESULT

## Status
**BLOCKED / partial COMPLETE** — Multi SoftBlur **device NOT claimed**.  
Honest attempt: wireless adb exclusive + package tip + `MODE=web2phone` find-3rd hunt scaffold + locked-phone join tries. **No `peers≥2` on phone**, **no multi `softNative`**, **no multi SoftBlur Sink**. **Never invent multi SoftBlur PASS.**

## Gate
| Check | Result |
|-------|--------|
| Device adb | **PASS (rotated serial)** — card `-s 192.168.1.94:42227` **refused**; live TLS **`192.168.1.94:43343`** via mdns `adb-45141FDAP0004F…_adb-tls-connect` |
| Package tip | **PASS** — **0.1.374** / **vc382** (`lastUpdateTime=2026-08-12 00:34:14`) |
| Soft product source | **ON** (`SOFT_BLUR_PRODUCT_ENABLED = true` in `SoftBlurRemote.tsx`) — read-only |
| Hold privacy setup this hop | **BLOCKED** — Settings UI unreachable (keyguard PIN + NotificationShade) |
| Multi SoftBlur device (`peers≥2` + softNative) | **NOT claimed** |
| Product code edits / force-push | **none** |

## OWN
- Phone exclusive wireless adb (serial **43343** after port rotate)
- Optional multi-pair / phone-web-pair as partner helpers
- RESULT: this file; card `running/BLUR-F17-multi-soft-device-attempt.md` → `done/`
- Read-only product

## Package confirm
```
me.ruletka.app  versionName=0.1.374  versionCode=382
lastUpdateTime=2026-08-12 00:34:14
Pixel 9 Pro (caiman)
```

## Blockers (honest)

### 1) Wireless adb port rotate
- Start-of-hop: `192.168.1.94:42227` **Connection refused**
- Reconnect: `adb connect 192.168.1.94:43343` → **device**
- Exclusive serial used: **`192.168.1.94:43343`**

### 2) Keyguard PIN — UI smoke impossible
| Observation | Evidence |
|-------------|----------|
| `isKeyguardShowing=true` · `mDreamingLockscreen=true` | `f17-blur/block-keyguard-state.txt` |
| `CredentialType: PIN` | same |
| Focus | `AlternateBouncerView` / `NotificationShade` (not app chrome) |
| Screenshots | lock + media widget + “Wireless debugging connected” fingerprint pad — `block-keyguard-screen.png`, `locked-attempt-…/01-after-deeplink.png` |
| UIAutomator | only `com.android.systemui` nodes; no privacy chips |
| Hold chip taps | **FAIL** both `Jusqu'à ce que je touche` and `Until I tap` (`hold-setup.log`) |

No PIN in repo / agent env. **Did not** thrash `locksettings` or invent unlock.

### 3) Last known privacy mode (prior hops — not this hop)
F16 residual left device on **intro** (not Hold):

```
# f16-blur intro smokes
prefs_load mode=intro
```

F15 Hold (`mode=hold`) is older; F16 Off then Intro superseded for device prefs. **This hop could not re-apply Hold.**

## Attempts

### A) Hold setup
| Step | Result |
|------|--------|
| `ruletka://settings` + scroll privacy chips | **FAIL** — systemui-only dump / black or shade / keyguard |
| `prefs_load mode=hold` this hop | **0×** in phone logcat |

Artifacts: `mobile/artifacts/device-smoke/f17-blur/hold-setup-*.xml|png`, `hold-setup.log`

### B) `MODE=web2phone` multi-pair + phone as 3rd (primary multi attempt)
| Field | Value |
|-------|--------|
| When | `2026-08-12T07:13:00Z` window (~120s budget) |
| Bundle | `mobile/artifacts/device-smoke/f17-blur/multi-web2phone-20260812T071300Z/` |
| Command | `MODE=web2phone FIND_THIRD=1 BUDGET_MS=120000 CHROME=/usr/bin/chromium node scripts/multi-pair.mjs` |
| Exit | **0** · **`SCAFFOLD_DONE (not MULTI_PASS)`** |

**Web harness observed (honest):**

```json
{
  "mode": "web2phone",
  "budget_ms": 120000,
  "find_third_enabled": true,
  "observed": {
    "boot": true,
    "pair_1v1_hint": true,
    "find_third_invite_sent": true,
    "find_third_accept_ui": true,
    "hunt_ui_hint": true,
    "multi_pc_hint": false,
    "third_tile_hint": false
  },
  "honesty": "SCAFFOLD_DONE only — not multi product PASS; human faces still required for GOAL_MET"
}
```

Timeline (selected):
| UTC | Event |
|-----|--------|
| 07:13:22 | MultiA↔MultiB `pair_1v1_hint` · iceOk+frames · pcCount=1 |
| 07:13:25 | MultiA find-third invite (`btn-find-third`) |
| 07:13:26 | MultiB accept (`btn-find-third-yes`) → hunt |
| 07:13:56→07:15:12 | both `hunt_ui_hint` · stageTrioSearching · **pcCount=1** (hunt ≠ multi tile) |
| 07:15:16 | both **pcCount=2** briefly (“In a call”) while still hunt_ui — **not** phone SoftBlur evidence |
| 07:15:20 | SUMMARY · SCAFFOLD_DONE |

**Phone during B (same logcat):**
| Signal | Count |
|--------|------:|
| `prefs_load` | **0** |
| `[match]` | **0** |
| `peers=` | **0** |
| `softNative=1` | **0** |
| `SoftBlurVideoView: Sink attached` | **0** |
| max_peers (phone) | **0** |

Phone stayed on **keyguard**; deeplink Start / join-as-3rd UI not operable.  
**multiRemote SoftBlur on device = not exercised.**

### C) Locked phone + WebPair 1v1 retry
| Field | Value |
|-------|--------|
| Bundle | `mobile/artifacts/device-smoke/f17-blur/locked-attempt-20260812T071504Z/` |
| Partner | `phone-web-pair.mjs` |
| Screen | still lock + wireless-debug notification |
| `prefs_load` / match / softNative / Sink / peers | **all 0** |

## Verdict table

| Claim | Result | peers | softNative evidence |
|-------|--------|------:|---------------------|
| Adb exclusive usable (wireless) | **PASS** (serial **43343**) | — | — |
| Package tip on device | **PASS 0.1.374/vc382** | — | — |
| Settings → Hold this hop | **BLOCKED** (PIN keyguard) | — | **0×** prefs_load hold |
| Web multi-pair find-3rd scaffold | **SCAFFOLD_DONE** (invite+accept+hunt) | web pcCount 1→2 end | n/a (web, not SoftBlur native) |
| Phone multi match `peers≥2` | **NOT observed** | **0** (phone) | — |
| multiRemote SoftBlur tiles | **NOT claimed** | **0** | **0× softNative=1** · **0× Sink** |
| Multi SoftBlur device PASS | **NOT claimed** | need ≥2 | need softNative/Sink per remote |
| MULTI_PASS / multi GOAL_MET | **NOT claimed** | — | harness ≠ product PASS |
| Product edits / force-push | **none** | — | — |

## Explicit non-claims
- **No multi SoftBlur PASS** (requires phone `peers≥2` + softNative/Sink on multi tiles)
- **No invent softNative** from web hunt or prior 1v1 F11/F15 evidence
- **No invent Hold this hop** (could not set; last F16 device mode was **intro**)
- **No invent MULTI_PASS** — multi-pair exit 0 is scaffold only
- Hunt UI (`hunt_ui_hint`) **≠** multi SoftBlur (F9/L26: multiRemote only real 2+ remotes)
- Card serial `42227` superseded by live **`43343`** (document only; same phone)

## Residual (for next hop when phone unlocked)
1. Human unlock PIN · keep screen unlocked for smoke window  
2. Settings → Hold → confirm `prefs_load mode=hold`  
3. `MODE=web2phone` (or phone 1v1 + find-3rd) until phone log shows `peers≥2`  
4. Expect stage `softNative=1` + **≥N** `SoftBlurVideoView: Sink attached` for N remotes  
5. Only then consider multi SoftBlur device PASS — still not MULTI_PASS without human faces GOAL_MET

## Paths

| Artifact | Path |
|----------|------|
| Meta / package | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/f17-blur/meta-device.txt` |
| Keyguard block | `…/f17-blur/block-keyguard-state.txt` · `block-keyguard-screen.png` |
| Hold setup fail | `…/f17-blur/hold-setup.log` · `hold-setup-*.png` |
| Multi web2phone | `…/f17-blur/multi-web2phone-20260812T071300Z/` (`multi-pair.log`, phone `logcat-full.txt`, `metrics.json`) |
| Locked 1v1 try | `…/f17-blur/locked-attempt-20260812T071504Z/` |
| Helper script | `…/f17-blur/run-f17-multi-soft-attempt.sh` |
| Prior Hold 1v1 | `tasks/grok-loop/done/BLUR-F15-hold-soft-reconfirm-RESULT.md` (`peers=1`) |
| Multi soft plan | `tasks/grok-loop/done/L26-multi-soft-device-plan-RESULT.md` |
| Static multi wiring | `tasks/grok-loop/done/BLUR-F16-multi-soft-static-RESULT.md` |

## Connect risk
**None** product — read-only SoftBlur/media; adb smoke only. No ICE thrash, no force-push, no APK install.

## COMPLETE
**COMPLETE (honest BLOCKED / partial).** Multi SoftBlur device remains **OPEN / NOT claimed**.  
Web find-3rd scaffold observed; **phone max_peers=0**, **softNative multi=none**. **No invent multi SoftBlur PASS.**
