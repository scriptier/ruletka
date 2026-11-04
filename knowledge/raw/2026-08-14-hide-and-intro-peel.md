# Human FAIL — Hide dead on PC; Android SoftBlur 3–4s then gone

**When:** 2026-08-14 (after 0.1.391 / vc399 install)
**Who:** human director

## Ticket
- Browser **Hide** stopped working (you-tile stayed clear / looked like a no-op).
- Android saw the **right** SoftBlur of the browser camera, then it **disappeared after 3–4 seconds**.

## Diagnosis (disk, not GOAL_MET)
1. Intro timer `INTRO_UNBLUR_MS=2800` peels SoftBlur. SoftBlur wrapper used `blurCoverElevated` (`#45536c` + elevation 32) and stayed mounted. After `setActive(false)` the live blur vanished and the slate slab covered RTCView. Matches 3–4s.
2. 391 also `forceRepaintRemote` on intro peel → remount → navy (gotcha 45/46).
3. Browser Hide: CSS only hid `#local` when `:has(.video-blur-canvas.is-active)`. Late/missing canvas = clear selfie so Hide looked broken. Outbound blur track can still work (phone saw “right blur”).

## Disk hop (this note)
- `softBlurCover` transparent + `softBlurIdle` collapse; no intro remount.
- Hide CSS covers `.vid.local` whenever `.self-blurred`; canvas starts `is-active` even if video late.
- Pins `live.js?v=603` · `live-stage.css?v=420`.

## Follow-up (same day)
Human: **Blur them** on conversationalist also dead.

Cause: `.tile-remote.has-remote-feed #remote { opacity: 1 !important; z-index: 5 !important }` beat the partner-blurred hide; canvas z 4 sat under a sharp face. Same lock on `#local` (z 20) for Hide.

Disk hop: partner-blurred / self-blurred override `opacity: 0.001 !important` + canvas z 6. Pins `live.js?v=604` · stage **421**.

## Follow-up 2 — Hide/Reveal still dead
Human: Hide/Reveal on browser also dead.

Two remaining causes:
1. `live.html` inline `#tile-local #local { opacity:1; z-index:20 }` (same lock as stage CSS).
2. `applySelfBlurPolicyForSession` on joinPeers/ICE force-revealed after user Hide.

Disk: `applyLocalHideCover` sets inline !important; `selfBlurUserLocked` skips mid-match policy; live.html self-blurred exception. Pins `live.js?v=605` · stage **422**.

**No product.ok / blur GOAL_MET.** Needs APK + human rsync + smoke.
