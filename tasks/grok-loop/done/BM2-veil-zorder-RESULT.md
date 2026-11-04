# BM2-veil-zorder — RESULT

## Status
**COMPLETE** (code audit + minimal z-order fix). **No invent multi PASS.** No APK.

## OWN
- `mobile/src/live/LiveStageVideo.tsx`
- `mobile/src/live/PartnerBlurVeil.tsx`
- `mobile/src/live/liveStyles.ts` (`blurCoverElevated` shared shell)
- Static guard: `mobile/scripts/verify-match-ux.mjs` (z-order assertion only)
- **Did not** edit `live.tsx` blur apply paths (sibling BM2-blur-match-apply-fix)
- **Did not** touch MediaSession / ICE / `ui/*`

## Goal (plan A4)
PartnerBlurVeil elevation / z-order so veil is not under RTCView SurfaceView on **1v1**, **multi tiles**, and **hunt** (looks like “blur dead”).

## Audit

| Layout | RTCView zOrder | Veil stack | Before gap | After |
|--------|----------------|------------|------------|--------|
| **1v1 main** | `mainZOrder` → **0** when partner / `coverMain` / matched | `blurCoverElevated` (z50/elev32) → `PartnerBlurVeil` | 1v1 already had elev wrapper (inline) | Shared `styles.blurCoverElevated`; `coverMain` forces z0 |
| **Hunt (find-3rd)** | Same 1v1 partner half (`huntingThird` wraps half only) | Same `coverMain` elevated shell on partner tile | Hunt reuses 1v1 path — OK if elev shell present | Unchanged path; elevated shell confirmed |
| **Multi tiles** | **Always `zOrder={0}`** (all remotes) | **Every** privacy tile: elevated shell + compact veil | **Gap:** only idx0 forced z0; bare veil elev28 without parent elev32 | Fixed — all tiles z0 + `blurCoverElevated` |
| **Partner PiP** | `pipZOrder` → **0** when `coverPip` / partner | Elevated shell around compact veil | Bare veil only | Fixed — `blurCoverElevated` wrapper |
| **Android Modal** | N/A (fullscreen host in `live.tsx`) | Modal elev 48 + veil (sibling OWN) | BM1: Modal absent because blur never applied | Not this lane |

### SurfaceView rules (unchanged product)
- Partner RTCView stays **mounted** while veiled (unmount = crash class).
- **zOrder ≥ 1** composites above entire RN window → partner tiles stay **0**.
- Opaque RN sibling needs **elevation** (not zIndex alone) over zOrder-0 SurfaceView.
- `PartnerBlurVeil` root/forceOpaque: elev **28**; parent shell elev **32**.

### Link to BM1 forensics
BM1 on Pixel 0.1.366: **veil_visible=no**, no `[blur] show` — prefs `intro` but apply never mounted veil. That is **apply-path** (sibling), not z-order. This hop makes multi/hunt **stack correct when** `remoteBlurred` is true so “blur dead” is not elevation under RTCView.

## Fix (minimal)

1. **`liveStyles.blurCoverElevated`** — absoluteFill `#45536c`, `zIndex: 50`, `elevation: 32` (shared shell).
2. **Multi** — every remote `VideoView` `zOrder={0}`; privacy / partner-hide wrap `PartnerBlurVeil` in elevated shell; tile `collapsable={false}`.
3. **1v1 / hunt `coverMain`** — use `blurCoverElevated` (was inline elev32).
4. **PiP `coverPip`** — same elevated shell.
5. **`mainZOrder` / `pipZOrder`** — include `coverMain` / `coverPip` so veiled tiles never leave z0 via side paths.
6. **`PartnerBlurVeil.forceOpaque`** — reassert `zIndex: 40`, `elevation: 28` last so caller `remoteFill`/`pipVideo` cannot strip stack.
7. **verify-match-ux** — static OK: multi/1v1 `zOrder={0}` + `blurCoverElevated`.

## Verify
```text
node mobile/scripts/verify-match-ux.mjs
→ OK blur: multi/1v1 veil uses zOrder 0 + blurCoverElevated
→ L0 done: 30 ok, 0 fail
```

## Multi product claim
**Not claimed.** No multi device smoke. No invent multi PASS.

## Files touched (this lane)
| File | Change |
|------|--------|
| `mobile/src/live/LiveStageVideo.tsx` | multi z0 + elevated shells; coverMain/coverPip zOrder; multi collapsable |
| `mobile/src/live/liveStyles.ts` | `blurCoverElevated` |
| `mobile/src/live/PartnerBlurVeil.tsx` | forceOpaque elev reassert |
| `mobile/scripts/verify-match-ux.mjs` | A4 static guard |

## Risks
- Elevation still OEM-dependent; Android fullscreen Modal remains the nuclear cover when `showPrivacyBlur` (live.tsx).
- If blur apply still never sets `remoteBlurred`, stage shell never mounts — need sibling apply-fix + human smoke.
- Self PiP during multi stays zOrder from `pipZOrder` (not veiled) — intentional.

## Merge advice
- Safe with BM2-blur-match-apply-fix (no live.tsx overlap).
- Ship with blur apply hop; human smoke: multi + hunt with privacy on — mosaic above clear video, Show video / eye tappable.
- APK only after human **proceed** (not this hop).
