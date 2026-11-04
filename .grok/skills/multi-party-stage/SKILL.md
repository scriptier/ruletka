---
name: multi-party-stage
description: >
  freenet-roulette / ruletka multi-party (3-way / 4-way) + find-third hunt layout
  and media. PC trio (partner | looking | you) vs phone horizontal mid-split
  (top partner · bottom looking). NEVER unmount partner RTCView / remount 1v1→multi
  tree when only hunting for a 3rd — freezes Android outbound so PC sees frozen
  conversationalist. Multi-peer audio / encode floor only when nPeers≥2 (not mere
  party_browse). Chrome Android: secondary video track.clone(); never share one
  track on 2+ PCs; audio push must not setLocalStream(preview). Cap you+3 remotes.
  Use when: find-third, looking for 3rd, party_browse, trio, 3-way, 4-way, partner
  freezes after accept 3-way, multi cam black mid multi, Chrome Android multi cam
  dead, remoteStream2, huntingThird, lookingForThird, enableTrioLayout, partyCap,
  or user asks multi-party stage / split layout. Do NOT thrash ICE/force_relay for
  layout-only; do NOT floor mobile multi at min tier.
metadata:
  short-description: "3/4-way + find-3rd stage (no RTC remount freeze)"
  learned: "2026-08-12"
  triggers:
    - find third
    - looking for 3rd
    - party_browse
    - 3-way
    - 4-way
    - trio layout
    - partner freezes after accept
    - multi cam freeze Chrome Android
    - lookingForThird
    - huntingThird
    - enableTrioLayout
    - track.clone multi
---

# Multi-party stage (find-3rd · 3/4-way)

You own **mesh multi-party UI + outbound media** for party browse / find-third /
3-way / 4-way.  
You do **not** thrash ICE, pool, or force_relay for layout freezes.  
You do **not** unmount live partner video to “enter multi layout.”

Stance: `AGENTS.md` (augmentation). Specs: `knowledge/specs/current-multi-party.md`,
`knowledge/specs/current-linking-speed.md` (linking is separate).  
Wiki: `knowledge/wiki/multi-party.md`, `knowledge/wiki/gotchas.md` § Multi-party.  
Connect (black 1v1 / no frames): hand off `av-fix-loop`. Identity: `mobile-match-identity`.  
Brand loading loop asset: `brand-stage` / `BrandLoadingLoop`.

**Ship stamps (on disk — re-read `ui/live.html` + `mobile/app.json` / artifacts):**  
APK **0.1.366-vc374** · `live.js?v=562` · `webrtc.js?v=315` · `live-stage.css?v=386`  
(find-3rd hunt split Android · multi clones · softKeepPartnerPaint · PC Courtier name latch)  
**Prod honesty:** prod may lag disk (561/384 vs 562/386).  
**Smoke honesty:** human multi / find-3rd smoke **OPEN** — no multi PASS invent.  
Agent phone **1v1 MATCHED** (APK 0.1.366-vc374 · WEB_PAIR · T1 `20260812T021127Z`) is **non-multi only** — does not close multi smoke.

## When to use

| Symptom | This skill |
|---------|------------|
| Android accepts find-3rd → **PC partner freezes** while hunting | **Yes** (RTC remount / multi-audio thrash) |
| Phone shows full single video during hunt (no looking pane) | **Yes** — hunt split layout |
| Phone split is side-by-side like PC (user wants mid horizontal) | **Yes** — column top/bottom |
| Chrome Android cam dies mid 3-way | **Yes** — track.clone secondaries |
| 3rd/4th remote missing / black orphan tile | **Yes** — layout + joinPeers slots |
| Cap wrong (“max 2” when code is 3) | **Yes** — partyCap i18n |
| 1v1 black / linking forever / no answers | **No** → `av-fix-loop` |
| Partner name hex only | **No** → `mobile-match-identity` |
| Partner blur veil (mosaic) won't show/clear, eye toggle stuck | **No** — separate lane; `PartnerBlurVeil` is not multi cam freeze, see `knowledge/raw/2026-08-12-android-privacy-veil-not-softblur.md` |

## DONE WHEN

