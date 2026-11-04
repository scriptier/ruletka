# L80s multi SoftBlur static reconfirm — RESULT

## Status
**COMPLETE** (static audit only)

## Gate
| Check | Result |
|-------|--------|
| Device multi SoftBlur | **NOT claimed** — no adb / no multi match / **no invent PASS** |
| Product edit | none (read-only) |
| APK / force-push / MediaSession thrash | none |
| Product flag thrash | none (left as-is) |
| Device multi SoftBlur | **still OPEN / NOT claimed** (F17–F68 keyguard/device hops OPEN) |

## OWN
- Read-only: `mobile/src/live/SoftBlurRemote.tsx`, `LiveStageVideo.tsx` multi-tile soft path, `mobile/src/live/index.ts` re-export
- Optional: `node mobile/scripts/verify-match-ux.mjs` → **30 ok, 0 fail**
- RESULT only; no product code change

## Summary
Post-F19s / L78s residual static reconfirm (**L80s**): multi SoftBlur **wiring + product flag still intact** on disk. Product gate is **ON** (`SOFT_BLUR_PRODUCT_ENABLED = true` at SoftBlurRemote L34). Every `splitTiles` remote still resolves per-tile `getStreamUrl(tile.stream)` + `tileSoftBlur` and mounts either `SoftBlurRemote` or `PartnerBlurVeil` under elevated shell with RTCView kept mounted at `zOrder={0}`. Hunt path (`huntingThird`) is **separate** — does **not** use multi-tile soft map. **Not multi SoftBlur device PASS.** SCAFFOLD_DONE ≠ MULTI_PASS. Multi SoftBlur device **NOT claimed**.

### Continuity vs F16 / F19s / L78s (prior multi soft static)
| Item | F16 | F19s | L78s | L80s (this hop) |
|------|-----|------|------|-----------------|
| `SOFT_BLUR_PRODUCT_ENABLED` | **true** | **true** (L34) | **true** (L34) | **true** (still L34) |
| Multi per-tile SoftBlur map | present | still present | still present | **still present** (same gate chain) |
| Hunt ≠ multi soft | yes | yes | yes | **yes** (`huntingThird` vs `multiRemote`/`splitTiles`) |
| verify-match-ux | 30 ok, 0 fail | 30 ok, 0 fail | 30 ok, 0 fail | **30 ok, 0 fail** |
| Multi SoftBlur device | NOT claimed | NOT claimed | NOT claimed | **still NOT claimed** (static only) |

**Delta vs L78s:** none on product SoftBlur / multi-tile sources. Same line anchors and same gate chain.

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
| Product switch | **true** (L34) |
| Platform | Android required |
| Native manager | `SoftBlurVideoView` via `UIManager` / `requireNativeComponent` |
| Export | `index.ts` re-exports `SOFT_BLUR_PRODUCT_ENABLED`, `isSoftBlurNativeAvailable`, `SoftBlurRemote`, `getStreamUrl` |

```56:62:mobile/src/live/index.ts
export {
  SoftBlurRemote,
  getStreamUrl,
  isSoftBlurNativeAvailable,
  SOFT_BLUR_NATIVE_NAME,
  SOFT_BLUR_PRODUCT_ENABLED,
  type SoftBlurRemoteProps,
} from "./SoftBlurRemote";
```

**Implication for multi (static):** with product **ON**, runtime Android + registered native ⇒ `softBlurNative === true` ⇒ `tileSoftBlur` can be true when privacy + per-tile stream URL. On iOS / missing native / empty URL → PartnerBlurVeil fallback (same map). **Runtime softNative=1 multi still unproven** (only 1v1 Sink evidence historically: F11/F14/F15/F16b).

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
| `privacyBlur` | ~243 `!!remoteBlurred` | Privacy on (eye / intro / hold) |
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
| `privacyBlur && softBlurNative && tileStreamUrl && stream && !placeholder` | **SoftBlurRemote** over elevated shell | — |
| privacy but soft gate fails | — | **PartnerBlurVeil** compact frost |
| no privacy | neither soft branch | clear video / hide cover as applicable |

### RTC kept under soft/veil (multi)

