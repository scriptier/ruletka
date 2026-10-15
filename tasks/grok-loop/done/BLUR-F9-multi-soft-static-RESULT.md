# BLUR-F9 multi SoftBlur static residual — RESULT

## Status
**COMPLETE** (static audit only)

## Gate
| Check | Result |
|-------|--------|
| Device multi SoftBlur | **NOT claimed** — no adb / no multi match / no invent PASS |
| Product edit | none (read-only) |
| APK / force-push / MediaSession thrash | none |

## OWN
- Read-only: `mobile/src/live/LiveStageVideo.tsx`, `SoftBlurRemote.tsx`, `PartnerBlurVeil.tsx`, `stageStreams.ts` (tile model)
- Optional: `node mobile/scripts/verify-match-ux.mjs` → **31 ok, 0 fail**
- RESULT only; no product code change

## Summary
Multi-tile SoftBlur **wiring still present** after F4: every `splitTiles` remote resolves `getStreamUrl` + `tileSoftBlur` and mounts either `SoftBlurRemote` or `PartnerBlurVeil` under elevated shell with RTCView kept mounted at `zOrder={0}`. Product soft path is **gated OFF on disk** (`SOFT_BLUR_PRODUCT_ENABLED = false`), so current tree always takes PartnerBlurVeil on privacy. **Not multi SoftBlur device PASS.**

---

## 1. Per multi-tile privacy + softNative + getStreamUrl

### Gate chain (stage-wide)
| Symbol | Source | Role |
|--------|--------|------|
| `privacyBlur` | `!!remoteBlurred` | Privacy on (eye / intro / hold) |
| `softBlurNative` | `isSoftBlurNativeAvailable()` | Native registered **and** product enabled |
| `partnerStreamUrl` | `getStreamUrl(remoteStream)` | 1v1 main/PiP only |
| Per-tile | see below | Multi split path |

### Multi path (`multiRemote` → `splitTiles.map`)

```515:521:mobile/src/live/LiveStageVideo.tsx
            const tileStreamUrl = getStreamUrl(tile.stream);
            const tileSoftBlur =
              privacyBlur &&
              softBlurNative &&
              !!tileStreamUrl &&
              !!tile.stream &&
              !tile.placeholder;
```

| Condition | Soft path | Fallback |
|-----------|-----------|----------|
| `privacyBlur && softBlurNative && streamURL && stream && !placeholder` | `<SoftBlurRemote streamURL={tileStreamUrl} active />` in `blurCoverElevated` | — |
| `privacyBlur` but soft ineligible | — | `<PartnerBlurVeil compact …/>` same elev shell |
| `!privacyBlur && partnerHideOn && idx===0` | — | Partner hide mosaic on **primary** tile only |
| placeholder / no stream | no SoftBlur | privacy still paints PartnerBlurVeil if `privacyBlur` |

### Hard constraints observed (good)
| Rule | Evidence |
|------|----------|
| RTCView stays mounted under veil | `tile.stream && !tile.placeholder` → `<VideoView … zOrder={0} />` **before** privacy branch (no `!privacyBlur` unmount gate) |
| Every remote tile covered | privacy branch is **not** `idx===0`-only; all `splitTiles` get SoftBlur or PartnerBlurVeil |
| SurfaceView under RN | multi always `zOrder={0}` + `styles.blurCoverElevated` (elev 32) |
| Per-tile URL | `getStreamUrl(tile.stream)` — independent of `partnerStreamUrl` |
| Placeholder tiles | `placeholder: !stream` from `pickMultiRemoteTiles` → `tileSoftBlur` false; veil still if privacy |

### SoftBlurRemote / product gate (disk)

```32:32:mobile/src/live/SoftBlurRemote.tsx
export const SOFT_BLUR_PRODUCT_ENABLED = false;
```

```87:91:mobile/src/live/SoftBlurRemote.tsx
export function isSoftBlurNativeAvailable(): boolean {
  if (!SOFT_BLUR_PRODUCT_ENABLED) return false;
  if (Platform.OS !== "android") return false;
  return readNativeConfig() != null;
}
```

**Implication for multi:** with product gate **false**, `softBlurNative === false` always → `tileSoftBlur` never true on current source → multi privacy is **PartnerBlurVeil-only**, not SoftBlurRemote.  
Contrast: F6/F8 device APK (0.1.368) logged `softNative=1` + Sink on **1v1** — that binary was product-enabled; **disk now OFF**. Re-enable is a product flag flip + device re-smoke, not missing multi map wiring.

`getStreamUrl`:

```51:60:mobile/src/live/SoftBlurRemote.tsx
export function getStreamUrl(
  stream: MediaStreamLike | null | undefined
): string {
  if (!stream) return "";
  try {
    const url = stream.toURL?.();
    return typeof url === "string" ? url : "";
  } catch {
    return "";
  }
}
```

Safe null/throw; empty URL → SoftBlurRemote returns null (veil fallback).

---

## 2. Hunt / lookingForThird vs true remotes

| Layout | `multiRemote` | Privacy / SoftBlur |
|--------|---------------|--------------------|
| **True multi** (`remoteStream2` / `remoteStream3` / `extraPeerCount>0`) | yes → `splitTiles` | Per-tile soft/veil as above |
| **Find-3rd hunt** (`lookingForThird` && no stream2/3) | **no** (explicit — avoids unmount 1v1 RTC) | Partner half uses **1v1** path (`softBlurPartner` / PartnerBlurVeil on main). Looking half = `BrandLoadingLoop` only — **no stream, no SoftBlur, no PartnerBlurVeil** |
| **extraPeerCount without stream2 yet** | multiRemote true | second tile `placeholder: true` → veil if privacy, no SoftBlur until stream lands |

