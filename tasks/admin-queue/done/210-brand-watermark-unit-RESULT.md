# 210 — Unit/verify: BrandWatermark exists + LiveStageVideo import

Status: COMPLETE (no changes needed — lock already present and passing)

## Findings
- `mobile/scripts/verify-match-ux.mjs` already contains the exact static lock requested (added in prior uncommitted work in this worktree, lines ~272–295):
  - Asserts `mobile/src/live/BrandWatermark.tsx` exists and exports `export const BrandWatermark`.
  - Asserts `mobile/src/live/LiveStageVideo.tsx` imports `BrandWatermark` from `"./BrandWatermark"` and mounts `<BrandWatermark`.
- `LiveStageVideo.tsx` already imports `BrandWatermark` (line 19) and mounts `<BrandWatermark animKey={remoteEpoch} />` (line 686), gated on `phase === "matched" && hasRemote && !swapViews && !coverMainPartner && !coverMainPartnerHide` — i.e. always-on stage mark whenever the partner is live and unveiled on main. This matches the component's existing intent (center→edge drift watermark on the partner stage).
- No wiring gap existed, so the "minimal wire" fallback in the task was not needed.

## Files touched
None — verified existing state only. (`verify-match-ux.mjs`, `LiveStageVideo.tsx`, `BrandWatermark.tsx` are pre-existing untracked files in this worktree from prior work, not modified by this task.)

## Verify commands run
- `cd mobile && node scripts/verify-match-ux.mjs` → `L0 done: 23 ok, 0 fail` (includes "BrandWatermark.tsx exports BrandWatermark" and "LiveStageVideo imports + mounts BrandWatermark", both OK)
- `npm run test:match-ux` → same, 23/23 OK
- `node scripts/test-live-units.mjs` → `live-units OK (10)` (unaffected, confirms no regression)

## Connect risk
none — no code paths touched (ICE/MediaSession/hub untouched); verification-only task.

COMPLETE
