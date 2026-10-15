# BM2-remoteStream3-audit — RESULT

**Status:** COMPLETE (static audit)  
**OWN:** Android media3 → `remoteStream3` → `LiveStageVideo` mount path (read-only)  
**Date:** 2026-08-12T02:56:59Z  
**HEAD:** `a0d195d`  
**Root:** `/home/drakosik/freenet-roulette`  
**Code change:** none  
**APK / phone / deploy:** none  
**Multi product PASS invent:** **none** (human 4-way smoke still OPEN)

## Goal
Audit live.tsx / LiveStageVideo **media3** mount for 4-way (`remoteStream3`), per plan C1 (`knowledge/specs/BLUR-MULTI-FINISH-PLAN.md`).

## Verify

```bash
cd /home/drakosik/freenet-roulette
node mobile/src/live/stageStreams.test.mjs
# stageStreams.test.mjs: ok
# EXIT:0
```

| Item | Result |
|------|--------|
| `stageStreams.test.mjs` | **PASS** (`ok`, exit 0) |
| Code edit | none |
| Device / multi smoke | not run / not claimed |

---

## End-to-end mount path (on disk)

```
Hub Matched peers[]
  → allPeers / pick primary
  → extras = peers except primary
  → second = extras[0], third = extras[1]          # live.tsx ~2107–2110
  → setExtraPeers(extras)                            # ~2801

Tertiary PC lifecycle (media3):
  drop (!third | legacy)  → closeCall(keepLocal) + setRemoteStream3(null)
  keep (same tertiaryPeerId) → log keep, no restart
  replace → closeCall(keepLocal) + tertiaryPeerId=third + adoptLocalStream(primary local)
  startTertiary() parallel with startSecondary / primary  # ~3049–3133
    adoptLocalStream(local)  # NO second GUM
    setForceRelay / setIceConfig from primary
    startCall({ isOfferer, forceRelay })

media3.setHandlers:
  onRemoteStream → setRemoteStream3(s) + remoteEpoch3++ (URL guard)
                 → ends hunt (huntingWithPartner / findThirdPending = false)
  onSignal → hub.signal(kind, payload, tertiaryPeerId)   # signal3 send
  hub signal from === tertiaryPeerId → media3.handleRemoteSignal  # ~3266–3277

LiveStageVideo props (~5642–5680):
  remoteStream3, remoteEpoch3, extraPeerCount, thirdName
  lookingForThird = !remote2 && !remote3 && remote && (hunt flags)

LiveStageVideo / stageStreams:
  multiRemote = remoteStream2 || remoteStream3 || extraPeerCount > 0
  huntingThird requires NO remote2/3 (does not remount 1v1 for hunt)
  pickMultiTiles → tileC when remoteStream3 || thirdName
  multi split maps splitTiles → VideoView(stream, streamEpoch)
  multi self PiP stays mounted under multiRemote
```

---

## Wire checklist

| Concern | Location | Verdict |
|---------|----------|---------|
| `media3Ref` + `MediaSession` tertiary | `live.tsx` L206–207, L936–937 | **PASS** present |
| `remoteStream3` / `remoteEpoch3` state | L523–528 | **PASS** |
| URL epoch guard (`remoteStream3UrlRef`) | L532, L1591–1601 | **PASS** (same pattern as media2) |
| `tertiaryPeerId` | L217, set on multi bind | **PASS** |
| `onRemoteStream` → state + hunt end | L1589–1615 | **PASS** |
| `signal3` send / recv route | L1617–1624, L3266–3277 | **PASS** |
| `third = extras[1]` | L2109–2110 | **PASS** |
| `keepTertiary` same peer id | L2121–2127 | **PASS** (inline; not in matchContinuity) |
| `adoptLocalStream` no 2nd GUM | L2998–2999, L3058 | **PASS** |
| `startTertiary` parallel kick | L3049–3133 | **PASS** |
| Multi-audio gate `nPeers >= 2` includes m3 secondary | L2940–2957 | **PASS** (not party_browse alone) |
| Mic / cam / mute / ICE / data-saver / net hints / ICE restart | media3 mirrored | **PASS** present |
| Cleanup hangup / partner_left / next / stop / start / unmount | keepLocal: true | **PASS** |
| `LiveStageVideo` stream3 + epoch3 props | L5647–5650 | **PASS** |
| Hunt: `lookingForThird` excludes remote3 | L5655–5659 | **PASS** |
| `huntingThird` does not flip multi for hunt | LiveStageVideo L354–361 | **PASS** |
| `stageStreams` MAX_REMOTE_TILES=3 + tileC | stageStreams.ts | **PASS** |
| Unit `stageStreams.test.mjs` | ok | **PASS** |
| Cap extras | `MAX_EXTRA_PEERS=3` matchPeers.ts | **PASS** (reference) |

