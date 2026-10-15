# Unit: TURN URL order (VPN vs speed)

## Goal
Lock `preferFastTurnFirst` in `ui/webrtc.js`: UDP turn: first, then transport=tcp, then turns:. Do **not** change production order (TCP-first delayed first frame 0.5–2s).

## OWN
- `ui/webrtc.test.mjs` or `ui/turn-url-order.test.mjs` (create)
- Read-only `ui/webrtc.js`

## Must not
- Edit webrtc.js / live.js / MediaSession / coturn
- deploy, APK, pool>0

## Done
`node ui/turn-url-order.test.mjs` (or webrtc.test.mjs) passes asserting UDP < TCP < TURNS sort. RESULT + COMPLETE
