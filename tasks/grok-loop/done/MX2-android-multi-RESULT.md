# MX2-android-multi — RESULT

**Status:** COMPLETE  
**Lane:** MX2 Android multi secondary + hunt gate  
**Spec:** MULTI-CROSS-IMPROVE-PLAN P2 · skill `multi-party-stage`  
**Date:** 2026-08-12  
**Root:** `/home/drakosik/freenet-roulette`

## Goal

Android multi / find-3rd must not freeze PC partner; secondaries clone; multi only `nPeers ≥ 2`.

## OWN

| Path | Role |
|------|------|
| `mobile/src/media/MediaSession.ts` | adoptLocalStream, multiPeerAudio, secondary closeCall, multi min→low floor |
| `mobile/src/live/stageStreams.ts` | multiRemote = real multi only (audit) |
| `mobile/src/live/matchPeers.ts` | `MAX_EXTRA_PEERS = 3` (audit) |
| `mobile/app/live.tsx` | multi gate / enterHuntingWithPartner / lookingForThird only |
| RESULT | this file |

**Must not (confirmed):** no `ui/live.js` thrash · no invent PASS · no deploy · `SOFT_BLUR_PRODUCT_ENABLED` stays **false**

---

## Audit checklist

### 1. Hunting never sets multiRemote tree unmount — **PASS**

| Check | Evidence | Verdict |
|-------|----------|---------|
| `multiRemote` only real multi | `stageStreams.ts` L51–55: `remoteStream2 \|\| remoteStream3 \|\| extraPeerCount > 0` | PASS |
| Hunt flags separate | `lookingForThird` = `!r2 && !r3 && remote && (huntingWithPartner \|\| findThirdPending)` (`live.tsx`) | PASS |
| `enterHuntingWithPartner` | sets hunt + `party_browse` + keeps `phase=matched` — never pure search | PASS |
| `find_third_result` | → `enterHuntingWithPartner("find_third_result")` | PASS |
| `cancelFindThird` | clears hunt flags + leaves `party_browse` | PASS |
| Matched party_browse alone | sets `huntingWithPartner` only when `extras.length === 0` | PASS |
| Extras kill hunt | `multiNow` → `setHuntingWithPartner(false)` | PASS |

Hunt stays on 1v1 `VideoView` wrap + looking strip (`LiveStageVideo` out of edit scope; prior W4b/BM3 PASS).

### 2. setMultiPeerAudio only nPeers ≥ 2 — **PASS** (tightened)

| Before | After |
|--------|-------|
| `nPeers = allPeers.length` (could include legacy/poison) | `nPeers = 1 + extras.length` after cap/filter |
| `multi = nPeers >= 2` | `multi = nPeers >= 2 && !!second` |

party_browse hunt with 1 real remote → multi **false**. Real 2nd peer → multi **true** (m1 primary; m2/m3 `{ secondary: true }`).

### 3. Secondary adopt clones / keepLocal no stop primary — **PASS**

| Symbol | Location | Verdict |
|--------|----------|---------|
| `adoptLocalStream` | MediaSession ~L956 | `secondaryLink`; prefer `track.clone()` via `tryBuildSecondaryOutbound` |
| `ownedCloneTracks` / `releaseOwnedClones` | clones only | PASS |
| `localStreamOwned = ownsAll` | shared/mixed → unowned | PASS |
| `mayStopLocal` | `localStreamOwned && !secondaryLink` | PASS |
| `closeCall` keepLocal secondary | `closeCall_secondary_drop_local_ref` — no stop | PASS |
| live.tsx media2/media3 | `adoptLocalStream(primary)` + `closeCall({ keepLocal: true })` | PASS |
| No GUM secondary | ensure/open/refresh skip markers | PASS |
| Cap | `MAX_EXTRA_PEERS = 3` in matchPeers; live.tsx now `.slice(0, MAX_EXTRA_PEERS)` | PASS |