Hunt is correctly **not** multi SoftBlur territory: single partner stream, same 1v1 soft gate.

Multi self PiP (`multiRemote && localStream`) mounts local only — **never** SoftBlur (self not veiled by stranger privacy).

---

## 3. PartnerBlurVeil + Android Modal (multi interaction)

- Stage multi: compact PartnerBlurVeil per tile when soft off / no URL.
- `live.tsx` Android Modal while `showPrivacyBlur`: **full-screen** solid `#45536c` + one `PartnerBlurVeil` (comment: Soft live-blur OFF).  
  **Gap for soft multi visual:** opaque Modal occludes under-stage per-tile SoftBlurRemote. F6 claimed soft under transparent chrome on older path; current Modal is full mosaic. Soft multi device smoke must reconcile Modal vs stage SoftBlur (out of F9 OWN — residual only).

---

## 4. verify-match-ux.mjs (optional)

```
L0 done: 31 ok, 0 fail
```

Relevant blur lines (all OK):
- PartnerBlurVeil on privacy path
- multi-remote keeps RTC under veil
- multi/1v1 veil uses zOrder 0 + blurCoverElevated
- multi A5 veil on all remote tiles (idx>0) + z0 + elev shell

Script does **not** assert SoftBlurRemote / `tileSoftBlur` / `getStreamUrl` per tile (veil A5 only). Optional future static check if product re-enables soft.

---

## 5. Wiring matrix (static)

| Path | privacy | softNative (if product ON) | getStreamUrl | SoftBlurRemote | PartnerBlurVeil | Device evidence |
|------|---------|----------------------------|--------------|----------------|-----------------|-----------------|
| Multi tile 0 (focus) | yes | per-tile URL | `tile.stream` | if eligible | else | **none multi** |
| Multi tile 1 (remote2) | yes | per-tile URL | `tile.stream` | if eligible | else | **none multi** |
| Multi tile 2 (remote3) | yes | per-tile URL | `tile.stream` | if eligible | else | **none multi** |
| Multi placeholder | yes | no | "" | no | yes | static only |
| Hunt partner | 1v1 path | partner URL | `remoteStream` | if eligible | else | F6/F8 1v1 only |
| Hunt looking strip | n/a | n/a | n/a | no | no | n/a |
| 1v1 main/PiP | yes | partner URL | `remoteStream` | if eligible | else | F6 Hold / F8 Intro (softNative=1 on **then** APK) |

---

## 6. Gaps for future **device** multi SoftBlur (do not invent PASS)

1. **No multi match exercised** in F6/F8 (`peers=1` only) — residual open.
2. **Disk product gate OFF** — SoftBlurRemote never mounts until `SOFT_BLUR_PRODUCT_ENABLED = true` (+ APK with native).
3. **Modal vs soft:** full-screen PartnerBlurVeil Modal may hide per-tile SoftBlur; device plan must decide transparent chrome vs mosaic Modal for multi soft visual.
4. **N× VideoSink:** static wires N SoftBlurRemote with distinct streamURLs; native `SoftBlurVideoView` multi-instance sink attach **unproven** on device (only single Sink seen in 1v1 logcat).
5. **Logs:** stage `[blur] show … softNative=` is stage-wide, not per-tile; multi device smoke should filter `SoftBlurVideoView: Sink attached` count ≥ remote tile count.
6. **partnerHideOn** only `idx===0` — intentional; not a SoftBlur gap.
7. **verify-match-ux** does not assert soft multi path — veil A5 only.

---

## Explicit non-claims
- **NOT multi SoftBlur device PASS** (3-way / 4-way never smoked)
- **NOT** invent softNative=1 on current disk (product flag false)
- **NOT** re-open F6 Hold / F8 Off+Intro (1v1 baselines stand)
- **No** adb, APK, MediaSession thrash, force-push, product edit

## Verdict
| Claim | Result |
|-------|--------|
| Multi-tile SoftBlur **wiring** (privacy + softNative gate + getStreamUrl per tile) present after F4 | **PASS (static)** |
| Multi PartnerBlurVeil A5 + z0 + elev + keep RTC | **PASS (static + verify-match-ux)** |
| Hunt vs multi separation correct | **PASS (static)** |
| Soft product path active on disk | **FAIL / OFF** (`SOFT_BLUR_PRODUCT_ENABLED = false`) |
| Multi SoftBlur **device** PASS | **NOT claimed** |

## Paths
| Artifact | Path |
|----------|------|
| LiveStageVideo multi map | `/home/drakosik/freenet-roulette/mobile/src/live/LiveStageVideo.tsx` (~497–655) |
| SoftBlurRemote + getStreamUrl | `/home/drakosik/freenet-roulette/mobile/src/live/SoftBlurRemote.tsx` |
| PartnerBlurVeil | `/home/drakosik/freenet-roulette/mobile/src/live/PartnerBlurVeil.tsx` |
| Tile model | `/home/drakosik/freenet-roulette/mobile/src/live/stageStreams.ts` (`pickMultiTiles` / `placeholder`) |
| Prior 1v1 device (not multi) | `tasks/grok-loop/done/BLUR-F6-apk-smoke-RESULT.md`, `BLUR-F8-off-intro-smoke-RESULT.md` |

## Done criteria
- [x] Confirm privacy + softNative + getStreamUrl per multi tile
- [x] Note hunt/lookingForThird vs remotes
- [x] Explicit **NOT multi SoftBlur device PASS**
- [x] COMPLETE + card → done
