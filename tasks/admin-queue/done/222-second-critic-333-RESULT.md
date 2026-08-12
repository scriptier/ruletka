# 222 — Second critic: 0.1.333 watermark + hop11 + dock

Status: PASS (read-only review, no edits — no crash-level bug found)

## Files read
- mobile/src/live/BrandWatermark.tsx
- mobile/src/live/PartnerIdentityDock.tsx
- mobile/src/live/liveStyles.ts (dock plate styles, lines 330–375)
- mobile/src/live/LiveStageVideo.tsx (BrandWatermark mount, ~L19, L681–687)
- mobile/app/live.tsx (PartnerIdentityDock mount, ~L68–74, L5204–5238)
- ui/live.js (`armOfferKickWatch` ~L9605–9720, `kickSoloWebRtc` inflight-mutex ~L24833–24887, dense-wave call site ~L24010–24024)

## PASS/FAIL table

| # | Check | Result |
|---|-------|--------|
| 1 | Watermark center→edge anim uses native driver only | **PASS** — every `Animated.timing`/`Animated.loop` call (`progress`, `pulse`) sets `useNativeDriver: true`; interpolated outputs are only `opacity`, `scale`, `translateX/Y` — all native-driver-safe. No layout-prop or color interpolation. |
| 2 | Dock contrast OK for SurfaceView washout | **PASS** — `partnerIdentityDock` bg is `rgba(8,12,20,0.98)` (near-opaque, not a translucent overlay over RTCView — it's a flex sibling below the stage per the file's own header comment), so SurfaceView compositing can't wash it out. Name text `#ffffff` bold, stars `#ffe566` bold, loc `#c8d8f0` / dimmed `rgba(180,195,215,0.72)` — all readable against the near-black plate. |
| 3 | Hop11 pure hard floors still protected | **PASS** — inflight-mutex free-at-550ms (`kickSoloWebRtc`, L24850/24859) still gated by `emitOk` check first; match-offered dedupe window (12000ms, L24878) and mid-offer inflight grace (550/900ms force_relay, `armOfferKickWatch` L9639–9649) are both intact and unchanged in logic — only wave timing/comments reference "Hop11," the actual real-SDP guard (`_offerEmitOk` / `_gotRemoteAnswerAt` / remote description checks) is untouched. |
| 4 | Any crash/import regression | **PASS** — `PartnerIdentityDock` and `BrandWatermark` imports resolve; `flagEmoji`/`formatLocLine` (identity/flagTrust.ts) and `displayPartnerStars` (matchPeers.ts) all exist and are exported; both components are correctly mounted (`LiveStageVideo.tsx`, `mobile/app/live.tsx`). `npx tsc --noEmit` in `mobile/` shows zero errors touching these files. |

## Note (out of scope, flagging only)
`ui/live.js` currently has a large uncommitted working-tree diff (mic-boost gain graph, `pass_mic` gift, history thumbnails, geo localization, etc.) unrelated to this task's scope (watermark/dock/hop11). Per factory rules I did not touch it — flagging in case it's unexpected/another agent's in-progress work that Grok should be aware of before harvesting.

## Verify commands run
- `npx tsc --noEmit` (mobile/) — filtered to touched files, 0 errors
- Manual read of animation config, style plate, offer-kick/inflight-mutex logic, and import graph

## Connect risk
none

COMPLETE
