# L93s multi SoftBlur static reconfirm — RESULT

## Status
**COMPLETE** (static audit only)

## Gate
| Check | Result |
|-------|--------|
| Device multi SoftBlur | **NOT claimed** — no adb / no multi match / **no invent PASS** |
| Product edit | none (read-only) |
| APK / force-push / MediaSession thrash | none |
| Product flag thrash | none (left as-is) |
| Device multi SoftBlur | **still OPEN / NOT claimed** (F17–F69 keyguard/device hops OPEN; F69 RESULT = **BLOCKED** keyguard, not PASS) |
| F69 device evidence | **BLOCKED COMPLETE (keyguard)** — `done/BLUR-F69-multi-soft-unlock-retry-RESULT.md`; multi SoftBlur **NOT claimed** / **no MULTI_PASS** |
| Tip context | **0.1.374-vc382** (package tip from F17–F69 chain + `mobile/app.json` version **0.1.374** / versionCode **382**; this hop did **not** re-probe device) |

## OWN
- Read-only: `mobile/src/live/SoftBlurRemote.tsx`, `LiveStageVideo.tsx` multi-tile soft path, `mobile/src/live/index.ts` re-export
- Optional: `node mobile/scripts/verify-match-ux.mjs` → **30 ok, 0 fail**
- RESULT only; no product code change
- Card: `tasks/grok-loop/running/L93s-multi-soft-static-reconfirm.md` → `done/`

## Summary
Post-L92s residual static reconfirm (**L93s**): multi SoftBlur **wiring + product flag still intact** on disk. Product gate is **ON** (`SOFT_BLUR_PRODUCT_ENABLED = true` at SoftBlurRemote L34). Every `splitTiles` remote still resolves per-tile `getStreamUrl(tile.stream)` + `tileSoftBlur` and mounts either `SoftBlurRemote` or `PartnerBlurVeil` under elevated shell with RTCView kept mounted at `zOrder={0}`. Hunt path (`huntingThird`) is **separate** — does **not** use multi-tile soft map. **Not multi SoftBlur device PASS.** SCAFFOLD_DONE ≠ MULTI_PASS. Multi SoftBlur device **NOT claimed**.

**F69 update (unchanged honesty):** F69 card is `done/` with RESULT — status **BLOCKED COMPLETE (keyguard)** (`isKeyguardShowing=true` · no multi pair · softNative=0 evidence · **MULTI_PASS=NOT_CLAIMED**). That is **not** device multi SoftBlur PASS. Static ≠ device PASS. Do not invent. Keyguard chain **F17–F69** still blocks any device multi SoftBlur claim. F70 unlock retry remains backlog-gated (`tasks/grok-loop/backlog/BLUR-F70-multi-soft-unlock-retry.md`; once-hourly / human unlock) — **not** this hop.

### Continuity vs F16 / F19s / L80s–L92s (prior multi soft static)
| Item | F16 | F19s | L80s–L88s | L89s–L91s | L92s | L93s (this hop) |
|------|-----|------|-----------|-----------|------|-----------------|
| `SOFT_BLUR_PRODUCT_ENABLED` | **true** | **true** (L34) | **true** (L34) | **true** (L34) | **true** (L34) | **true** (still L34) |
| Multi per-tile SoftBlur map | present | still present | still present | still present | still present | **still present** (same gate chain) |
| Hunt ≠ multi soft | yes | yes | yes | yes | yes | **yes** (`huntingThird` vs `multiRemote`/`splitTiles`) |
| verify-match-ux | 30 ok, 0 fail | 30 ok, 0 fail | 30 ok, 0 fail | 30 ok, 0 fail | 30 ok, 0 fail | **30 ok, 0 fail** |
| Multi SoftBlur device | NOT claimed | NOT claimed | NOT claimed | NOT claimed | NOT claimed | **still NOT claimed** (static only; F69 BLOCKED keyguard) |

**Delta vs L92s:** SoftBlur product flag + multi-tile soft gate chain **unchanged** on independent re-read (same line anchors L34 / L89–93 / L526–532 / L563–573 / L591–624 / huntingThird L365–372).  
File hashes this hop (sha256): **match L92s** — SoftBlurRemote / LiveStageVideo / index identical digests (read-only; no edit). SoftBlur gate anchors match L92s narrative; no SoftBlur product delta observed. Full digests:

| File | sha256 |
|------|--------|
| `mobile/src/live/SoftBlurRemote.tsx` | `8b4dc54986fa01a73468e165ff0fe97dcd74c910b6b2ae931807d16fc75d7c3a` |
| `mobile/src/live/LiveStageVideo.tsx` | `30abb971ee7fd0335ed0ad154e0bea525c0e52fe6803ea80caff7c319f0129b7` |
| `mobile/src/live/index.ts` | `d50d7c5b54cf8841808d72ec66644e152eb2fa74536b5788d659e31f0d4a515b` |

Native patch still present: `mobile/android-patches/SoftBlur/SoftBlurVideoView.java` + `SoftBlurVideoViewManager.java` + `mobile/android-patches/SoftBlurVideoViewPackage.java` (not re-audited beyond existence; static product path is JS multi-tile map).

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

