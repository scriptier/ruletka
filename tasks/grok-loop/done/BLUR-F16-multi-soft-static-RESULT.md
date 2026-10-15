# BLUR-F16 multi SoftBlur static recheck post-MX — RESULT

## Status
**COMPLETE** (static audit only)

## Gate
| Check | Result |
|-------|--------|
| Device multi SoftBlur | **NOT claimed** — no adb / no multi match / no invent PASS |
| Product edit | none (read-only) |
| APK / force-push / MediaSession thrash | none |
| Product flag thrash | none (left as-is) |

## OWN
- Read-only: `mobile/src/live/LiveStageVideo.tsx`, `SoftBlurRemote.tsx`, `stageStreams.ts` (+ Modal chrome in `mobile/app/live.tsx` for soft visibility)
- Optional: `node mobile/scripts/verify-match-ux.mjs` → **30 ok, 0 fail**
- RESULT only; no product code change

## Summary
Post-MX multi MediaSession / live tip changes, multi-tile SoftBlur **wiring is intact**. Product gate is **ON** (`SOFT_BLUR_PRODUCT_ENABLED = true`). Every `splitTiles` remote still resolves `getStreamUrl(tile.stream)` + `tileSoftBlur` and mounts either `SoftBlurRemote` or `PartnerBlurVeil` under elevated shell with RTCView kept mounted at `zOrder={0}`. Android privacy Modal is **transparent chrome** (no full-screen solid veil) so stage SoftBlur can show through. **Not multi SoftBlur device PASS.**

### Delta vs BLUR-F9 (prior multi soft static)
| Item | F9 (disk then) | F16 (disk now) |
|------|----------------|----------------|
| `SOFT_BLUR_PRODUCT_ENABLED` | **false** | **true** (F10+) |
| Multi per-tile SoftBlur map | present | **still present** (same gate chain) |
| Android privacy Modal | full-screen solid mosaic (hid soft) | **TRANSPARENT** dim + bottom chrome only |
| 1v1 soft device | F6/F8 on older APK | F11–F14 on **0.1.371** + F15 Hold reconfirm **0.1.373-vc381** (`peers=1`) |
| Multi SoftBlur device | **NOT claimed** | **still NOT claimed** |

---

## 1. Product flag true

```34:34:mobile/src/live/SoftBlurRemote.tsx
export const SOFT_BLUR_PRODUCT_ENABLED = true;
```

```89:93:mobile/src/live/SoftBlurRemote.tsx
export function isSoftBlurNativeAvailable(): boolean {
  if (!SOFT_BLUR_PRODUCT_ENABLED) return false;
  if (Platform.OS !== "android") return false;
  return readNativeConfig() != null;
}
```

| Gate | Value on disk |
|------|----------------|
| Product switch | **true** |
| Platform | Android required |
| Native manager | `SoftBlurVideoView` via `UIManager` / `requireNativeComponent` |
| Export | `index.ts` re-exports `SOFT_BLUR_PRODUCT_ENABLED`, `isSoftBlurNativeAvailable`, `SoftBlurRemote`, `getStreamUrl` |

**Implication for multi (static):** with product **ON**, runtime Android + registered native ⇒ `softBlurNative === true` ⇒ `tileSoftBlur` can be true when privacy + per-tile stream URL. On iOS / missing native / empty URL → PartnerBlurVeil fallback (same map). **Runtime softNative=1 multi still unproven** (only 1v1 Sink evidence: F11/F14/F15).

`getStreamUrl` (safe null/throw → `""`):

```53:63:mobile/src/live/SoftBlurRemote.tsx
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

Empty URL → SoftBlurRemote returns null → multi path takes PartnerBlurVeil branch.

---

## 2. Per multi-tile soft path still present

### Stage-wide gates (`LiveStageVideo`)

| Symbol | Line | Role |
|--------|------|------|
| `privacyBlur` | ~242 `!!remoteBlurred` | Privacy on (eye / intro / hold) |
| `softBlurNative` | **247** `isSoftBlurNativeAvailable()` | Product ON + Android + native |
| `partnerStreamUrl` / `softBlurPartner` | **379–381** | 1v1 main/PiP only |
| Per-tile | **526–532** | Multi split path |

### Multi path (`multiRemote` → `splitTiles.map`)

```526:532:mobile/src/live/LiveStageVideo.tsx
            const tileStreamUrl = getStreamUrl(tile.stream);
            const tileSoftBlur =
              privacyBlur &&
              softBlurNative &&
              !!tileStreamUrl &&
              !!tile.stream &&
              !tile.placeholder;
