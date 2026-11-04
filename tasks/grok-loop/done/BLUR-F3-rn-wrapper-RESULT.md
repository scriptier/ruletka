# BLUR-F3 RN SoftBlurRemote wrapper — RESULT

## Status
**COMPLETE**

## OWN
- `mobile/src/live/SoftBlurRemote.tsx` (new)
- `mobile/src/live/index.ts` export
- **Did not** edit `LiveStageVideo.tsx` (sibling F4)
- **Did not** edit Android Java / SoftBlur native (sibling F2)

## Goal
TypeScript `requireNativeComponent('SoftBlurVideoView')` with `streamURL` + `active` + `style`; graceful null when native missing; `getStreamUrl(stream)` via `stream.toURL()`.

## Delivered

### `SoftBlurRemote.tsx`
| Item | Detail |
|------|--------|
| Native name | `SoftBlurVideoView` (`SOFT_BLUR_NATIVE_NAME`) — matches F2 manager |
| Props | `streamURL: string`, `active: boolean`, `style?: StyleProp<ViewStyle>` |
| Graceful miss | `UIManager.getViewManagerConfig` / `hasViewManagerConfig` / key probe; Android-only; `requireNativeComponent` try/catch → **render `null`** |
| Empty URL | `streamURL === ""` → **null** (no native bind) |
| `getStreamUrl(stream)` | `stream?.toURL()`; catch → `""` |
| `isSoftBlurNativeAvailable()` | Export for F4 veil-fallback gate |
| Hit testing | `pointerEvents="none"` so Show video / eye CTAs above stay clickable |
| Collapsable | `collapsable={false}` for Fabric/layout stability |

### `index.ts`
Exports: `SoftBlurRemote`, `getStreamUrl`, `isSoftBlurNativeAvailable`, `SOFT_BLUR_NATIVE_NAME`, type `SoftBlurRemoteProps`.

## Usage (for F4 — not wired here)

```tsx
import {
  SoftBlurRemote,
  getStreamUrl,
  isSoftBlurNativeAvailable,
} from "../live";

const url = getStreamUrl(remoteStream);
const softOk = isSoftBlurNativeAvailable() && !!url;

// privacyBlur + softOk → <SoftBlurRemote streamURL={url} active style={fill} />
// else → PartnerBlurVeil fallback
```

## Verify (static)
- File exists: `mobile/src/live/SoftBlurRemote.tsx`
- Name string: `SoftBlurVideoView`
- Exports present on `mobile/src/live/index.ts`
- No `LiveStageVideo` / android java touch in this hop

## Explicit non-claims
| Claim | Verdict |
|-------|---------|
| Native SoftBlur paints frames on device | **NOT claimed** — F2 native + F6 APK smoke |
| LiveStageVideo uses soft blur under privacy | **NOT claimed** — F4 OWN |
| Modal chrome prefers soft blur | **NOT claimed** — F5 OWN |
| Product blur Hold GOAL_MET | **NOT claimed** |

## Files

| Path | Change |
|------|--------|
| `mobile/src/live/SoftBlurRemote.tsx` | **new** RN wrapper + helpers |
| `mobile/src/live/index.ts` | export SoftBlurRemote / getStreamUrl / isSoftBlurNativeAvailable |
| `tasks/grok-loop/done/BLUR-F3-rn-wrapper-RESULT.md` | this RESULT |
| Card | `running/` → `done/BLUR-F3-rn-wrapper.md` |

## Connect risk
**None** — no MediaSession / ICE / LiveStageVideo / live.tsx / native media path. Pure RN view stub.

## Merge advice
- Safe with F2 (native register enables component; without F2, null → F4 veil fallback).
- Safe with F4 (consumes SoftBlurRemote + isSoftBlurNativeAvailable).
- Does not conflict with PartnerBlurVeil / VideoView.

## COMPLETE
**COMPLETE.** SoftBlurRemote wrapper + getStreamUrl + graceful native-missing null + live/index exports. F4 can integrate without hard dependency on native APK.
