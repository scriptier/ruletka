# L27-unit-verify — RESULT

## Status
**COMPLETE** — **PASS**

## OWN
- Run `./scripts/dev-smoke.sh --unit` + `node mobile/scripts/verify-match-ux.mjs`
- Optional one cheap test fix only if trivial fail
- **No invent multi PASS / GOAL_MET**
- **No invent blur product PASS** (static L0 only)
- No adb / APK / MediaSession thrash

## Goal
L0 pure unit gate + L0 match-ux static invariants. Report exit codes and counts honestly.

## Source
- Root: `/home/drakosik/freenet-roulette`
- Time: **2026-08-12T06:06:44Z** (dev-smoke) / **2026-08-12T06:06:49Z** (match-ux)
- Git HEAD (short): **a0d195d**
- Card moved: `tasks/grok-loop/running/L27-unit-verify.md` → `done/L27-unit-verify.md`

---

## 1) `./scripts/dev-smoke.sh --unit`

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **exit** | **0** |
| **summary** | `=== dev-smoke PASS (unit only) ===` |

### Pass list (12 steps)
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

---

## 2) `node mobile/scripts/verify-match-ux.mjs`

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **exit** | **0** |
| **oks** | **31** |
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
  OK  blur path present
  OK  blur: multi-remote keeps RTC under veil
  OK  blur: multi/1v1 veil uses zOrder 0 + blurCoverElevated
  OK  blur: multi A5 veil on all remote tiles (idx>0) + z0 + elev shell
  OK  prefs: blur-ux-intro-v* off→intro one-shot
  OK  prefs: default blurStrangersMode is hold
  OK  no always-on Android chrome Modal on match
  OK  Android privacy Modal only while showPrivacyBlur
  OK  live.tsx imports PartnerBlurVeil (JSX crash guard)
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
  OK  ui/live.html cache-bust live.js?v=571 webrtc.js?v=315
  OK  ui/live.js has hop9 stuck-offer recovery markers
  OK  MediaSession hasRemoteSdp uses real remote SDP (not latch alone)
L0 done: 31 ok, 0 fail
```

---

## Files touched this hop
- **None** (read-only verify). Both harnesses green on first try → no cheap test fix needed.
- RESULT: `tasks/grok-loop/done/L27-unit-verify-RESULT.md`
- Card: `tasks/grok-loop/done/L27-unit-verify.md`

## Connect risk
**None** — unit + static L0 only. No ICE thrash, no MediaSession rewrite, no deploy, no APK.

## Not claimed
- No device / adb match smoke PASS
- No av-verify product PASS / multi PASS / GOAL_MET
- No blur **product** (faces-on-device) PASS — static veil wiring only
- No APK rebuild / deploy

## COMPLETE
| Harness | Exit | Counts |
|---------|------|--------|
| `dev-smoke.sh --unit` | **0** | 12/12 unit steps PASS |
| `verify-match-ux.mjs` | **0** | **31 ok, 0 fail** |
| **overall** | **PASS** | no fix applied |