1. **Find-3rd hunt (1 media link):** partner video stays **live and moving** on both clients while “looking for a 3rd” UI shows.  
2. **Phone hunt layout:** **horizontal midline** — top = connected conversationalist, bottom = brand loading + looking copy (not PC-style side-by-side columns in portrait).  
3. **PC hunt layout:** trio / multi columns (partner | looking | you) with brand loop middle; partner tile keeps painting after layout reflow.  
4. **No RTC remount for hunt:** entering hunt must **wrap** 1v1 partner `VideoView` / `#remote` — not switch to a new multi tree that unmounts it.  
5. **Multi media only when real multi:** `setMultiPeerAudio` / multi encode floor only when **≥2 remote peers** (or 2+ PCs with live media) — **not** `party_browse` alone.  
6. **Chrome multi outbound:** secondary PCs use `track.clone()`; primary keeps real preview; audio push is audio-only replace (no shared preview video re-bind).  
7. **Cap:** max **3 remotes** (you + 3 = 4-way). `joinPeers`: solo ≤3 strangers; party+mate ≤2 strangers (mate already on `#remote`). Android `MAX_EXTRA_PEERS = 3`. Extra peers skipped with “max 3 opponents…” log (i18n key `log.partyCap`).  
8. Smoke: human faces stay live after find-third **accept** for ≥30s while hunting.

## Layout contracts

### Android phone (`LiveStageVideo`)

| Mode | Layout | Media mount rule |
|------|--------|------------------|
| 1v1 matched | Full partner + local PiP | Single main `VideoView` for partner |
| **Find-3rd hunt** (`lookingForThird`, no `remoteStream2|3`) | `flexDirection: "column"` — top partner · bottom looking | **Same** partner `VideoView` instance path; only wrap outer flex. Bottom = `BrandLoadingLoop` + caption |
| True multi (`remoteStream2` / `remoteStream3` / extras) | Column (portrait) or row (wide landscape) | Multi tiles OK; still prefer keep tracks live |
| Landscape wide | Optional side-by-side (`splitRemoteWide`) | Same rules |

**`huntingThird` ≠ `multiRemote`.**  
`multiRemote` = real multi streams only (`pickStageStreams` / `remoteStream2|3`). Hunt uses **1v1 tree + looking strip**.

Props: `lookingForThird` from `live.tsx` when  
`!remoteStream2 && !remoteStream3 && !!remoteStream && !!(huntingWithPartner || findThirdPending)`.  
**Not** bare `matchMode === "party_browse"` (must not stick after cancel). Enter hunt via `enterHuntingWithPartner` → sets `huntingWithPartner` + `party_browse` + keeps `phase=matched`.

### PC browser (`live.js` + `live-stage.css`)

| Mode | Layout |
|------|--------|
| Find-3rd accepted / party hunting | `enableTrioLayout(true, { searching: true })` — stage-trio + brand **middle** (`#tile-third`) · partner \| looking \| you |
| Partner keep | Promote stranger PC → `_role = teammate`; `bindFirstPartnerToMain`; **`softKeepPartnerPaint`** (no null-rebind thrash) |

After find-third accept / trio reflow (`handleFindThirdResult`):

- **`softKeepPartnerPaint`** — soft re-bind/`playVideoEl(#remote)` at 0/80/250/700/1500ms; Courtier latch re-paint.  
- **Do not** hard `srcObject = null` on live partner.  
- Optional receiver `requestKeyFrame` nudge.  
- `forceThirdBrandLoop` timers must **bail** if `thirdSlotHasLiveMedia()`.

## Media contracts (multi)

| Rule | Why |
|------|-----|
| Secondary video = `track.clone()` (web + RN adopt) | Same track on 2+ PCs freezes Chrome Android cam |
| Primary = real preview track | Local `#local` / preview stays correct; multi always clone non-primary (`peerPcs.size≥2`) |
| Audio push: replaceTrack audio only | `setLocalStream(preview)` re-shares video → freeze |
| Multi quality: mobile floor **low** not **min** | min HW encode freezes mobile; primary multi ≤ mid |
| Multi-audio / secondary encode only when **nPeers ≥ 2** | party_browse hunt with 1 link must not thrash capture |
| Secondary Android `adoptLocalStream` + `closeCall({ keepLocal })` | Clone video when possible; never `stop()` primary preview on secondary hangup |
| Cap 3 remotes | `joinPeers` maxOpponents; Android `MAX_EXTRA_PEERS=3`; no remote4 without HTML |

Code map:

