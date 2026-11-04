# UNIT-overnight-match-ux + SoftBlur product flag — RESULT

## Status
**COMPLETE**

## OWN
- RUN: `node mobile/scripts/verify-match-ux.mjs` only
- READ: `mobile/src/live/SoftBlurRemote.tsx` flag line only
- **No adb / APK** (F11 owns device; already COMPLETE with APK 0.1.371-vc379)
- No MediaSession thrash
- No invent multi or blur **device** PASS
- No deploy / force-push

## Goal
L0 match-ux unit harness + confirm `SOFT_BLUR_PRODUCT_ENABLED = true` still on disk post BLUR-F10.

## Source
- Live run: `cd /home/drakosik/freenet-roulette && node mobile/scripts/verify-match-ux.mjs`
- Shell exit: **0**
- At: **2026-08-12T05:29:06Z**
- Git HEAD (short): **a0d195d**
- Script: `/home/drakosik/freenet-roulette/mobile/scripts/verify-match-ux.mjs`
- Flag file: `/home/drakosik/freenet-roulette/mobile/src/live/SoftBlurRemote.tsx`

## Verdict
| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **exit** | **0** |
| **oks** | **31** |
| **fails** | **0** |
| **SOFT_BLUR_PRODUCT_ENABLED** | **true** (on disk) |
| **scope** | L0 static unit + product flag read only (no device smoke) |

## SoftBlur product flag evidence

```text
// mobile/src/live/SoftBlurRemote.tsx:37
export const SOFT_BLUR_PRODUCT_ENABLED = true;
```

Supporting comments on disk (lines 4, 31–35):
- PRODUCT: Soft live-blur is ON (`SOFT_BLUR_PRODUCT_ENABLED = true`) — BLUR-F10
- Product switch comment: soft live-blur (SoftBlurVideoView) is ON (BLUR-F10)
- `isSoftBlurNativeAvailable()` still gates on this flag + Android + native manager

**Confirmed:** flag remains `true` post F10. No edit made this run (read-only).

## Full console output

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

## Explicit non-claims
- **Not** a multi SoftBlur device PASS
- **Not** a blur product device smoke PASS (static L0 + flag only)
- F11 APK device re-smoke already marked COMPLETE separately (0.1.371-vc379) — this card did not re-run adb

## Card disposition
- Job card: `tasks/grok-loop/running/13-UNIT-match-ux-softflag.md` → moved to `tasks/grok-loop/done/`