```

```591:624:mobile/src/live/LiveStageVideo.tsx
              {privacyBlur ? (
                tileSoftBlur ? (
                  <View
                    style={[styles.remoteFill, styles.blurCoverElevated]}
                    …
                  >
                    <SoftBlurRemote
                      streamURL={tileStreamUrl}
                      active
                      style={styles.remoteFill}
                    />
                  </View>
                ) : (
                  <View … blurCoverElevated …>
                    <PartnerBlurVeil compact … />
                  </View>
                )
```

| Condition | Soft path | Fallback |
|-----------|-----------|----------|
| `privacyBlur && softBlurNative && streamURL && stream && !placeholder` | `<SoftBlurRemote streamURL={tileStreamUrl} active />` in `blurCoverElevated` | — |
| `privacyBlur` but soft ineligible | — | `<PartnerBlurVeil compact …/>` same elev shell |
| `!privacyBlur && partnerHideOn && idx===0` | — | Partner hide mosaic on **primary** tile only |
| placeholder / no stream | no SoftBlur | privacy still paints PartnerBlurVeil if `privacyBlur` |

### Hard constraints observed (good, unchanged post-MX)

| Rule | Evidence |
|------|----------|
| RTCView stays mounted under veil | `tile.stream && !tile.placeholder` → `<VideoView … zOrder={0} />` **before** privacy branch (**563–573**) — no `!privacyBlur` unmount gate |
| Every remote tile covered | privacy branch is **not** `idx===0`-only; all `splitTiles` get SoftBlur or PartnerBlurVeil |
| SurfaceView under RN | multi always `zOrder={0}` + `styles.blurCoverElevated` (elev 32) |
| Per-tile URL | `getStreamUrl(tile.stream)` — independent of `partnerStreamUrl` |
| Placeholder tiles | `placeholder: !stream` from `pickMultiRemoteTiles` (**stageStreams.ts:155**) → `tileSoftBlur` false; veil still if privacy |
| Self PiP in multi | **1218+** local only — **never** SoftBlur (self not veiled by stranger privacy) |

### Tile model (`stageStreams.ts`) still feeds multi remotes

| Piece | Line | Note |
|-------|------|------|
| `MAX_REMOTE_TILES = 3` | 16 | you + 3 remotes = 4-way |
| `pickStageStreams` multiRemote | 51–55 | `remoteStream2 \|\| remoteStream3 \|\| extraPeerCount > 0` |
| `pickMultiTiles` + `tiles[]` | 164–242 | includes optional `tileC` / `remoteStream3` |
| `placeholder: !stream` | 155 | soft path denied until stream lands |

`LiveStageVideo` still calls `pickMultiTiles` / `pickStageStreams` with `remoteStream2` / `remoteStream3` / `extraPeerCount` (**351–359**, **446–468**). MX multi MediaSession (`media2Ref` / tertiary in `live.tsx`) still lands streams into those props; stage soft map does not hardcode a single remote.

---

## 3. Hunt / lookingForThird vs true remotes (unchanged, correct)

```365:372:mobile/src/live/LiveStageVideo.tsx
  const huntingThird =
    !!lookingForThird &&
    !remoteStream2 &&
    !remoteStream3 &&
    (hasRemote || !!remoteStream) &&
    (phase === "matched" || phase === "search" || !!remoteStream);
  // Only true multi (2+ remote streams / extra peers) — not hunt layout alone
  const multiRemote = multiFromPeers;
```

| Layout | `multiRemote` | Privacy / SoftBlur |
|--------|---------------|--------------------|
| **True multi** (`remoteStream2` / `remoteStream3` / `extraPeerCount>0`) | yes → `splitTiles` | Per-tile soft/veil as above |
| **Find-3rd hunt** (`lookingForThird` && no stream2/3) | **no** (explicit — avoids unmount 1v1 RTC) | Partner half uses **1v1** path (`softBlurPartner` / SoftBlurRemote or PartnerBlurVeil on main). Looking half = `BrandLoadingLoop` only — **no stream, no SoftBlur, no PartnerBlurVeil** |
| **extraPeerCount without stream2 yet** | multiRemote true | second tile `placeholder: true` → veil if privacy, no SoftBlur until stream lands |

Hunt is correctly **not** multi SoftBlur territory: single partner stream, same 1v1 soft gate.

---

## 4. Android Modal vs soft (F9 gap closed on disk)

F9 residual: full-screen solid Modal occluded under-stage SoftBlur. **Current disk:**

```6556:6603:mobile/app/live.tsx
      {/*
        Android privacy Modal: TRANSPARENT chrome only so SoftBlurRemote on the
        stage can show through (full PartnerBlurVeil card hid soft live blur).
        …
      */}
      {showPrivacyBlur && Platform.OS === "android" ? (
        <Modal visible transparent={true} …>
          <Pressable style={{ … backgroundColor: "rgba(0,0,0,0.12)", … }}>
            {/* Bottom chrome only — no full-screen solid veil over SoftBlur */}
```

Static: multi SoftBlurRemote under transparent Modal is **architecturally visible**. Device multi still unproven.

---

## 5. verify-match-ux.mjs (optional)

```
L0 done: 30 ok, 0 fail
```

Relevant blur lines (all OK):
- PartnerBlurVeil on privacy path
- multi-remote keeps RTC under veil
- multi/1v1 veil uses zOrder 0 + blurCoverElevated
- multi A5 veil on all remote tiles (idx>0) + z0 + elev shell
- Android privacy Modal only while `showPrivacyBlur`

Script still does **not** assert `SoftBlurRemote` / `tileSoftBlur` / `getStreamUrl` per tile (veil A5 only). Optional future static check for soft multi path.

---

## 6. Wiring matrix (static, post-MX)

| Path | privacy | softNative (product ON + Android + native) | getStreamUrl | SoftBlurRemote | PartnerBlurVeil | Device evidence |
|------|---------|--------------------------------------------|--------------|----------------|-----------------|-----------------|
| Multi tile 0 (focus) | yes | per-tile URL | `tile.stream` | if eligible | else | **none multi** |
| Multi tile 1 (remote2) | yes | per-tile URL | `tile.stream` | if eligible | else | **none multi** |
| Multi tile 2 (remote3) | yes | per-tile URL | `tile.stream` | if eligible | else | **none multi** |
| Multi placeholder | yes | no | "" | no | yes | static only |
| Hunt partner | 1v1 path | partner URL | `remoteStream` | if eligible | else | F11–F15 1v1 only |
| Hunt looking strip | n/a | n/a | n/a | no | no | n/a |
| 1v1 main/PiP | yes | partner URL | `remoteStream` | if eligible | else | F15 Hold softNative=1 + Sink on **0.1.373-vc381** |

---

## 7. Gaps for future **device** multi SoftBlur (do not invent PASS)

1. **No multi match exercised** in F10–F15 (`peers=1` only) — residual open.
2. **N× VideoSink:** static wires N SoftBlurRemote with distinct streamURLs; native multi-instance sink attach **unproven** on device (only single Sink seen in 1v1 logcat).
3. **Logs:** stage `[blur] show … softNative=` is stage-wide (**274–277**), not per-tile; multi device smoke should filter `SoftBlurVideoView: Sink attached` count ≥ remote tile count.
4. **partnerHideOn** only `idx===0` — intentional; not a SoftBlur gap.
5. **verify-match-ux** does not assert soft multi path — veil A5 only.
6. Multi GOAL_MET / human smoke still **open** (wiki · SMOKE-NEXT · MULTI-CROSS plan).

---

## Explicit non-claims
- **NOT multi SoftBlur device PASS** (3-way / 4-way never smoked for soft)
- **NOT** invent multi softNative=1 / multi Sink count
- **NOT** re-open F11 Hold / F12 Off / F14 Intro / F15 Hold (1v1 baselines stand)
- **No** adb, APK, MediaSession thrash, force-push, product flag thrash

## Verdict
| Claim | Result |
|-------|--------|
| Product flag **true** on disk | **PASS (static)** `SOFT_BLUR_PRODUCT_ENABLED = true` |
| Multi-tile SoftBlur **wiring** (privacy + softNative + getStreamUrl per tile) present post-MX | **PASS (static)** |
| Multi PartnerBlurVeil A5 + z0 + elev + keep RTC | **PASS (static + verify-match-ux)** |
| Hunt vs multi separation correct | **PASS (static)** |
| Modal transparent for soft visibility | **PASS (static)** |
| Soft product path active on disk | **PASS (static ON)** — contrast F9 OFF |
| Multi SoftBlur **device** PASS | **NOT claimed** |

## Paths
| Artifact | Path |
|----------|------|
| LiveStageVideo multi map | `/home/drakosik/freenet-roulette/mobile/src/live/LiveStageVideo.tsx` (softNative **247**; multi map **508–666**; tileSoftBlur **526–532**; SoftBlurRemote multi **599–603**) |
| SoftBlurRemote + product flag | `/home/drakosik/freenet-roulette/mobile/src/live/SoftBlurRemote.tsx` (**34**, **53–63**, **89–93**, **116–134**) |
| Tile model | `/home/drakosik/freenet-roulette/mobile/src/live/stageStreams.ts` (`pickMultiTiles` / `placeholder`) |
| Modal chrome | `/home/drakosik/freenet-roulette/mobile/app/live.tsx` (**6556–6603**) |
| Prior multi static | `tasks/grok-loop/done/BLUR-F9-multi-soft-static-RESULT.md` |
| Prior 1v1 post-MX Hold | `tasks/grok-loop/done/BLUR-F15-hold-soft-reconfirm-RESULT.md` |

## Done criteria
- [x] Confirm product flag **true**
- [x] Confirm privacy + softNative + getStreamUrl per multi tile still present post-MX
- [x] Note hunt/lookingForThird vs remotes
- [x] Optional verify-match-ux (30 ok, 0 fail)
- [x] Explicit **NOT multi SoftBlur device PASS**
- [x] COMPLETE + card → done