| Concern | Path |
|---------|------|
| Hunt + multi stage | `mobile/src/live/LiveStageVideo.tsx`, `liveStyles.ts`, `stageStreams.ts` |
| lookingForThird / hunt enter | `mobile/app/live.tsx` — `enterHuntingWithPartner`, `huntingWithPartner` |
| Multi audio gate | `live.tsx` Matched · `MediaSession.setMultiPeerAudio` only if `nPeers≥2` |
| Android cap / extras | `mobile/src/live/matchPeers.ts` — `MAX_EXTRA_PEERS` |
| Android secondary media | `mobile/src/media/MediaSession.ts` — `adoptLocalStream`, owned clones |
| Web clones / push | `ui/live.js` — `outboundVideoTrackForPc`, `ensureOutboundVideoClone`, `pushOutboundVideoTracks`, `healMultiPeerLocalCamera` |
| Web quality floor | `applyMultiPeerOutboundQuality` · `webrtc.js` `mobileSafeMultiTier` |
| PC trio + softKeep | `handleFindThirdResult` → `softKeepPartnerPaint`, `enableTrioLayout`, `bindFirstPartnerToMain` |
| WebRTC multi safety | `ui/webrtc.js` — preview stop guards, Android min→low |

## GOTCHAS (learned 2026-08-12)

| # | Failure | Instead |
|---|---------|---------|
| 1 | Flip `multiRemote=true` for hunt → new tree **unmounts** partner RTCView | Hunt wraps 1v1 VideoView; multiRemote only for real 2+ remotes |
| 1b | Android never handles `find_third_result` → full-screen brand only | `enterHuntingWithPartner` + `huntingWithPartner`; keep phase matched + remoteStream; split top/bottom |
| 1c | Drive hunt UI from bare `matchMode === "party_browse"` | Stick after cancel; use `huntingWithPartner` or `findThirdPending` + live remoteStream |
| 2 | `party_browse` alone enables multi-audio + quality mid-call | Multi only when `nPeers >= 2` |
| 3 | PC trio reflow freezes decode | `softKeepPartnerPaint`; no null rebind |
| 4 | Same `MediaStreamTrack` on 2 PCs (Chrome Android) | `track.clone()` per secondary (`outboundVideoTrackForPc` / adopt) |
| 5 | Audio path `setLocalStream(preview)` on multi | Audio-only replaceTrack |
| 6 | Extras at quality **min** on mobile | Floor **low** |
| 7 | Phone side-by-side like PC for hunt | Portrait: **column** mid split (horizontal line) |
| 8 | Hard rebind partner every 200/800ms on accept | Soft paint / play only (`softKeepPartnerPaint` waves) |

## Procedure (one hop)

1. **Classify** — hunt layout freeze vs true multi cam vs 1v1 connect.  
2. **If freeze after find-third accept** — check Android remount + multi-audio gate first; PC soft re-play second.  
3. **If multi cam dies** — clones + audio push path + quality floor.  
4. **If layout only** — `LiveStageVideo` / CSS; no MediaSession ICE thrash.  
5. Verify: syntax / units; APK only if Android; UI deploy if web.  
6. Smoke: accept find-third; partner **moves** ≥30s while looking pane shows.  
7. Compound wiki gotcha if new.

## MUST NOT

1. Unmount partner RTCView / `#remote` hard null to “enter multi layout.”  
2. Treat `party_browse` as multi-media without a second peer.  
3. Share one video track across 2+ PeerConnections on mobile Chrome.  
4. Floor multi extras at **min** on mobile.  
5. ICE pool > 0 / force_relay thrash for layout freezes.  
6. GOAL_MET without human faces (or product.ok where applicable).  
7. Dual-write MediaSession + live.js multi without sequential OWN.  
8. Invent 4th remote element without HTML + joinPeers + CSS.

## Smoke checklist

- [ ] 1v1 live → find-third invite → accept  
- [ ] PC: partner still moving; middle “looking for 3rd” brand  
- [ ] Android: top partner moving; bottom looking brand  
- [ ] No cam freeze ≥30s while hunting  
- [ ] 3rd joins → bottom/third becomes their video; first partner still live  
- [ ] Chrome Android browser 3-way: local cam stays live (clone path)

## Related

- `av-fix-loop` — 1v1 / one-way / linking  
- `brand-stage` — loading-screen asset / watermark  
- `mobile-match-identity` — name · ★ · loc only  
- `knowledge/wiki/multi-party.md` — platform matrix  
- Spec: `knowledge/specs/current-multi-party.md`
