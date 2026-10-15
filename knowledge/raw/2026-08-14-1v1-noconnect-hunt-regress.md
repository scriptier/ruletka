# Raw: 1v1 no-connect after hunt-keep — 2026-08-14T03:15Z

**product.no-media** `20260814T031506Z` · answers 2/4 · frames 0/0 · android ice=**new** bind_v=**0** · app_vc 384

Shots: `artifacts/shots/20260814T031454Z-noconnect-phone.png` (Linking 0:25 black) · `…-noconnect-pc.png` (MATCHED partner black)

Cause (web hunt hop): `html.match-live #remote-empty { display:none }` hid 1v1 empty/linking overlay → black tile. `isHuntOnePeer` = `trioBrowse && size<2` could skip ICE recover if trioBrowse latched.

Revert: CSS only `.stage-trio-searching`. `isHuntOnePeer` requires `main.stage.stage-trio-searching`. Pins **live.js?v=576** · **stage?v=405**.

Not linking GOAL_MET. Not MULTI_PASS.
