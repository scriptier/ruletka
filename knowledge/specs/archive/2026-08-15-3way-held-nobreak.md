# Spec: 3-way held — no-cam must not cover a live PC (no-break)

**Status:** active · 2026-08-15 · **do not invent MULTI_PASS**  
**Evidence:** `knowledge/raw/2026-08-15-3way-held-nocam-cover.md`  
**Shots:** `201649Z-3way-smoke2-phone` · `201554Z-3way-smoke-pc-live` · recapture `201933Z-3way-held-phone`  
**Score leftover:** `20260815T201602Z` / `202019Z` product.ok is **1v1 leftover** (answers 2 < offers 3)

## Human facts (lock)

1. **Hunt-keep HELD.** Android did not freeze or disconnect while searching for a 3rd. **Do not remount RTC / hunt path.**
2. 3rd connected. **PC browser good** (user). **Laptop same Chrome sees PC, not Android.** Not a Chrome-version bug.
3. Android **did flip to two screens** (portrait stack). Auto-rotate: disk `orientation=default` + `fullUser` + splitWide. **Needs APK.**
4. Android **saw PC camera, then no-cam portrait covered it.**
5. Laptop has **no webcam** (honest cylinder on *laptop* tile only).

## GOAL

Keep hunt-keep + 1v1. Stop the no-cam picture from covering a tile that already painted a face. Diagnose the laptop→Android 3rd link without ICE thrash.

## DONE WHEN (code hops — human smoke still required)

1. **Primary tile:** if that stream has decoded pictures, **never** show NoCamPortrait / never set `partnerNoCam` from a 3rd/laptop `no_cam`.
2. **Laptop no_cam** paints **only** the laptop/extra tile.
3. **Auto-rotate:** `splitWide` updates when the phone is flipped (onLayout / Dimensions). **No RTC remount.**
4. **Diagnose** why laptop sees PC and not Android (same Chrome). One recommended next hop. **No webrtc/MediaSession edit unless the diagnose card proves a bind-only bug and the lane OWNS that file.**
5. Wiki gotcha + `now.md` updated. **No MULTI_PASS.**

## EVAL

- `node mobile/src/live/matchContinuity.test.mjs` — extras≥1 + pictures on primary + `no_cam` from extra → extra only
- `node mobile/scripts/verify-match-ux.mjs` if stage overlay changes
- `node --check ui/live.js` if web hop
- av-verify leftover product.ok **is not** this 3-way

## MUST NOT

- Touch hunt-keep / unmount first RTCView
- `MediaSession.ts` ICE / pool / force_relay
- `startCall` / `startCall2` / `closeCall` rematch
- Invent product.ok / MULTI_PASS
- APK / `push.sh` / deploy
- Break 1v1 cam-present path

## Lanes (non-overlapping)

| Lane | OWN | Hop |
|------|-----|-----|
| p-android | `mobile/app/live.tsx` `mobile/src/live/matchContinuity.ts` | ignore inbound no_cam on primary when pictures exist; rehome must stay cleared |
| p-stage | `mobile/src/live/LiveStageVideo.tsx` `mobile/src/live/liveStyles.ts` | NoCamPortrait only if that tile advertised no-cam **and** no pictures; rotate → splitWide |
| p-web | `ui/live.js` | no-cam only on advertising peer; never cover `videoWidth>0` |
| d-link | `knowledge/raw/2026-08-15-laptop-no-android-diag.md` | read-only diagnose of unanswered 3rd (`ice=new` 0/0, answers<offers) |
| p-wiki | `knowledge/wiki/gotchas.md` `now.md` `multi-party.md` `log.md` | gotcha 59 + now |

Director bumps `live.js?v=` after p-web if needed. **No APK.**

## Hop 2 (2026-08-15 proceed) — laptop must offer to Android

**Pin:** `live.js?v=652`  
**OWN:** `ui/live.js` only.

