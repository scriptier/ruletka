# MX4-layout — RESULT

**Status:** COMPLETE (layout code + static checklist)  
**Date:** 2026-08-12  
**Root:** `/home/drakosik/freenet-roulette`  
**OWN:** `ui/live-stage.css` · `ui/live.html` (`live-stage.css?v=` only) · `mobile/src/live/LiveStageVideo.tsx` layout only  
**Skill:** `multi-party-stage`  
**Code change:** yes (CSS + LiveStageVideo layout gate)  
**APK / deploy / MediaSession / ICE:** none  
**Multi product PASS invent:** **none** (human 3/4-way + find-3rd smoke still OPEN)

## Goal

No orphan black tiles; Android hunt column mid-split; PC trio hunting columns.

Task: `tasks/grok-loop/running/MX4-layout-3-4-way.md`

## DONE WHEN (layout / static)

| Check | Result |
|-------|--------|
| PC stage-count-3/4 orphan CSS guarded | **PASS** (static + residual W7 #3 fixed) |
| Android 3-way does not paint orphan 3rd tile | **PASS** (layout gate in LiveStageVideo) |
| Android hunt = column mid-split (top partner · bottom looking) | **PASS** (unchanged contract; re-audited) |
| Hunt does **not** flip `multiRemote` / remount RTC | **PASS** |
| PC trio hunting columns (partner \| looking \| you) | **PASS** (CSS present; shell present) |
| Remote shell in live.html (`#tile-third`, `#remote2-wrap`) | **PASS** (already present; no shell invent) |
| Cache bump `live-stage.css?v=` | **392** (was 391) |
| Human multi / find-3rd faces smoke | **OPEN** — not claimed |

---

## Changes

### 1. `mobile/src/live/LiveStageVideo.tsx` — layout-only orphan gate

**Problem (BM2 R1 residual):** `pickMultiTiles` adds `tileC` whenever `thirdName` is truthy. `live.tsx` still supplies a default `Peer 3` even when `extraPeers[1]` is absent → **3-way multi paints a connecting orphan third tile**.

`live.tsx` is **not** this lane’s OWN (MX2). Layout fix here:

```ts
// Require real 4-way signal before painting tileC
const thirdNameForTiles =
  remoteStream3 || extraPeerCount >= 2 ? thirdName || "" : "";
// pass thirdNameForTiles into pickMultiTiles
```

| Scenario | `extraPeerCount` | `remoteStream3` | tileC painted? |
|----------|------------------|-----------------|----------------|
| 3-way (`extras[0]` only) | 1 | no | **no** |
| 4-way connecting (`extras[1]` present, no stream yet) | ≥2 | no | **yes** (placeholder) |
| 4-way live | ≥2 | yes | **yes** |
| Stream3 race (stream before extras length) | any | yes | **yes** |

Hunt path unchanged: `huntingThird` never uses `multiRemote` / `splitTiles`.

### 2. `ui/live-stage.css` — stage-count-3 orphan / empty-cell floors

| Fix | Where | Why |
|-----|-------|-----|
| `.tile-third:not([hidden])` on count-3 show | ~L18707 | W7 residual #3: unguarded `display:block !important` could force third slot |
| Local `grid-column: 1 / -1` default for count-3 | ~L18714 + ~L18830 | P0 claimed full-bottom you; base had empty black bottom-right cell under partner\|third |

Unchanged (already green from BM2-css-4way-orphan / multi polish block):

- `#tile-third[hidden]` / `#remote2-wrap[hidden]` zero footprint  
- stage-count-4 grid 2×2 + stack split with `:not([hidden])`  
- stage-trio-searching FINAL LOCK (partner column live; looking middle only)  
- Transparent multi vid backgrounds (no solid black walls)

### 3. `ui/live.html` — cache only

`live-stage.css?v=391` → **`?v=392`**

No remote shell invent (`#tile-third`, `#remote-third`, `#third-empty`, `#remote2-wrap` already on disk).

---

## Layout checklist (3-way / 4-way / hunt)

### A. Find-3rd **hunt** (1 media link)

| # | Contract | Surface | Verdict |
|---|----------|---------|---------|
| H1 | Phone portrait: **flex column** horizontal mid-split | `liveStyles.splitRemote` `flexDirection:"column"` | **PASS** |
| H2 | Top = partner RTC path (same 1v1 `VideoView`) | LiveStageVideo non-`multiRemote` branch | **PASS** |
| H3 | Bottom = `BrandLoadingLoop` + looking caption | `testID=live-looking-for-third` | **PASS** |
| H4 | Does **not** set `multiRemote` for hunt | `huntingThird` separate; `multiRemote = multiFromPeers` only | **PASS** |
| H5 | `lookingForThird` requires live remote + hunt flags, no remote2/3 | live.tsx prop (read-only this hop) | **PASS** (static) |
| H6 | Partner floors ≥45% / looking ≥35% | `splitHuntTile*` | **PASS** |
| H7 | Wide landscape may row (`splitRemoteWide`) | aspect ≥ 1.15 | **PASS** |
| H8 | PC trio: partner \| looking \| you | `enableTrioLayout` + `stage-trio` + `stage-trio-searching` | **PASS** (static) |
| H9 | Looking brand only middle (`#tile-third` / `#third-empty`) | FINAL LOCK CSS | **PASS** |
| H10 | Partner empty brand never covers live partner during hunt | `#remote-empty` hide under trio-searching | **PASS** |
| H11 | Human faces live ≥30s while hunting | — | **OPEN** / not claimed |

### B. **3-way** (you + 2 remotes)

| # | Contract | Surface | Verdict |
|---|----------|---------|---------|
| 3A | Android: **2** remote tiles (no orphan Peer 3) | LiveStageVideo `thirdNameForTiles` gate | **PASS** (layout) |
| 3B | PC: `#remote2-wrap[hidden]` / `#tile-third[hidden]` zero footprint | multi polish block | **PASS** |
| 3C | PC grid count-3: no empty black cell (local full bottom) | CSS this hop | **PASS** (static) |
| 3D | PC stack: equal columns when third or remote2 live | stage-layout-stack | **PASS** (static) |
| 3E | count-3 `.tile-third` show uses `:not([hidden])` | CSS this hop | **PASS** |
| 3F | Human 3-way faces ≥60s | — | **OPEN** / not claimed |

### C. **4-way** (you + 3 remotes)

| # | Contract | Surface | Verdict |
|---|----------|---------|---------|
| 4A | Android: tileC when `remoteStream3` or `extraPeerCount≥2` | LiveStageVideo gate | **PASS** (layout) |
| 4B | PC grid count-4: 2×2 (remote\|remote2 / third\|local) | multi polish L20360+ | **PASS** (static) |
| 4C | remote2 / third show paths `:not([hidden])` | BM2 + retained | **PASS** |
| 4D | Hidden slots zero footprint | `#remote2-wrap[hidden]`, `#tile-third[hidden]` | **PASS** |
| 4E | Portrait stack-4 → 2×2 grid (not 3 thin columns) | @media portrait | **PASS** |
| 4F | Shell `#remote-third` exists (no invent remote4) | live.html | **PASS** |
| 4G | Human 4-way faces / no permanent black orphan product | — | **OPEN** / not claimed |

---

## Hunt re-audit (no RTC remount)

```
lookingForThird (prop) && !remote2 && !remote3 && has partner
  → huntingThird = true
  → multiRemote stays multiFromPeers only (false during pure hunt)
  → render: outer splitRemote column
       · partner half: same VideoView(displayMainStream) as 1v1
       · looking half: BrandLoadingLoop + caption (sibling strip)
```

Comment lock retained: *“1v1 OR find-3rd hunt: keep partner VideoView mounted; only wrap layout”*.

---

## Files touched

| File | Change |
|------|--------|
| `/home/drakosik/freenet-roulette/mobile/src/live/LiveStageVideo.tsx` | `thirdNameForTiles` layout gate |
| `/home/drakosik/freenet-roulette/ui/live-stage.css` | count-3 third `:not([hidden])` + local full-bottom |
| `/home/drakosik/freenet-roulette/ui/live.html` | `live-stage.css?v=392` |

**Not edited:** `live.js`, `webrtc.js`, MediaSession, `live.tsx`, `stageStreams.ts`, ICE/pool, APK, deploy.

---

## Explicit non-claims

| Claim | Verdict |
|-------|---------|
| Multi 3-way / 4-way product PASS / GOAL_MET | **NOT claimed** |
| Find-3rd human faces live ≥30s | **NOT claimed** — smoke OPEN |
| live.tsx `thirdName={extraPeers[1]?…:""}` fix | **NOT this OWN** — residual note for MX2 / next |
| Prod CDN tip ships `?v=392` | **NOT claimed** — needs human deploy |
| APK ships Android gate | **NOT claimed** — no rebuild this hop |
| MediaSession / clone / softKeep product | **out of OWN** |

Static **layout contract** PASS ≠ multi product PASS. **No invent multi PASS.**

---

## Residual / handoff

1. **live.tsx** still always passes default `thirdName` (BM2 R1). Layout gate mitigates paint; clean fix remains MX2/live.tsx:  
   `thirdName={extraPeers[1] ? (extraPeers[1].name \|\| t(…) \|\| "…") : ""}`
2. Human browser/device multi smoke still required for GOAL_MET.
3. Deploy web when human authorizes so clients load `live-stage.css?v=392`.

## Connect risk

**None.** Layout CSS + RN layout branch only. No ICE / pool / force_relay / MediaSession / dual-write.

## COMPLETE

Layout hop done: Android orphan 3rd tile gated in LiveStageVideo; PC count-3 empty-cell + unguarded third show fixed; hunt column contract re-confirmed; cache **392**. Human multi smoke remains **OPEN**.