### 4. SoftBlur product — **false** (untouched)

`mobile/src/live/SoftBlurRemote.tsx` L38: `SOFT_BLUR_PRODUCT_ENABLED = false`

---

## Gaps fixed (minimal)

### F1 — Multi encode floor min→low (MediaSession)

**Why:** Web `mobileSafeMultiTier` floors multi `min`→`low` (min freezes mobile HW encoders). Android adaptive could still apply `min` under multi despite secondary ceiling `low` (`clampQualityTier(min, low) === min`).

**Fix:** `applyQualityTier` — if `(multiPeerAudio || secondaryLink) && capped === "min"` → `capped = "low"`.

### F2 — extras cap + multi gate (live.tsx multi only)

**Why:** Comment claimed “Cap via matchPeers MAX_EXTRA” but `extras` was unfiltered/uncapped; poison `legacy` rows could inflate `allPeers.length` and arm multi-audio with 1 media link.

**Fix:**

```text
extras = allPeers
  .filter(p => peerId && != legacy && != primary)
  .slice(0, MAX_EXTRA_PEERS)
multi = (1 + extras.length) >= 2 && !!second
```

### Test lock

`mediasessionMultiSafety.test.mjs` asserts multi min→low floor in `applyQualityTier`.

---

## Verify

```bash
cd /home/drakosik/freenet-roulette
node mobile/src/media/mediasessionMultiSafety.test.mjs
# expect: mediasessionMultiSafety.test.mjs: ok  EXIT:0

node mobile/src/live/stageStreams.test.mjs
# expect: stageStreams.test.mjs: ok  EXIT:0
```

| Check | Expected |
|-------|----------|
| mediasessionMultiSafety | ok (includes new min→low assert) |
| stageStreams unit | ok (unchanged contract) |
| SoftBlur product | false |
| Human multi / find-3rd smoke | **OPEN** — not claimed |

---

## APK rebuild

| Change | APK needed? |
|--------|-------------|
| `MediaSession.ts` multi min→low floor | **YES** — ships only after APK rebuild |
| `live.tsx` extras cap + multi gate | **YES** — same bundle |
| `mediasessionMultiSafety.test.mjs` | no (unit only) |
| stageStreams / matchPeers | no code change |

**Note:** Do **not** auto-build this hop (AGENTS: no APK flood). Director / human: `npm run build:apk:bump` (or verify + build) when ready for device multi smoke.

---

## Files touched

| File | Change |
|------|--------|
| `mobile/src/media/MediaSession.ts` | multi min→low floor in `applyQualityTier` |
| `mobile/app/live.tsx` | import `MAX_EXTRA_PEERS`; cap/filter extras; multi gate on real second |
| `mobile/src/media/mediasessionMultiSafety.test.mjs` | assert multi min→low |
| `tasks/grok-loop/done/MX2-android-multi-RESULT.md` | this RESULT |

**Not touched:** `ui/live.js` · SoftBlur product flag · deploy · stageStreams logic · matchPeers constants

Task card: `running/MX2-android-multi-secondary.md` → done (with RESULT).

---

## Connect risk

**Low.** Encode floor only under multi flags (1v1 still may use `min`). Extras filter is stricter (drops legacy/poison). No ICE / pool / force_relay thrash. No dual-write live.js.

---

## Honest summary

| Claim | Result |
|-------|--------|
| Hunt never multiRemote | **PASS** (static) |
| Multi-audio only real 2+ peers | **PASS** (tightened) |
| Secondary clone + no stop primary | **PASS** (static + prior unit) |
| Multi encode floor low not min | **FIXED** this hop |
| SoftBlur product off | **PASS** (`false`) |
| Human find-3rd / 3-way faces | **OPEN** — no invent PASS / GOAL_MET |

## COMPLETE

Audit + minimal fix landed. **APK rebuild needed** before device multi/find-3rd smoke. Human multi smoke remains OPEN.
