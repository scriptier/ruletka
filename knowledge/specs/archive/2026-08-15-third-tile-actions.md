# Spec: 3rd tile partner actions (browser)

**Status:** active · 2026-08-15  
**Human:** click middle tile in 3-way — nothing. Left tile works.  
**Shot:** `artifacts/shots/20260815T211540Z-midclick-pc.png` (Courtier | Laptop no-cam | you)  
**Prod:** `live.js?v=650` · stage **447**. Disk **655/450** never reached ruletka.me.

## GOAL

Middle conversationalist has the same partner actions as the first: mute, volume, blur, click → menu (friend / gifts / report).

## DONE WHEN (code — still needs rsync)

1. Visible **Actions** control on `#tile-third` (not only click-on-video). Always on in 3-way.
2. That control + tile click open `openPartnerMenu({ slot: "remote-third" })`.
3. `extraPartnerMeta()` works if the mid tile is shown (no-cam laptop included).
4. `clearStaleTrioOnPair` must **not** run for the 3rd menu.
5. `node --check ui/live.js` · `node ui/live-third-slot.test.mjs`

## MUST NOT

MediaSession · webrtc.js · ICE · force_relay · hunt remount · APK · invent MULTI_PASS · `push.sh` from a lane

## Lanes

| Lane | OWN |
|------|-----|
| p-html | `ui/live.html` |
| p-js | `ui/live.js` |
| p-css | `ui/live-stage.css` |
| p-test | `ui/live-third-slot.test.mjs` |
