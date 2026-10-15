# 2026-08-14 234930Z — 3-way cameras black (ended tracks + ice drop)

## Shots
- `artifacts/shots/20260814T234600Z-cdp-live.png` / `234930Z-cdp-live.png` — debug Chrome 3-col: Courtier **black** | mid no-cam cylinder | you (Razer) live. Banner Connection weak.
- `artifacts/shots/20260814T234751Z-phone.png` / `234903Z-cam3b-phone.png` — Pixel **1v1** Partner no-cam cylinder + self PiP. Not 3-way split.
- `artifacts/shots/20260814T234903Z-cam3b-pc.png` — desktop of debug Chrome + DevTools.

## Chrome CDP (tab on 634/328)
- `#remote` w=427 h=320 paused=false **has-remote-feed** noCam hidden
- tracks: audio **ended**, video **ended**
- `#remote-third` w=0 no tracks, tile has-no-cam-portrait
- peers=1, conn-label Connection weak
- Console: skip promote (328 worked) then Partner left + keep-pair drop

## User paste
- live.js **632** / webrtc **326** (old tab — not 634/328)
- find-3rd → spun into lobby → Matched Keep add peer → offer watchdog **promote** → ice_failed → keep-pair drop + null pc
- vibrate / funnel 400 / NSFW kernels = ignore

## Score `234754Z`
- product.ok from **prior 1v1** web 240/299 android 282/237 app_vc 400
- then `party vs solo` 1v2 → android arm_0 bind_v=0 **0/0** · first offer `video_dir=recvonly`
- parse product.ok ≠ 3-way faces

## Hop (disk+rsync)
- live.js **635** · webrtc **329** · stamp `20260814T235308Z-cam3-635`
- ended tracks ≠ painted; do not drop first-ok PC on 3rd-join ice_failed; recvonly→sendrecv renegotiate
- **no MULTI_PASS** · phone extras still APK 0.1.392
