# P0-multi-web-verify — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` only  
**Date:** 2026-08-11  
**Syntax:** `node --check ui/live.js` → **PASS** (exit 0)  
**Code change:** none (verify-only; paths intact)

## Goal
Confirm 3/4-way web path: multi clones, no shared track on secondaries, find-3rd partner keep, Courtier name latch.

## Checks

### 1. Multi clones / no shared track — PASS
| Item | Location | Verdict |
|------|----------|---------|
| Secondary always `track.clone()` when `peerPcs.size >= 2` | `ensureOutboundVideoClone` ~17888; `outboundVideoTrackForPc` ~17923 | PASS |
| Primary keeps real preview track (feeds `#local`) | `outboundVideoTrackForPc` primary branch | PASS |
| `pushOutboundVideoTracks` multi path uses per-PC track | ~18115–18180 | PASS |
| joinPeers registers PC then `outboundVideoTrackForPc` | ~27336–27357 | PASS |
| kickSolo multi-safe outbound | ~26685–26715 | PASS |
| Audio push = audio-only `replaceTrack` (no `setLocalStream(preview)`) | `pushOutboundAudioTracks` ~17732–17766 | PASS |
| Soft heal rebuilds clones after video-only GUM | `healMultiPeerLocalCamera` ~17943 | PASS |
| Cap 3 opponents (you+3) | `joinPeers` `slice(0, maxOpponents)` ~26830–26844 | PASS |
| Multi quality floor low on mobile (not min) | `applyMultiPeerOutboundQuality` ~26044+ | PASS (reviewed) |
| Multi-audio gated on real multi (2+ remotes / mate+stranger) | `isMultiPeerAudioFromMatch` / `enterMultiPeerAudioMode` ~20726–20828 | PASS — not party_browse alone |

### 2. Find-3rd partner keep — PASS
| Item | Location | Verdict |
|------|----------|---------|
| Accept → promote stranger PC → teammate before layout | `handleFindThirdResult` ~32805–32808 | PASS |
| Trio searching chrome + brand middle | `enableTrioLayout(true, { searching: true })` + `forceThirdBrandLoop` | PASS |
| Soft re-play only; no hard `#remote` null while hunting | `softKeepPartnerPaint` ~32826–32873 | PASS |
| Soft waves 80 / 250 / 700 / 1500 ms | same | PASS |
| Brand loop timers bail if third has live media | `forceThirdBrandLoop` / delayed timers ~11734–11743 | PASS |
| `bindFirstPartnerToMain` keeps mate on main; never steals stranger | ~12857–12923 | PASS |
| joinPeers keeps peer on stranger→teammate reclass (no closeCall) | ~26853–26863 | PASS |
| Party-member Matched path soft re-assert partner | ~25438–25484 | PASS |

### 3. Courtier latch — PASS
| Item | Location | Verdict |
|------|----------|---------|
| `lastGoodPartnerName` + `latchGoodPartnerName` / `isRealPartnerDisplayName` | ~1574–1602 | PASS |
| `resolvePartnerPaintName` prefers latch over poison/hex/Partner | ~1621–1640 | PASS |
| `setDisplayNameOnTile` keeps latched Courtier over wipe | ~1647–1655 | PASS |
| Find-third soft re-paint after stage-trio reflow | `softKeepPartnerPaint` Courtier block ~32861–32866 | PASS |
| re-Matched keep-PC merges name + re-paint latch | ~25085–25113 | PASS |
| Same-uid keep latch when hub omits name; new uid clears | ~25531–25541 | PASS |
| Main remote paint prefers latch on find-3rd rebind | ~12361–12366 | PASS |

## Fix
None. Surgical fix not required — all three contracts present and consistent with `knowledge/specs/current-multi-party.md` + `.grok/skills/multi-party-stage/SKILL.md`.

## Not done (by job scope)
- No deploy / no APK
- No human smoke (faces ≥30s after accept) — code-path verify only
- No edits to `webrtc.js` / CSS / mobile

## Job complete
Moved running job → done; RESULT filed.
