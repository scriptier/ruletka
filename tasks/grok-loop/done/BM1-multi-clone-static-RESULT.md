# BM1-multi-clone-static — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` + `mobile/src/media/MediaSession.ts` (read-only)  
**Date:** 2026-08-12T02:48:49Z  
**Code change:** none (static recheck only)

## Goal
Confirm secondary `track.clone()` on **web** + **Android MediaSession**; audio push must **not** `setLocalStream(preview)`.

## Verify commands

```bash
cd /home/drakosik/freenet-roulette
node --check ui/live.js                                    # EXIT:0
node mobile/src/media/mediasessionMultiSafety.test.mjs     # ok  EXIT:0
```

| Check | Result |
|-------|--------|
| `node --check ui/live.js` | **PASS** (exit 0) |
| `mediasessionMultiSafety.test.mjs` | **PASS** (`ok`, exit 0) |
| Code edit | none |
| APK / deploy | none (constraint) |

---

## 1. Web — secondary video `track.clone()` — **PASS**

| Symbol | Location | Role | Verdict |
|--------|----------|------|---------|
| `ensureOutboundVideoClone` | `ui/live.js` L17908–17935 | `real.clone()` → `pc._outboundVidClone`; fallback real if clone missing/fails | PASS |
| `outboundVideoTrackForPc` | L17943–17956 | solo (`size<=1`) → real; multi primary → real; **every non-primary → clone always** | PASS |
| `pushOutboundVideoTracks` | L18113–18233 | multi: `useTrack = outboundVideoTrackForPc(pc, real)` (L18164–18167) | PASS |
| `pickPrimaryPeerPc` | L17881–17888 | teammate preferred primary keeps real for `#local` | PASS |
| `releasePeerOutboundVideoClone` | L17891–17901 | stops **clone only** on release | PASS |
| joinPeers bind | L27398–27444 | per-PC `MediaStream` with `outboundVideoTrackForPc`; solo-only preview share | PASS |
| kickSolo bind | L26745–26772 | same clone-or-real; multi without tracks leaves empty for later push | PASS |

