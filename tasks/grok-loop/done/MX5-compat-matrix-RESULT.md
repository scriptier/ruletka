# MX5-compat-matrix-smoke — RESULT

**Status:** COMPLETE  
**Lane:** multi-compat (docs) · **Plan:** `MULTI-CROSS-IMPROVE-PLAN` **P5**  
**Date:** 2026-08-12  
**Code change:** **none** (must not edit product code)  
**Multi product PASS invent:** **none** — human multi / find-3rd / 3/4-way remain **OPEN**

## Goal

Update Android app × PC browser × Chrome Android matrix with honest OPEN smoke; human steps for find-3rd and 3/4-way cross-platform; cite skill code paths; no invent PASS.

## OWN touched

| Path | Action |
|------|--------|
| `knowledge/wiki/multi-party.md` | Restamped disk tip; scenario matrix **S1–S7**; find-3rd + 3/4-way smoke; skill code map |
| `knowledge/specs/SMOKE-NEXT.md` | **§D multi section only** — matrix rows, find-3rd checkboxes, report paste, tip pins |
| `knowledge/wiki/log.md` | One append entry (MX5) |
| `tasks/grok-loop/done/MX5-compat-matrix-RESULT.md` | This RESULT |

**Not touched:** product code (`live.js` / `webrtc.js` / MediaSession / LiveStageVideo / CSS). MX1–MX4 OWN files left to their lanes.

## Disk tip (read, not PASS)

| Asset | Stamp | Source |
|-------|-------|--------|
| APK | **0.1.371-vc379** | `mobile/app.json` · artifact `ruletka-0.1.371-vc379.apk` |
| `live.js` | **`?v=571`** | `ui/live.html` |
| `webrtc.js` | **`?v=315`** | `ui/live.html` |
| `live-stage.css` | **`?v=391`** | `ui/live.html` |
| `live-brand.css` | **`?v=16`** | `ui/live.html` |

## Cross-compat table residual (OPEN honesty)

### Client risk (code-shipped · human-smoke-open)

| Platform | Residual risk | Mitigation (intent on disk) | Status |
|----------|---------------|----------------------------|--------|
| Chrome Android browser | Shared video track on 2+ PCs freezes cam | secondary `track.clone()`; no audio `setLocalStream(preview)` | **OPEN** smoke |
| Desktop Chrome | Trio reflow decode freeze | `softKeepPartnerPaint`; no hard `#remote` null | **OPEN** smoke |
| Android app (RN) | Hunt remount freezes PC partner; secondary stop kills primary | hunt wrap `lookingForThird`; `adoptLocalStream` + keepLocal | **OPEN** smoke |
| Encode 3–4 way | min tier freezes mobile HW | floor **low** via `mobileSafeMultiTier` / `applyMultiPeerOutboundQuality` | **OPEN** smoke |

### Scenario matrix S1–S7 — all OPEN

| ID | Mix | Status |
|----|-----|--------|
| S1 | PC Chrome ↔ Android app → find-3rd | **OPEN** |
| S2 | Android app invite find-3rd → PC accept | **OPEN** |
| S3 | 3-way PC + Android app + PC | **OPEN** |
| S4 | 3-way PC + Chrome Android + PC | **OPEN** |
| S5 | 3-way app + Chrome Android + PC | **OPEN** |
| S6 | 4-way any mix | **OPEN** |
| S7 | Chrome Android multi only | **OPEN** |

## Human smoke steps filed

1. **Find-3rd hunt (S1/S2):** 1v1 ≥15s → accept → partner moves ≥30s; PC middle looking; Android top partner / bottom looking; 3rd joins first partner stays live.  
2. **3-way (S3–S5):** faces ≥60s both ways; Chrome Android local cam ≥60s; mute no cam-kill; leave no orphan.  
3. **4-way (S6):** all tiles; encode no freeze; partyCap blocks 5th.  
4. Report paste template in wiki + SMOKE-NEXT §D (includes find-3rd fields + scenario IDs).

## Code paths cited (from `multi-party-stage` skill)

| Concern | Path |
|---------|------|
| Web clones | `ui/live.js` — `outboundVideoTrackForPc`, `ensureOutboundVideoClone`, `pushOutboundVideoTracks` |
| Audio multi safety | `ui/live.js` — `pushOutboundAudioTracks` (audio-only replaceTrack) |
| Hunt softKeep PC | `handleFindThirdResult` → `softKeepPartnerPaint`, `enableTrioLayout`, `bindFirstPartnerToMain` |
| Quality floor | `applyMultiPeerOutboundQuality` · `ui/webrtc.js` `mobileSafeMultiTier` |
| Android hunt | `mobile/app/live.tsx` — `enterHuntingWithPartner`, `lookingForThird`; `LiveStageVideo.tsx` column |
| Multi-audio gate | `live.tsx` — `setMultiPeerAudio` only if `nPeers >= 2` |
| Secondary adopt | `mobile/src/media/MediaSession.ts` — `adoptLocalStream` |
| Cap | `matchPeers.ts` `MAX_EXTRA_PEERS=3` · web `strangerCount >= 3` |

**MX1–MX4:** still **running** at docs hop time — no MX1–4 RESULT cited as complete. Prior static only: `BM1-multi-clone-static`, `P0-multi-web-verify`, `BM3-hunt-layout-golden`, `P0-webrtc-multi-recheck`, L-series multi-pair **SCAFFOLD_DONE ≠ MULTI_PASS**.

## Honesty checklist

| Claim | Allowed? |
|-------|----------|
| Features code-shipped on disk | **yes** (static prior + skill map) |
| Human multi PASS / MULTI_PASS / GOAL_MET | **no** — still **OPEN** |
| SCAFFOLD_DONE = multi product PASS | **no** |
| 1v1 MATCHED / SoftBlur Hold = multi | **no** |
| Product code edits this hop | **none** |

## Job complete

- Task `running/MX5-compat-matrix-smoke.md` → `done/`  
- RESULT: `tasks/grok-loop/done/MX5-compat-matrix-RESULT.md`  
- **COMPLETE**
