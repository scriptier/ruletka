# L46-unit-verify — RESULT

## Status
**COMPLETE** — **PASS**

## OWN
- Run `./scripts/dev-smoke.sh --unit`
- Run `node mobile/scripts/verify-match-ux.mjs`
- **No invent blur/multi product PASS**
- **No SoftBlur thrash / APK / adb / force-push / live.js dual-write**

## Goal
L0 pure unit gate + L0 match-ux static invariants. Report exit + checks honestly.

## Verify

```bash
cd /home/drakosik/freenet-roulette
./scripts/dev-smoke.sh --unit
# EXIT:0
# === dev-smoke PASS (unit only) ===

node mobile/scripts/verify-match-ux.mjs
# EXIT:0
# L0 done: 30 ok, 0 fail
```

Time: `2026-08-12T09:35:30Z` (unit) / `2026-08-12T09:35:39Z` (match-ux)  
HEAD: `a0d195d`  
Root: `/home/drakosik/freenet-roulette`

---

### 1) dev-smoke --unit

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

### 2) verify-match-ux.mjs

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **exit** | **0** |
| **oks** | **30** |
| **fails** | **0** |
| **scope** | L0 static only (no device smoke, no av-verify / blur product claim) |

Full console:

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

Notes (static only, not product PASS):
- Default `blurStrangersMode` is **hold** (static pref check).
- PC cache-bust pin: `live.js?v=572`, `webrtc.js?v=315`.
- Blur/multi checks are **L0 static wiring** only — **not** invent product/device PASS.

## What landed
- Re-run only. Full L0 unit suite green; match-ux 30/30.
- No test failures; no product code edits.
- No multi/blur product PASS invented.

## Files touched
- none (verify-only hop)
- RESULT: `tasks/grok-loop/done/L46-unit-verify-RESULT.md`
- Card moved: `running/L46-unit-verify.md` → `done/L46-unit-verify.md`

## Connect risk
**None** — unit + static verify only. No ICE thrash, SoftBlur, MediaSession rewrite, APK, adb, or live.js dual-write.

## COMPLETE or BLOCKED
**COMPLETE** — PASS (both exits 0)