```563:624:mobile/src/live/LiveStageVideo.tsx
              {tile.stream && !tile.placeholder ? (
                <VideoView
                  stream={tile.stream}
                  streamEpoch={tile.epoch}
                  mirror={tile.mirror}
                  style={styles.remoteFill}
                  // Multi tiles are partner remotes only — always zOrder 0 so
                  // SoftBlurRemote / PartnerBlurVeil elevation can cover SurfaceView.
                  // Never mainZOrder: ≥1 composites above the entire RN window.
                  zOrder={0}
                />
              ) : (
                ...
              )}
              {/*
                Privacy: SoftBlurRemote over RTCView when stream URL + native;
                else PartnerBlurVeil compact frost (no stream / soft inactive).
                Elevated shell (elev 32) beats zOrder-0 SurfaceView on multi OEMs.
              */}
              {privacyBlur ? (
                tileSoftBlur ? (
                  <View
                    style={[styles.remoteFill, styles.blurCoverElevated]}
                    ...
                  >
                    <SoftBlurRemote
                      streamURL={tileStreamUrl}
                      active
                      style={styles.remoteFill}
                    />
                  </View>
                ) : (
                  <View
                    style={[styles.remoteFill, styles.blurCoverElevated]}
                    ...
                  >
                    <PartnerBlurVeil
                      compact
                      ...
                    />
                  </View>
                )
              ) : ...
```

| Multi soft gate | Required |
|-----------------|----------|
| `privacyBlur` | remote privacy on |
| `softBlurNative` | product ON + Android + native registered |
| `tileStreamUrl` non-empty | per-tile `getStreamUrl` |
| `tile.stream` truthy | real media |
| `!tile.placeholder` | not connecting shell |

Fallback: same elevated shell + `PartnerBlurVeil` compact when soft gate fails.

### Multi layout source

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

```446:468:mobile/src/live/LiveStageVideo.tsx
  const { tileA, tileB, tileC, tiles: multiTiles } = pickMultiTiles({ ... });
  const splitTiles =
    multiTiles && multiTiles.length > 0
      ? multiTiles
      : tileC
        ? [tileA, tileB, tileC]
        : [tileA, tileB];
```

`multiRemote` branch mounts `splitTiles.map` (L508+). Hunt path is separate (`huntingThird`) and never uses multi tiles soft map.

---

## 3. Non-claims table (required — do not invent)

| Claim | Status |
|-------|--------|
| Static: `SOFT_BLUR_PRODUCT_ENABLED === true` | **YES** (L34 reconfirmed) |
| Static: multi per-tile SoftBlur map present | **YES** (`tileSoftBlur` → SoftBlurRemote / veil) |
| Static: hunt ≠ multi soft map | **YES** |
| Static: RTCView zOrder 0 under multi soft cover | **YES** |
| Static: verify-match-ux blur multi checks | **YES** (30 ok, 0 fail) |
| Device multi SoftBlur PASS | **NOT claimed** |
| MULTI_PASS | **NOT claimed** |
| softNative=1 on multi session | **NOT claimed** (no device this hop) |
| SoftBlurVideoView Sink on multi tiles | **NOT claimed** |
| peers≥2 multi match smoke | **NOT claimed** |
| F17–F69 keyguard chain closed / unlocked | **NOT claimed** (F69 = BLOCKED keyguard) |
| SCAFFOLD_DONE = multi SoftBlur PASS | **false** (scaffold ≠ MULTI_PASS) |
| Product code / APK / adb this hop | **none** |

---

## 4. What this hop is / is not

| Is | Is not |
|----|--------|
| Read-only static reconfirm of flag + multi-tile wiring | Device multi SoftBlur PASS |
| Continuity check vs L92s (hashes match) | Unlock / Hold / multi pair attempt |
| Honest OPEN residual for device multi | Invent MULTI_PASS from scaffold or static alone |

---

## Risks / next

1. **Device multi SoftBlur remains OPEN** until human unlock + Hold prefs + multi pair (`peers≥2`) + softNative=1 + Sink evidence.
2. F70 (`backlog/BLUR-F70-multi-soft-unlock-retry.md`) is the unlock-gate retry slot — once-hourly / human unlock; **not** this static hop.
3. No claim of peers≥2 / softNative / Sink / MULTI_PASS from this RESULT.
4. Static wiring stable across L78s–L93s; thrashing product flag or multi map is unnecessary until device evidence fails.

## Merge advice
No product diff. RESULT-only hop. Safe to leave on branch as audit trail. Do not treat COMPLETE as multi SoftBlur ship.

## Checklist
- [x] Grep SoftBlur product flag under `mobile/`
- [x] Grep / read multi-tile SoftBlur path
- [x] RESULT with non-claims table
- [x] Explicit **no invent multi SoftBlur PASS** / **no MULTI_PASS**
- [x] No adb / APK / product edits / force-push
- [x] Card `running/L93s-multi-soft-static-reconfirm.md` → `done/`
