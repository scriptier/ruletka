# L28-unit-verify — RESULT

## Status
**COMPLETE** — **PASS**

## OWN
- Run `./scripts/dev-smoke.sh --unit` + `node mobile/scripts/verify-match-ux.mjs`
- Optional one cheap test fix only if trivial fail
- **No invent blur PASS** (static L0 only)
- **No invent multi PASS / GOAL_MET**
- **No adb / no APK / no MediaSession thrash**

## Goal
L0 pure unit gate + L0 match-ux static invariants. Report exit codes and counts honestly.

## Source
- Root: `/home/drakosik/freenet-roulette`
- At: **2026-08-12T06:26:40Z**
- Git HEAD (short): **a0d195d**
- No product / test-file edits (verify-only hop)

---

## 1) `./scripts/dev-smoke.sh --unit`

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **exit** | **0** |
| **banner** | `=== dev-smoke PASS (unit only) ===` |
| **time** | `2026-08-12T06:26:30Z` |

### Pass list
| Step | Result |
|------|--------|
| test-connect-ui | **PASS** |
| test-friend-invite | **PASS** (all friend-invite tests passed) |
| test-geo-localize | **PASS** |
| unit callMetrics.test.mjs | **PASS** |
| unit connectSteps.test.mjs | **PASS** |
| unit hubLobby.test.mjs | **PASS** |
| unit matchContinuity.test.mjs | **PASS** |
| unit matchPeers.test.mjs | **PASS** |
| unit partnerIdentityDisplay.test.mjs | **PASS** |
| unit stageStreams.test.mjs | **PASS** |
| unit blurMode.test.mjs | **PASS** |
| unit giftFxHold.test.mjs | **PASS** |
| **overall** | **PASS (unit only) EXIT 0** |

**Count:** 12/12 steps green, exit 0.

---

## 2) `node mobile/scripts/verify-match-ux.mjs`

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **exit** | **0** |
| **oks** | **30** |
| **fails** | **0** |
| **scope** | L0 static only (no device smoke, no av-verify product claim) |

### Full console output

```text
=== L0 match-ux static ===
  OK  showStagePartnerHud off (single identity surface)
  OK  eye blur wired (onToggleBlur → togglePartnerBlur)
  OK  single PartnerIdentityDock, no matched PartnerChrome
  OK  PartnerIdentityDock formatLocLine omitFlag: true
  OK  dock name has no flag-emoji prefix
  OK  formatLocLine accepts omitFlag
  OK  partnerIdentityTopStrip transparent / light frost
  OK  LiveStageVideo partnerFlagChip (single stage flag)
  OK  blur: PartnerBlurVeil on privacy path
  OK  blur: path present
  OK  blur: multi-remote keeps RTC under veil
  OK  blur: multi/1v1 veil uses zOrder 0 + blurCoverElevated
  OK  blur: multi A5 veil on all remote tiles (idx>0) + z0 + elev shell
  OK  prefs: blur-ux-intro-v* off→intro one-shot
  OK  prefs: default blurStrangersMode is hold
  OK  no always-on Android chrome Modal on match
  OK  Android privacy Modal only while showPrivacyBlur
  OK  blur logs: [blur] show/hide why=
  OK  match: stranger wantBlur for intro/hold
  OK  eye toggle sets remoteBlurred
  OK  autostart: spin path + idle retry @500ms
  OK  displayPartnerStars helper exists
  OK  PartnerChrome uses stars/trust display (not spendable-only wall)
  OK  LiveStageVideo stage ★ uses max/spendable+trust path
  OK  BrandWatermark.tsx exports BrandWatermark
  OK  LiveStageVideo imports + mounts BrandWatermark
  OK  LiveBottomBar live-blur-btn + onToggleBlur
  OK  ui/live.html cache-bust live.js?v=572 webrtc.js?v=315
  OK  ui/live.js has hop9 stuck-offer recovery markers
  OK  MediaSession hasRemoteSdp uses real remote SDP (not latch alone)
L0 done: 30 ok, 0 fail
```

### Check groups (30 PASS)

#### Identity surface
| Check | Result |
|-------|--------|
| `showStagePartnerHud` off | PASS |
| `onToggleBlur` → `togglePartnerBlur` | PASS |
| Single `PartnerIdentityDock`, no matched `PartnerChrome` | PASS |
| Dock `formatLocLine({ omitFlag: true })` | PASS |
| Dock name has no flag-emoji prefix | PASS |
| `formatLocLine` accepts `omitFlag` | PASS |
| `partnerIdentityTopStrip` transparent / light frost | PASS |
| Stage single `partnerFlagChip` | PASS |

#### Privacy blur (static wiring only)
| Check | Result |
|-------|--------|
| `PartnerBlurVeil` on privacy path | PASS |
| Blur path present / keep RTC under veil | PASS |
| Multi-remote keeps RTC under veil | PASS |
| Multi/1v1 veil: `zOrder 0` + `blurCoverElevated` | PASS |
| Multi A5: veil on all remote tiles (idx>0) + z0 + elev | PASS |
| Prefs blur-ux-intro-v* off→intro one-shot | PASS |
| Default `blurStrangersMode` is **hold** | PASS |
| No always-on Android chrome Modal on match | PASS |
| Android privacy Modal only while `showPrivacyBlur` | PASS |
| `[blur] show/hide why=` logs | PASS |
| Stranger match wantBlur for intro/hold | PASS |
| Eye toggle sets `remoteBlurred` | PASS |
| `LiveBottomBar` `live-blur-btn` + `onToggleBlur` | PASS |

#### Stars / brand / autostart / web / MediaSession
| Check | Result |
|-------|--------|
| Autostart spin path + idle retry @500ms | PASS |
| `displayPartnerStars` helper exists | PASS |
| PartnerChrome stars/trust display | PASS |
| LiveStageVideo stage ★ max/spendable+trust | PASS |
| `BrandWatermark` export + stage import/mount | PASS |
| `ui/live.html` cache-bust `live.js?v=572` `webrtc.js?v=315` | PASS |
| `ui/live.js` hop9 stuck-offer recovery markers | PASS |
| MediaSession `hasRemoteSdp` uses real remote SDP (not latch alone) | PASS |

---

## What landed
- Re-run only. Both harnesses green on first try.
- No test failures → no cheap test fix applied.
- No product code edits; no invent blur/multi PASS.

## Files touched
- none (verify-only)
- Card: `tasks/grok-loop/running/L28-unit-verify.md` → `tasks/grok-loop/done/L28-unit-verify.md`
- RESULT: `tasks/grok-loop/done/L28-unit-verify-RESULT.md`

## Connect risk
**None** — unit + static L0 only. No ICE thrash surface, no MediaSession rewrite, no deploy, no adb.

## Not claimed
- No device / adb match smoke PASS
- No av-verify product PASS / multi PASS / GOAL_MET
- No blur **product** (faces-on-device) PASS — static veil wiring only
- No APK rebuild / deploy
- No invent eye-toggle / dual-flag on-device PASS

## COMPLETE or BLOCKED
**COMPLETE** — both gates PASS

| Harness | Exit | Counts |
|---------|------|--------|
| `./scripts/dev-smoke.sh --unit` | **0** | 12/12 steps PASS |
| `node mobile/scripts/verify-match-ux.mjs` | **0** | **30 ok, 0 fail** |
