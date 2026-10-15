# L21-unit-verify — RESULT

## Status
**COMPLETE** — **PASS**

## OWN
- Run `./scripts/dev-smoke.sh --unit` and `node mobile/scripts/verify-match-ux.mjs`
- Optional fix only: one cheap SoftBlur/F-lane fail in `mobile/src/**/*.test.mjs`
- RESULT only if green
- **No invent blur product PASS**

## Goal
Mobile unit smoke + L0 match-ux static verify. Report pass/fail.

## Verify

### 1) unit (`dev-smoke --unit`)
```bash
cd /home/drakosik/freenet-roulette
./scripts/dev-smoke.sh --unit 2>&1 | tee /tmp/l21-unit.log
# EXIT:0
# === dev-smoke PASS (unit only) ===
```

Log: `/tmp/l21-unit.log`  
Time: `2026-08-12T03:57:53Z`  
HEAD: `a0d195d`  
Root: `/home/drakosik/freenet-roulette`

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

### 2) verify-match-ux
```bash
cd /home/drakosik/freenet-roulette
node mobile/scripts/verify-match-ux.mjs 2>&1 | tee /tmp/l21-verify-match-ux.log
# EXIT:0
# L0 done: 30 ok, 0 fail
```

Log: `/tmp/l21-verify-match-ux.log`

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **exit** | **0** |
| **oks** | **30** |
| **fails** | **0** |
| **scope** | L0 static only (no device smoke, no product blur claim) |

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
  OK  prefs: default blurStrangersMode is intro
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
  OK  ui/live.html cache-bust live.js?v=566 webrtc.js?v=315
  OK  ui/live.js has hop9 stuck-offer recovery markers
  OK  MediaSession hasRemoteSdp uses real remote SDP (not latch alone)
L0 done: 30 ok, 0 fail
```

## What landed
- Re-run only. Both gates green first try.
- No test failures → no SoftBlur/F-lane test fix needed.
- No product code or test-file edits.
- No invent blur product PASS (static L0 + pure unit only).

## Files touched
- none (verify-only)
- RESULT: `tasks/grok-loop/done/L21-unit-verify-RESULT.md`
- card: `tasks/grok-loop/running/L21-unit-verify.md` → `tasks/grok-loop/done/L21-unit-verify.md`

## Connect risk
**None** — unit + static L0 only. No ICE thrash, no MediaSession rewrite, no SoftBlur Java, no LiveStageVideo/live.tsx Modal edits, no deploy/APK/adb.

## Not claimed
- No device / adb match smoke PASS
- No av-verify product PASS / multi PASS / GOAL_MET
- No blur **product** (faces-on-device) PASS — static veil wiring only

## COMPLETE or BLOCKED
**COMPLETE** — PASS  
- unit: exit 0  
- verify-match-ux: 30 ok, 0 fail, exit 0  
