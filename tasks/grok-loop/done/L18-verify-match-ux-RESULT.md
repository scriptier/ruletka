# L18-verify-match-ux — RESULT

## Status
**COMPLETE**

## OWN
- RESULT under `tasks/grok-loop/done/` only
- No product code edits
- No deploy / APK / phone adb thrash
- **No invent multi PASS / GOAL_MET**
- **No invent blur product PASS** (static L0 only)

## Goal
Run `node mobile/scripts/verify-match-ux.mjs` (L0 match-ux static invariants: name / ★ / loc / blur / eye). Report exit + all checks honestly.

## Source
- Live run: `cd /home/drakosik/freenet-roulette && node mobile/scripts/verify-match-ux.mjs`
- Shell exit: **0**
- At: **2026-08-12T03:38:43Z**
- Git HEAD (short): **a0d195d** (`main...origin/main`)
- Script: `/home/drakosik/freenet-roulette/mobile/scripts/verify-match-ux.mjs`

## Verdict
| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **exit** | **0** |
| **oks** | **31** |
| **fails** | **0** |
| **scope** | L0 static only (no device smoke, no av-verify product claim) |

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
  OK  prefs: default blurStrangersMode is intro
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
  OK  ui/live.html cache-bust live.js?v=566 webrtc.js?v=315
  OK  ui/live.js has hop9 stuck-offer recovery markers
  OK  MediaSession hasRemoteSdp uses real remote SDP (not latch alone)
L0 done: 31 ok, 0 fail
```

## Check groups (31 PASS)

### Identity surface (single dock / no stacked HUD)
| Check | Result |
|-------|--------|
| `showStagePartnerHud={false}` | PASS |
| `onToggleBlur={togglePartnerBlur}` | PASS |
| Exactly 1 `PartnerIdentityDock`, no matched `PartnerChrome` | PASS |
| Dock `formatLocLine({ omitFlag: true })` | PASS |
| Dock name has no flag-emoji prefix | PASS |
| `formatLocLine` accepts `omitFlag` | PASS |
| `partnerIdentityTopStrip` transparent / light frost | PASS |
| Stage single `partnerFlagChip` | PASS |

### Privacy blur (veil + RTC keep-mounted + multi A5)
| Check | Result |
|-------|--------|
| `PartnerBlurVeil` on privacy path | PASS |
| Blur path present / keep RTCView mounted | PASS |
| Multi-remote keeps RTC under veil | PASS |
| Multi/1v1 veil: `zOrder={0}` + `blurCoverElevated` | PASS |
| Multi A5: veil on all remote tiles (idx>0) + z0 + elev | PASS |
| Prefs blur-ux-intro-v* off→intro one-shot | PASS |
| Default `blurStrangersMode` is `intro` | PASS |
| No always-on Android chrome Modal on match | PASS |
| Android privacy Modal only while `showPrivacyBlur` | PASS |
| `live.tsx` imports `PartnerBlurVeil` | PASS |
| `[blur] show/hide why=` logs | PASS |
| Stranger match wantBlur for intro/hold | PASS |
| Eye toggle sets `remoteBlurred` | PASS |
| `LiveBottomBar` `live-blur-btn` + `onToggleBlur` | PASS |

### Stars / brand / autostart / web contract / MediaSession
| Check | Result |
|-------|--------|
| Autostart spin path + idle retry @500ms | PASS |
| `displayPartnerStars` helper exists | PASS |
| PartnerChrome stars/trust display | PASS |
| LiveStageVideo stage ★ max/spendable+trust | PASS |
| `BrandWatermark` export + stage import/mount | PASS |
| `ui/live.html` cache-bust `live.js?v=566` `webrtc.js?v=315` | PASS |
| `ui/live.js` hop9 stuck-offer recovery markers | PASS |
| MediaSession `hasRemoteSdp` uses real remote SDP (not latch alone) | PASS |

## Files touched this hop
- **None** (read-only verifier). RESULT write only.

## Connect risk
**None** — static L0 script only; no WebRTC / ICE / MediaSession runtime change.

## Not claimed
- No device / adb match smoke PASS
- No av-verify product PASS / multi PASS / GOAL_MET
- No blur **product** (faces-on-device) PASS — static veil wiring only
- No APK rebuild / deploy
- No invent dual-flag or eye-toggle on-device PASS

## COMPLETE
Card → `tasks/grok-loop/done/L18-verify-match-ux-RESULT.md`.
**L0 match-ux: 31 ok, 0 fail, exit 0.**