---

## Residual findings (static — not multi PASS)

### R1 — Orphan 3rd tile in **3-way** (HIGH)

P0 claimed: *“stream3 + thirdName only when `extraPeers[1]` exists (no orphan 3rd tile in 3-way)”*  
**On-disk code does not match that claim.**

```tsx
// mobile/app/live.tsx ~5680 — always truthy thirdName
thirdName={extraPeers[1]?.name || t("mobile.live.peer3") || "…"}
```

```ts
// stageStreams.ts ~208–215
if (remoteStream3 || thirdName) {
  remotes.push({ stream: remoteStream3, ... }); // tileC always when thirdName
}
```

| Scenario | multiRemote | tile count with current thirdName |
|----------|-------------|-------------------------------------|
| 3-way (`extraPeers.length=1`, remote2 live) | true | **3** (tileC placeholder “Peer 3” / i18n) — **orphan** |
| 3-way if `thirdName=""` | true | **2** (correct) |
| 4-way (`extraPeers[1]` +/or remote3) | true | 3 (correct) |

Contract unit explicitly: *no third stream and no thirdName → stays 2-way (no tileC)* (`stageStreams.test.mjs`).  
live.tsx always supplies thirdName → **3-way multi paints a connecting orphan slot**.

**Minimal fix (next hop — not this RESULT):**

```tsx
thirdName={
  extraPeers[1]
    ? extraPeers[1].name || t("mobile.live.peer3") || "…"
    : ""
}
```

### R2 — Tertiary promote continuity incomplete (LOW / known)

`matchContinuity` only knows primary/secondary/`promoteSecondary`. Tertiary is **keep-by-peer-id only** (inline). No promote tertiary → secondary/primary when slots collapse. P0 already noted “Not done.”

### R3 — `remoteStream3UrlRef` never cleared on hangup (LOW)

URL ref set on stream bind; hangup clears stream state but not `remoteStream3UrlRef.current = ""`. Same pattern as media2. Theoretical epoch skip if identical URL reappears after session.

### R4 — No focus on third tile (INFO)

`focusExtra` maps to focusIndex 0|1 only — *“No third-focus in this API”* (stageStreams L218). 4-way can paint tileC but cannot promote it to focused half via existing toggle.

### R5 — Human 4-way smoke OPEN

No device APK / multi harness proof this hop. **Do not invent 4-way PASS.**

---

## Honest summary

| Claim | Result |
|-------|--------|
| media3 PC + handlers + signal3 mount path exists | **PASS** (static) |
| remoteStream3 state → LiveStageVideo → VideoView when stream binds | **PASS** (static) |
| adoptLocalStream tertiary (no 2nd GUM) | **PASS** (static) |
| Parallel startCall3 with multi | **PASS** (static) |
| Hunt layout not remounted by media3 alone | **PASS** (static) |
| 3-way does not paint orphan 3rd tile | **FAIL** residual R1 |
| 4-way face live on device | **OPEN** (human / harness) |
| Multi product GOAL_MET | **not claimed** |

**GOAL_MET (static wire):** mostly yes for mount plumbing.  
**GOAL_MET (product 4-way):** no — residual orphan thirdName + smoke OPEN.

## Fix
None this hop (RESULT read-only). Recommend follow-up lane: gate `thirdName` (and only then optional placeholder when `extraPeers[1]` without stream yet). CSS orphan lane (BM2-css-4way-orphan) is web `#tile` / stage-count-4 — separate OWN.

## Must-not confirmed

| Rule | Verdict |
|------|---------|
| No invent multi PASS | **honored** |
| No MediaSession rewrite / dual-write | **honored** (read-only) |
| No ICE thrash / pool>0 | **untouched** |
| No APK / deploy | **none** |

## Files touched
- **None** (audit only)
- RESULT: `tasks/grok-loop/done/BM2-remoteStream3-audit-RESULT.md`
- Task card: `tasks/grok-loop/backlog/BM2-remoteStream3-audit.md` → `done/BM2-remoteStream3-audit.md`

## Connect risk
**None** — static audit. No MediaSession / live.js thrash. Residual R1 is layout-only (orphan tile), not ICE.

## Merge advice
No merge. Next: one-line `thirdName` gate (live.tsx multi UI only) + unit if desired; keep multi smoke human/harness.

## COMPLETE or BLOCKED
**COMPLETE** — audit done; residual R1 documented; no multi PASS invent.