On 3rd-join keep-path / later 1-peer rematch, remember last 1v2 (`lastMeshPeers`) and `mergeMissingMeshPeers` so laptop `joinPeers` the omitted mobile extra with hub `p.is_offerer`. Do not stay on kickSolo / PC-only. Do not promote Android. Do not tear the live PC link.

**EVAL:** `node --check ui/live.js` · `node ui/live-third-slot.test.mjs`  
**Still human smoke.** **No MULTI_PASS.**

## Hop 3 (2026-08-15 proceed) — re-offer failed extra once

**Pin:** `live.js?v=657`  
**OWN:** `ui/live.js` only.

Laptop 3-way `233542Z`: chip “two videos”, paints 0. Extra ice=failed after answer then drop-and-forget. On extra ice=failed, if still listed in lastMeshPeers and not first partner, close only that dead PC and `joinPeers` the full mesh **once**. Do not prune lastMeshPeers. Do not tear the live PC link. Soft-recover grace must not block this path.

**EVAL:** `node --check ui/live.js` · `node ui/live-third-slot.test.mjs`  
**Needs UI rsync + hard-refresh both Chromes.** **No MULTI_PASS.** **No APK.**

## Hop 4 (2026-08-15) — dead PC ≠ joined

**Pin:** `live.js?v=658`  
**OWN:** `ui/live.js` only.

657 FAIL: laptop still `17-33-58` (0 videos). Reoffer skipped because `#remote` / first-partner was protected even when **dead**, and `findPcForPeer` treated ice=failed as already joined so merge/join never rebuilt. `meshPeerHasLivePc` = failed/closed does not count. Dead `#remote` on the 3rd (laptop) may re-offer; live Courtier on the pair PC still must not. Close dead extras before `joinPeers`.

**EVAL:** `node --check ui/live.js` · `node ui/live-third-slot.test.mjs`  
**Needs rsync + hard-refresh.** **No MULTI_PASS.**

## Hop 5 (2026-08-15 proceed) — no-cam 3rd must mesh

**Pin:** `live.js?v=659`  
**OWN:** `ui/live.js` only.

658 FAIL: laptop still 0 videos, **no laptop av_path**, this PC no laptop edge. No-cam 3rd with 1-peer Matched returned from `joinPeers` before creating PCs. Keep-path still treated `findPcForPeer` as joined. Global 1v1 offer lock could skip the 2nd offer. `ensureMissingMeshPeers` + 2.5s timer (cap 3). Clear offer lock when `list>=2`.

**EVAL:** `node --check ui/live.js` · `node ui/live-third-slot.test.mjs`  
**Needs rsync + hard-refresh.** **No MULTI_PASS.** **No APK.**

## Hop 6 (2026-08-15) — mesh second offer

**Pin:** `live.js?v=660` · `webrtc.js?v=332`  
**OWN:** `ui/webrtc.js` + `ui/live.js`

659 WIN: laptop sees this PC. FAIL: no Android on laptop. Score `235546Z`: laptop 1 PC only; Android extra ice=new bind_v=0. Match-wide one-offer lock skipped the laptop→phone createOffer. Multi (`_multiPeerLink`) must not use that lock. ice=new without emit ≠ joined.

**EVAL:** `node --check ui/live.js` · `node --check ui/webrtc.js` · `node ui/live-third-slot.test.mjs`  
**Needs rsync + hard-refresh.** **No MULTI_PASS.** **No APK.**

## Hop 7 (2026-08-15) — reset stuck Android extra

**Pin:** `live.js?v=661` · APK after MediaSession extra reset  
**OWN:** `mobile/src/media/MediaSession.ts` + `matchContinuity.ts` + `ui/live.js`

660 FAIL: laptop still 1 PC; Android extra ice=new bind_v=0. Leftover extra `inAnsweredCall` rejected the new laptop offer. Reset only stuck extra (ice=new/failed, no frames). Force laptop offerer on missing mesh peer. **Do not remount primary.**

**EVAL:** `node mobile/src/live/matchContinuity.test.mjs` · `node ui/live-third-slot.test.mjs`  
**Needs APK** for the phone extra. Web 661 is rsynced. **No MULTI_PASS.**
