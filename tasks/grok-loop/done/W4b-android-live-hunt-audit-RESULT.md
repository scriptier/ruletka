# W4b Android live hunt layout — static audit RESULT

**Status:** PASS (read-only; no code edits)  
**Date:** 2026-08-11  
**Scope:** `huntingWithPartner` / `lookingForThird` / `multiRemote` mount & layout paths  
**APK:** none (code-only)  
**Re-audit:** independent code trace of live.tsx · LiveStageVideo · liveStyles · stageStreams (no drift from prior PASS)

---

## DONE WHEN (audit)

| Check | Result |
|-------|--------|
| Hunt keeps partner RTCView mounted (no multi remount) | **PASS** |
| Looking pane is a separate sibling (not partner tile swap) | **PASS** |
| Phone portrait uses flex **column** mid-split | **PASS** |
| `multiRemote` only for real multi (stream2/3 / extras) | **PASS** |

---

## Trace

### 1. `live.tsx` — hunt flags → stage prop

| Source | Effect |
|--------|--------|
| `huntingWithPartner` state (~332) | Set true by `browseTogether` (~4751), `findThirdInvite` (~4768), `enterHuntingWithPartner` (~4796), match with `party_browse` + no extras (~2811) |
| `findThirdPending` | OR’d into looking prop while invite in flight |
| Clear paths | hangup / next / stop / reject / multi extras (~2808) / cancelFindThird (~4785) / non-party match / find_third reject (~3543) |

**`lookingForThird` prop** (wired into `LiveStageVideo`, ~5655–5659):

```text
!remoteStream2 && !remoteStream3 && !!remoteStream
  && !!(huntingWithPartner || findThirdPending)
```

- Requires live primary `remoteStream` (no pure-search brand fullscreen).
- Ends when second/third remote media lands.
- Does **not** drive `multiRemote` by itself.

**`enterHuntingWithPartner`** (~4795–4805): sets hunt flags + `party_browse`, forces `phase = matched` — never demotes to pure search (which would full-screen brand and drop partner).

### 2. `LiveStageVideo.tsx` — hunt vs multi

**`huntingThird`** (~354–359):

```text
lookingForThird
  && !remoteStream2 && !remoteStream3
  && (hasRemote || remoteStream)
  && (phase matched|search || remoteStream)
```

**`multiRemote`** (~361): `multiFromPeers` only (`pickStageStreams` → stream2/3 or `extraPeerCount > 0`).  
Hunt does **not** OR into multi.

Comment lock (~350–351, ~429, ~594): *Must NOT flip multiRemote (that unmounts 1v1 RTCView → partner freezes)*; *1v1 OR find-3rd hunt: keep partner VideoView mounted; only wrap layout*.

### 3. Render tree (1v1 / hunt branch)

```
multiRemote ? [split multi tiles…] : (
  outer View: huntingThird ? splitRemote|splitRemoteWide : remoteFill
    partner half: huntingThird ? splitHuntTile* : remoteFill
      SwipeSkipOverlay → VideoView (displayMainStream)   ← same 1v1 RTCView
    huntingThird ? looking half (BrandLoadingLoop + caption) : null
  PiP (1v1 path; !multiRemote)
)
```

- Entering hunt stays on the **else** of `multiRemote ? …` (~593+) — no switch to `pickMultiTiles` / tile `VideoView`s.
- Looking pane is a **sibling** under the outer split (`testID="live-looking-for-third"`, ~934–970), not a remount of the partner surface.
- Partner `VideoView` stays mounted when `mountMainVideo` (`displayMainStream`); privacy still covers rather than unmounts.

### 4. Phone column flex (`liveStyles.ts`)

| Style | Direction / role |
|-------|------------------|
| `splitRemote` (~670–673) | `flexDirection: "column"` — phone portrait mid-split |
| `splitRemoteWide` (~675–678) | `flexDirection: "row"` — landscape only (`stageW/stageH ≥ 1.15`) |
| `splitHuntTile` (~719–728) | partner ~50%, `minHeight: "45%"` |
| `splitHuntTileLookingMin` (~734–736) | looking floor `minHeight: "35%"` |

Matches product: phone **horizontal midline** (top partner · bottom looking), not PC side-by-side unless wide.

### 5. `stageStreams.ts` / tests

- `multiRemote` = stream2 ‖ stream3 ‖ `extraPeerCount > 0` only (~51–55).
- Hunt UI is intentionally **out of** `stageStreams` (documented in `stageStreams.test.mjs` header ~6–12).

---

## Findings

1. **No RTC remount on find-3rd:** hunt wraps the existing 1v1 `VideoView`; only outer styles + looking sibling change.
2. **Looking pane separate:** `BrandLoadingLoop` + `lookingLabel` in bottom/right half; partner half independent.
3. **Phone column:** default hunt uses `splitRemote` column; landscape opts into row.
4. **Clear gates:** `remoteStream2`/`3` kill `lookingForThird`; extras kill `huntingWithPartner`; multi branch then owns layout.
5. **No one-line bug** with static proof requiring a fix.

**Edge (not a FAIL):** if `extraPeerCount > 0` before `remoteStream2` binds, `multiRemote` wins and hunt UI yields to multi tiles/placeholder — intentional handoff, not hunt remount of partner-only 1v1.

---

## Files touched

**None** (read-only PASS).

Reviewed:

- `/home/drakosik/freenet-roulette/mobile/app/live.tsx`
- `/home/drakosik/freenet-roulette/mobile/src/live/LiveStageVideo.tsx`
- `/home/drakosik/freenet-roulette/mobile/src/live/liveStyles.ts`
- `/home/drakosik/freenet-roulette/mobile/src/live/stageStreams.ts`
- `/home/drakosik/freenet-roulette/mobile/src/live/stageStreams.test.mjs` (header + multiRemote unit cases)

---

## Connect risk

**None** from this audit. No ICE / MediaSession / pool / deploy changes. Hunt path is UI layout only and already aligned with CONNECTIVITY / multi-party gotchas (do not flip `multiRemote` for hunt-only).

---

## COMPLETE

Static audit **PASS**. Partner RTCView remains on the 1v1 mount path during `huntingWithPartner` / `lookingForThird`; looking strip is a separate pane; phone uses flex column mid-split. No fix required; no APK.
