# L64-unit-verify — RESULT

## Status
**COMPLETE** — **PASS** (unit + L0 match-ux static only)

## OWN
- Run `./scripts/dev-smoke.sh --unit`
- Run `node mobile/scripts/verify-match-ux.mjs`
- RESULT under `tasks/grok-loop/done/` only
- No product code edits
- No SoftBlur/MediaSession thrash, force-push, APK, adb, live.js dual-write
- **No invent multi product PASS / GOAL_MET**
- **No invent blur product PASS** (static L0 only)

## Goal
L0 pure unit gate + L0 match-ux static invariants. Report exits + checks honestly.

## Source
- Root: `/home/drakosik/freenet-roulette`
- Git HEAD (short): **a0d195d** (`main...origin/main`)
- At: **2026-08-12T11:55:55Z**
- Logs: `/tmp/l64-unit.log`, `/tmp/l64-verify-match-ux.log`

---

## 1) `./scripts/dev-smoke.sh --unit`

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **exit** | **0** |
| **banner** | `=== dev-smoke PASS (unit only) ===` |
| **scope** | unit only (no device / no av-verify product claim) |

### Pass list
| Step | Result |
|------|--------|
| test-connect-ui | **PASS** |
| test-friend-invite | **PASS** |
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

### Full console (unit)

```text
=== dev-smoke ===
root: /home/drakosik/freenet-roulette
time: 2026-08-12T11:55:55Z

▶ test-connect-ui → ok
▶ test-friend-invite → all friend-invite tests passed
▶ test-geo-localize → mobile geoLocalize: all tests passed
▶ unit callMetrics.test.mjs → ok
▶ unit connectSteps.test.mjs → ok
▶ unit hubLobby.test.mjs → ok
▶ unit matchContinuity.test.mjs → ok
▶ unit matchPeers.test.mjs → OK
▶ unit partnerIdentityDisplay.test.mjs → OK
▶ unit stageStreams.test.mjs → ok
▶ unit blurMode.test.mjs → OK
▶ unit giftFxHold.test.mjs → OK

=== dev-smoke PASS (unit only) ===
```

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

### Check groups (30 PASS — static wiring only)

| Group | Notes |
|-------|--------|
| Identity surface | single dock, no stacked HUD, omitFlag, stage flag chip |
| Privacy blur | PartnerBlurVeil, multi A5 veil z0+elev, default **hold**, eye toggle |
| Stars / brand / autostart | displayPartnerStars, BrandWatermark mount, idle retry @500ms |
| Web contract | live.js?v=572, webrtc.js?v=315, hop9 markers, hasRemoteSdp real SDP |

**Observed default:** `blurStrangersMode` is **hold** (static prefs check). Not a device/product claim.

---

## Files touched this hop
- **None** (read-only verifiers). RESULT write + card move only.
- No SoftBlur / MediaSession / live.js product edits.
- No APK / adb / force-push.

## Connect risk
**None** — unit + static L0 only. No WebRTC / ICE / MediaSession runtime change.

## Not claimed
- No device / adb match smoke PASS
- No av-verify product PASS / multi PASS / GOAL_MET
- No blur **product** (faces-on-device) PASS — static veil wiring only
- No APK rebuild / deploy
- No invent dual-flag or eye-toggle on-device PASS

## COMPLETE
| Field | Value |
|-------|--------|
| Card | `tasks/grok-loop/done/L64-unit-verify.md` |
| RESULT | `tasks/grok-loop/done/L64-unit-verify-RESULT.md` |
| dev-smoke --unit | **exit 0 PASS** |
| verify-match-ux | **exit 0 · 30 ok · 0 fail** |
| Overall | **COMPLETE / PASS** (L0 only) |