Contract on disk (skill multi-party-stage #6):

```text
// Multi (size>=2): primary = real (feeds #local); every other PC = clone (always,
// not only Chrome Android).
// Always clone non-primary when multi — shared track kills outbound on many UAs
return ensureOutboundVideoClone(pc, real);
```

---

## 2. Web — audio push never `setLocalStream(preview)` — **PASS**

| Item | Location | Verdict |
|------|----------|---------|
| `pushOutboundAudioTracks` | L17743–17810 | **audio-only** `replaceTrack` / `addTrack(audio)` |
| Explicit ban comment | L17752–17753 | “do NOT setLocalStream(preview) here” |
| No `setLocalStream` in audio push body | grep body | **PASS** — only sender replace + `pc.localStream` audio track swap |
| Video clones preserved on mic push | L17794–17803 | remove/add **audio** tracks on existing `pc.localStream` only |

### `setLocalStream(previewStream)` call-site audit

| Line | Context | Multi-safe? |
|------|---------|-------------|
| L18214 | fallback only when `!multi && previewStream` | **Yes** — solo |
| L26766 | `else if (peerPcs.size <= 1 && previewStream …)` | **Yes** — solo |
| L26770 / L26777 | gated `peerPcs.size <= 1` | **Yes** — solo |
| L27422 / L27428 | “Solo only — multi must not share preview track” | **Yes** — solo |
| L27403 | self-blur path (`localStreamForPeerOutbound() \|\| previewStream`) | privacy black path, not multi secondary real-share |
| Multi happy path | L18191–18199, L26759–26763, L27416–27419 | **per-PC MediaStream** with cloned video + audio track |

**No multi secondary path rebinds full `previewStream`** (would re-share the same video track → Chrome Android freeze).

---

## 3. Android MediaSession — secondary clone + no preview rebind — **PASS**

There is **no** `setLocalStream` on `MediaSession.ts`. Multi secondary binds via **`adoptLocalStream`**.

| Symbol | Location | Role | Verdict |
|--------|----------|------|---------|
| `adoptLocalStream` | L956–1003 | `secondaryLink=true`; `preferClone` default **true** | PASS |
| `tryBuildSecondaryOutbound` | L1064–1149 | `track.clone()` video (+ audio if easy); share fallback | PASS |
| `ownedCloneTracks` / `releaseOwnedClones` | L496, L1152–1160 | stop **clones only** | PASS |
| `localStreamOwned = ownsAll` | L995 | shared/mixed → unowned (never stop primary) | PASS |
| `mayStopLocal` | L5776 | `localStreamOwned && !secondaryLink` | PASS |
| `closeCall` shared drop | L5789–5813 | `closeCall_no_stop_shared` / `closeCall_secondary_drop_local_ref` | PASS |
| `setMultiPeerAudio({secondary})` | L1203–1230 | encode ceiling only (low); **no GUM / no video rebind** | PASS |
| No GUM secondary | ensure/open/refresh | skip markers present | PASS |

Clone proof (tryBuildSecondaryOutbound):

```text
const cloner = t.clone;
if (typeof cloner === "function") {
  const c = cloner.call(t);
  clones.push(c); outTracks.push(c);
  if (kind === "video") clonedVideo = true;
}
// else share original (must not stop on secondary close)
```

Call sites (out of OWN, reference only — `mobile/app/live.tsx`):

- media2 / media3: `adoptLocalStream(primary local)` on multi join (~2977, 2999, 3021, 3058)
- close secondary: `keepLocal: true`
- multi-audio: `m1.setMultiPeerAudio(true)` / `m2|m3.setMultiPeerAudio(true, { secondary: true })` only when `nPeers >= 2`

---

## 4. Unit / static table (Android)

| Invariant (`mediasessionMultiSafety.test.mjs`) | Result |
|------------------------------------------------|--------|
| `iceCandidatePoolSize = 0` | PASS |
| Pure answer budget ≤ 280 | PASS |
| waitForIceGather no 250 floor | PASS |
| Secondary no-GUM markers | PASS |
| `mayStopLocal = owned && !secondary` | PASS |
| adopt + clone path present | PASS |
| flip / refresh secondary guards | PASS |

---

## Honest summary

| Claim | Result |
|-------|--------|
| Web secondary video = `track.clone()` when `peerPcs.size ≥ 2` | **PASS** |
| Web primary keeps real preview track | **PASS** |
| Web audio push = replaceTrack audio only (no `setLocalStream(preview)`) | **PASS** |
| Web multi bind uses per-PC MediaStream (clone video) | **PASS** |
| Android secondary prefers `track.clone()` via `adoptLocalStream` | **PASS** |
| Android never `setLocalStream(preview)` (API absent; adopt path) | **PASS** |
| Android secondary close cannot `stop()` primary preview | **PASS** |
| Human 3-way device smoke | **not claimed** (OPEN / human gate) |

**GOAL_MET (static):** yes for on-disk clone + audio-push contracts.  
No product multi smoke invent; device hangup smoke remains human.

## Fix
None this hop (RESULT read-only). Contracts match `multi-party-stage` media rules #6 (clone secondaries) and #5/#audio push (no preview re-share).

## Must-not confirmed
| Rule | Verdict |
|------|---------|
| No ICE thrash / pool>0 | untouched |
| No dual-write / code edit | read-only |
| No APK / deploy | none |

## Files touched
- **None** (audit only)
- RESULT: `tasks/grok-loop/done/BM1-multi-clone-static-RESULT.md`
- Task: `running/BM1-multi-clone-static.md` → `done/BM1-multi-clone-static.md`

## Connect risk
**None** — static verify only. No MediaSession rewrite, no live.js multi thrash, no force_relay.

## Merge advice
No merge. Clone + audio-push safety still green on disk + unit. Next human gate: 3-way Chrome Android / RN — local cam stays live after 2nd PC + secondary hangup.

## COMPLETE or BLOCKED
**COMPLETE**
