# BLUR-F4 LiveStageVideo soft blur integrate — RESULT

## Status
**COMPLETE** (stage soft-blur wiring + veil fallback). **No invent product PASS.** No APK / device smoke. No live.tsx Modal (F5 OWN).

## OWN
- `mobile/src/live/LiveStageVideo.tsx` only
- **Did not** edit `liveStyles.ts` (reused `blurCoverElevated` / `remoteFill` / `pipVideo`)
- **Did not** edit `live.tsx` Modal chrome (F5)
- **Did not** edit SoftBlurRemote / native Java (F3 / F2)
- **Did not** touch MediaSession / ICE / ui/*

## Goal
When `privacyBlur` + partner stream: keep RTCView mounted `zOrder={0}`; overlay `SoftBlurRemote` active with stream URL over partner tile (not solid mosaic only). `PartnerBlurVeil` elev stack only when SoftBlur inactive / no stream / native missing. Multi tiles: same per tile when stream available.

## Delivered

### SoftBlur path (privacy + native + stream URL)
| Layout | RTCView | Overlay |
|--------|---------|---------|
| **1v1 main** (partner on main) | mounted, `mainZOrder` → 0 via `coverMain` | `SoftBlurRemote` `streamURL={partnerStreamUrl}` `active` inside `blurCoverElevated`; Pressable → `blurVeil.onUnblur` |
| **Partner PiP** (swapped) | mounted, `pipZOrder` → 0 via `coverPip` | `SoftBlurRemote` same URL; `pointerEvents="none"` (DraggablePip double-tap still unblurs) |
| **Multi tiles** (all idx) | always `zOrder={0}` | per-tile `getStreamUrl(tile.stream)` → SoftBlur when URL + stream + not placeholder; shell `pointerEvents="none"` so tile Pressable unblurs |

### Veil fallback (SoftBlur inactive / no stream / native missing)
| Condition | Behavior |
|-----------|----------|
| `!isSoftBlurNativeAvailable()` | existing `PartnerBlurVeil` + `blurCoverElevated` (full card main, compact multi/pip) |
| privacy but empty stream URL | PartnerBlurVeil (soft needs URL) |
| SoftBlurRemote renders null | gate uses `isSoftBlurNativeAvailable() && !!url` so veil mounts instead of empty shell |
| partner-hide (not privacy) | unchanged PartnerBlurVeil mosaic (no soft path) |

### Helpers (from F3 SoftBlurRemote)
```tsx
import {
  SoftBlurRemote,
  getStreamUrl,
  isSoftBlurNativeAvailable,
} from "./SoftBlurRemote";

const softBlurNative = isSoftBlurNativeAvailable();
const partnerStreamUrl = getStreamUrl(remoteStream);
const softBlurPartner = privacyBlur && softBlurNative && !!partnerStreamUrl;
// multi: tileSoftBlur = privacyBlur && softBlurNative && !!tileStreamUrl && stream && !placeholder
```

### Invariants preserved
- Partner RTCView **never** unmounted while `privacyBlur`
- Multi remotes always `zOrder={0}` (A4/A5)
- Elevated shell `blurCoverElevated` (z50 / elev 32) wraps soft **and** veil paths
- SoftBlurRemote has native `pointerEvents="none"` — stage CTAs / tile press / PiP double-tap remain hit-testable
- Smoke log: `[blur] show … softNative=0|1`

## Verify
```text
node mobile/scripts/verify-match-ux.mjs
→ OK blur: PartnerBlurVeil on privacy path
→ OK blur: multi-remote keeps RTC under veil
→ OK blur: multi/1v1 veil uses zOrder 0 + blurCoverElevated
→ OK blur: multi A5 veil on all remote tiles (idx>0) + z0 + elev shell
→ L0 done: 30 ok, 0 fail
```

Static presence:
- `SoftBlurRemote` + `getStreamUrl` + `isSoftBlurNativeAvailable` imports
- SoftBlur branches on multi / coverMainPartner / coverPipPartner
- PartnerBlurVeil retained on fallback + partner-hide

## Explicit non-claims (no invent PASS)

| Claim | Verdict |
|-------|---------|
| SoftBlur paints live frames on device | **NOT claimed** — needs F2 native registered + F6 APK smoke |
| Hold / intro soft blur product GOAL_MET | **NOT claimed** |
| Android Modal soft chrome | **NOT claimed** — F5 OWN |
| Multi 3-way/4-way soft blur device PASS | **NOT claimed** |
| APK rebuild | **NOT claimed** |

## Files

| Path | Change |
|------|--------|
| `mobile/src/live/LiveStageVideo.tsx` | SoftBlurRemote overlay on privacy when native+URL; PartnerBlurVeil fallback; multi per-tile soft |
| `tasks/grok-loop/done/BLUR-F4-stage-integrate-RESULT.md` | this RESULT |
| Card | `running/` → `done/BLUR-F4-stage-integrate.md` |

## Connect risk
**None** — no MediaSession / ICE / pool / live.js / native capture touch. Stage overlay wiring only.

## Merge advice
- Depends on F3 `SoftBlurRemote.tsx` (landed; graceful null without F2).
- Safe with F2 (native enables soft paint; without F2, `isSoftBlurNativeAvailable()` false → veil-only, prior UX).
- Safe with F5 (Modal chrome separate; stage SoftBlur is under-Modal visual when both on).
- Human smoke after F2+F6 APK: privacy On mid-match → soft video blur (not solid mosaic only) on 1v1 + multi remotes; eye / Show video peels; RTCView stays mounted.

## COMPLETE
**COMPLETE.** LiveStageVideo privacy prefers SoftBlurRemote over partner RTCView when stream URL + native; PartnerBlurVeil elev stack remains fallback. Multi tiles same. **No invent product PASS.**