```563:573:mobile/src/live/LiveStageVideo.tsx
              {tile.stream && !tile.placeholder ? (
                <VideoView
                  stream={tile.stream}
                  streamEpoch={tile.epoch}
                  mirror={tile.mirror}
                  style={styles.remoteFill}
                  // Multi tiles are partner remotes only — always zOrder 0 so
                  // SoftBlurRemote / PartnerBlurVeil elevation can cover SurfaceView.
                  zOrder={0}
                />
```

- Multi remotes: always `zOrder={0}` so RN elev shell can cover SurfaceView.
- Soft/veil: `styles.blurCoverElevated` (elev 32) over RTC — never unmount partner RTC while veiled.

---

## 3. Hunt ≠ multi soft

| Path | Gate | Soft map |
|------|------|----------|
| **True multi** | `multiRemote` (= multiFromPeers; 2+ remotes / extra peers) | `splitTiles.map` → per-tile `getStreamUrl` + `tileSoftBlur` → SoftBlurRemote **or** PartnerBlurVeil |
| **Find-3rd hunt** | `huntingThird` (lookingForThird, no stream2/3, has partner) | **Does not** enter multi `splitTiles` soft map |

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

```441:441:mobile/src/live/LiveStageVideo.tsx
   * Hunt path is separate (huntingThird) and never uses multi tiles.
```

Hunt reuses the **1v1** partner soft path (`softBlurPartner` + SoftBlurRemote on main partner half + looking strip) — **not** the multi per-tile SoftBlur map. Scaffold find-3rd / SCAFFOLD_DONE **≠** multi SoftBlur PASS.

---

## 4. Non-claims table (explicit)

| Claim | Status |
|-------|--------|
| Multi SoftBlur **device** PASS | **NOT claimed** |
| MULTI_PASS | **NOT claimed** |
| softNative=1 on multi tiles at runtime | **NOT claimed** (static wiring only) |
| SCAFFOLD_DONE ⇒ multi SoftBlur | **false** — scaffold ≠ multi soft |
| Product flag thrash / disable | **not done** — left `true` |
| Device work this hop | **none** (no adb) |
| F17–F68 device multi SoftBlur | **still OPEN / NOT claimed** (keyguard chain) |

Prior device multi hops remain OPEN / NOT claimed (keyguard / unlock series F17–F68). This hop is **static only**.

**Explicit: no invent multi SoftBlur PASS.** Static wiring PASS ≠ device multi SoftBlur PASS. SCAFFOLD_DONE ≠ MULTI_PASS.

---

## 5. Optional unit harness

```
node mobile/scripts/verify-match-ux.mjs
L0 done: 30 ok, 0 fail
```

Relevant blur checks still green:
- blur: PartnerBlurVeil on privacy path
- blur path present
- blur: multi-remote keeps RTC under veil
- blur: multi/1v1 veil uses zOrder 0 + blurCoverElevated
- blur: multi A5 veil on all remote tiles (idx>0) + z0 + elev shell

---

## Verdict table (static only)

| Check | Result |
|-------|--------|
| Product flag **true** on disk | **PASS (static)** `SOFT_BLUR_PRODUCT_ENABLED = true` L34 |
| `isSoftBlurNativeAvailable` gated by flag | **PASS (static)** L90 |
| index re-export flag + SoftBlurRemote + getStreamUrl | **PASS (static)** |
| Multi per-tile `getStreamUrl` + `tileSoftBlur` | **PASS (static)** L526–532 |
| SoftBlurRemote **or** PartnerBlurVeil branch under elev | **PASS (static)** L591–624 |
| Multi RTC `zOrder={0}` kept mounted | **PASS (static)** L563–573 |
| Hunt ≠ multi soft path | **PASS (static)** huntingThird separate |
| verify-match-ux | **30 ok, 0 fail** |
| Multi SoftBlur **device** | **NOT claimed** (this hop static only; F17–F68 device OPEN) |

---

## Must not (confirmed)

- No product code edits
- No adb / device multi attempt
- No APK rebuild/install
- No force-push
- No live.js dual-write
- **No invent multi SoftBlur PASS / MULTI_PASS**

## Completed
- UTC: **2026-08-12** (L80s static reconfirm hop)
- Outcome: **COMPLETE (static)** — multi SoftBlur wiring + product flag **intact** vs F16/F19s/L78s
- Honesty: **never invent multi SoftBlur device PASS**
