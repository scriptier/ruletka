# BLUR-F5 Android Modal soft blur chrome — RESULT

## Status
**COMPLETE** (product edit: Android privacy Modal chrome only). **No invent SoftBlur / privacy product PASS.** No APK. No SoftBlur native (siblings F2–F4).

## OWN
- `mobile/app/live.tsx` only — Android `showPrivacyBlur` Modal block (~6425+)
- RESULT: `tasks/grok-loop/done/BLUR-F5-modal-chrome-RESULT.md`
- **Did not** edit `PartnerBlurVeil.tsx` / `LiveStageVideo.tsx` / SoftBlur native / SoftBlurRemote
- **Did not** touch MediaSession / ICE / APK / deploy

## Goal
User must **see soft live blur under chrome**, not a solid full-screen card that hides it.
- Modal `transparent={true}`
- Root View transparent or `rgba(0,0,0,0.15)` max
- No absoluteFill solid `PartnerBlurVeil` in Modal
- Keep Show video + eye elevated
- `onRequestClose` peel still works

## Before
| Item | State |
|------|--------|
| Modal | `transparent={false}` (opaque) |
| Root View | `backgroundColor: BLUR_VEIL_BASE` (`#45536c` solid full-screen) |
| PartnerBlurVeil | absoluteFill + solid `BLUR_VEIL_BASE` (forceOpaque always wins) |
| Controls | eye + Show video elevated above solid veil |
| SoftBlur under Modal | **hidden** by solid Modal + solid veil |

## After (this hop)

| Item | Change |
|------|--------|
| Modal | `transparent={true}` |
| Root View | `backgroundColor: "rgba(0,0,0,0.15)"` (max light dim) |
| PartnerBlurVeil in Modal | **removed** — no absoluteFill solid fill |
| Compact card | bottom mid-tone frost card (`rgba(69,83,108,0.72)`) with title + partner line + body |
| Eye | elevated `live-blur-eye-modal` (toggle) |
| Show video | elevated `live-blur-show-video` → `revealPartnerVideo("blur_modal_btn")` |
| Back / peel | `onRequestClose` → `revealPartnerVideo("blur_modal_back")` (unchanged) |
| Imports | dropped unused `PartnerBlurVeil` + `BLUR_VEIL_BASE` from `live.tsx` |

### Why not PartnerBlurVeil compact in Modal?
`PartnerBlurVeil` root always applies `forceOpaque` + `rootFill` absoluteFill solid `#45536c` — caller transparent styles cannot punch through. Using it full-screen in Modal would re-hide SoftBlur under stage. Compact bottom chrome is a plain View card instead.

## Verify (static)

```text
# Modal block must be transparent + light dim; no PartnerBlurVeil host in Modal
rg -n 'showPrivacyBlur && Platform.OS === "android"' -A 80 mobile/app/live.tsx
# expect: transparent={true}
# expect: backgroundColor: "rgba(0,0,0,0.15)"
# expect: live-blur-show-video + live-blur-eye-modal + onRequestClose reveal
# expect: no <PartnerBlurVeil in Modal block
```

Manual / device (not this hop): mid-match privacy on Android → SoftBlur (or stage frost from F4) visible under chrome; tap Show video / system back peels.

## Multi / SoftBlur product claim
**Not claimed.** SoftBlur native + stage wire are sibling F2–F4. This hop only opens Modal chrome so under-stage soft blur can show when those land.

## Files touched

| File | Change |
|------|--------|
| `mobile/app/live.tsx` | Android privacy Modal: transparent + light dim + compact bottom card; remove full-screen PartnerBlurVeil; keep eye/Show video/onRequestClose |
| `tasks/grok-loop/done/BLUR-F5-modal-chrome-RESULT.md` | this RESULT |

## Risks
- Transparent Modal no longer solid-blocks SurfaceView punch-through by itself — stage SoftBlur / PartnerBlurVeil under LiveStageVideo must cover partner RTCView (siblings BM2 z-order + F4 SoftBlur).
- OEM residual punch-through: light dim alone is not nuclear opaque; acceptable for soft-blur goal.
- No device smoke this hop.

## Merge advice
- Safe with F2–F4 (no SoftBlur file overlap); own only Modal chrome.
- Ship with F4 stage SoftBlur for full soft-blur look; human smoke privacy on Android after SoftBlur wired.
