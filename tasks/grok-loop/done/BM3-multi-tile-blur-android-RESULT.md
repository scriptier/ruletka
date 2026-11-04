# BM3-multi-tile-blur-android — RESULT

## Status
**COMPLETE** (audit + static guard; **no product LiveStageVideo/liveStyles edit** — no residual gap after BM2 veil z-order). **No invent multi / blur product PASS.**

## OWN
- Plan A5: multi-tile blur remote2/3 on Android (`LiveStageVideo` multi branch)
- `mobile/scripts/verify-match-ux.mjs` A5 static guard only
- `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` progress stamp
- RESULT under `tasks/grok-loop/done/`
- **Did not** edit `LiveStageVideo.tsx` / `liveStyles.ts` / `PartnerBlurVeil.tsx` (BM2 already closed gap)
- **Did not** touch `live.tsx` / MediaSession / ICE / APK / deploy

## Goal
LiveStageVideo veil on remote2/3 (`idx>0`) when privacy; OWN LiveStageVideo + liveStyles **only if gap after BM2 veil z-order**.

## Audit (gap after BM2?)

| Check | On-disk finding | Gap? |
|-------|-----------------|------|
| Multi `VideoView` zOrder | **Always `zOrder={0}`** for all multi remotes (never `mainZOrder` / never idx0-only) | **No** — BM2 fixed historical `(privacyBlur \|\| partnerHideOn) && idx === 0 ? 0 : mainZOrder` |
| Privacy veil mount | `{privacyBlur ? (` elevated shell + `PartnerBlurVeil` compact **inside `splitTiles.map`** — all idx including remote2/3 | **No** — not gated `idx === 0` |
| Elev shell | `styles.blurCoverElevated` (z50 / elev **32**) parent; veil elev **28** | **No** — shared with 1v1 coverMain |
| RTC keep-mounted | `tile.stream && !tile.placeholder` → VideoView under veil (not `!privacyBlur`) | **No** |
| Tile set | `splitTiles` from `pickMultiTiles` includes tileC / remoteStream3 | **No** — 4-way path present |
| partnerHide | `partnerHideOn && idx === 0` only | **Intentional** (cam-hide is primary partner signal, not privacy) |
| liveStyles multi | `splitTile*` overflow hidden + flex; `blurCoverElevated` shared | **No** extra style gap for A5 |
| Android Modal | Fullscreen nuclear cover while `showPrivacyBlur` (live.tsx, not this OWN) | Underlay multi veils still correct for stack / non-Modal paths |

### Historical bug (closed in BM2-veil-zorder)
Pre-BM2 multi branch: only **idx===0** forced `zOrder={0}` under privacy; **idx>0** could stay `mainZOrder ≥ 1` → SurfaceView composites **above** RN veil → remote2/3 looked “unblurred” / blur dead. Bare `PartnerBlurVeil` without elev-32 shell on multi OEMs. BM2: all multi tiles z0 + elev shell.

### This hop decision
**No residual product gap** → **no** LiveStageVideo / liveStyles edit (per card: own those files *only if* gap). Harden static verify + stamp plan.

## Fix (this hop)

1. **`mobile/scripts/verify-match-ux.mjs`** — A5 guard on multi block:
   - `privacyBlur` ternary present; **not** `privacyBlur && idx === 0`
   - multi `zOrder={0}` + `blurCoverElevated` + `PartnerBlurVeil`
   - reject old `(privacyBlur || partnerHideOn) && idx === 0` zOrder gate
2. **`knowledge/specs/BLUR-MULTI-FINISH-PLAN.md`** — A5 **code-shipped · human-smoke-open**; residual row drops A5 as open product code.

## Verify
```text
node mobile/scripts/verify-match-ux.mjs
→ OK blur: multi/1v1 veil uses zOrder 0 + blurCoverElevated
→ OK blur: multi A5 veil on all remote tiles (idx>0) + z0 + elev shell
→ L0 done: 31 ok, 0 fail
```

## Explicit non-claims (no invent PASS)

| Claim | Verdict |
|-------|---------|
| Multi 3-way / 4-way faces + privacy mosaic product PASS | **NOT claimed** — human-smoke-open |
| Phone APK shows multi-tile veil on device | **NOT claimed** — ship **0.1.366-vc374** may predate BM2 stack; rebuild after human **proceed** |
| Blur Off/Intro/Hold mid-match GOAL_MET | **NOT claimed** |
| Deploy / adb multi smoke | **NOT claimed** — not this hop |

## Files

| Path | Change |
|------|--------|
| `mobile/scripts/verify-match-ux.mjs` | A5 multi-tile privacy static guard |
| `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` | A5 progress stamp + residual honesty |
| `tasks/grok-loop/done/BM3-multi-tile-blur-android-RESULT.md` | this RESULT |
| Card | `running/` → `done/BM3-multi-tile-blur-android.md` |

## Connect risk
**None** — no MediaSession / ICE / pool / live.js body / Android media capture touch. Static verify only.

## Merge advice
- Safe with BM2-veil-zorder (already landed product stack).
- Safe with BM2-blur-match-apply-fix (live.tsx apply; this lane did not touch).
- Human smoke (when APK has BM2+ stack): multi 3-way / 4-way with privacy On — mosaic on **all** remote tiles; eye / Show video peels all; SurfaceView does not punch through remote2/3.

## COMPLETE
**COMPLETE.** A5 multi-tile blur remote2/3 **code-shipped** via BM2 stack; re-audited no gap; verify A5 guard green. **No invent multi / blur product PASS.**
