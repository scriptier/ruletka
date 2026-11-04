# Spec: 3-way black + UI off — tackle plan (2026-08-14)

**Status:** active · **FAIL** human desk `071810Z` · **no MULTI_PASS**  
**Shot:** `artifacts/shots/20260814T071810Z-3way-now-pc-live.png`  
**Raw:** `knowledge/raw/2026-08-14-3way-now-black.md`

```text
GOAL: In a live 3-way (laptop no-cam + Android + PC browser) each person
      sees the other two (or no-cam portrait) and hears them. Layout is
      three readable tiles, not a sliver + two black columns.
DONE WHEN (code — human smoke still required):
  A) 3rd offer is not dropped by hub per-client 3.5s debounce (n_targets
     can be 2; answers can match offers for 1v2).
  B) Web: 3rd tile only shows when that peer has live A/V; empty 3rd does
     not steal the grid. You-tile is not a sliver.
  C) Laptop no-cam paints cylinder on partner tiles (not black). Hex
     who-sub never paints as the name (AC8BEC2F class).
  D) Android extras still startCall2; audio-only is linked; no second GUM.
  E) pool=0; no force_relay flip; 1v1 path not torn.
EVAL:
  - node --check ui/live.js ui/webrtc.js
  - cargo test / rustc if hub lane edits simple.rs (no deploy)
  - av-verify after human rematch: 1v2 offers≈answers; do not invent ok
MUST NOT: pool>0; SFU; agent push.sh; APK flood; invent MULTI_PASS
```

## Evidence (this fail)

| Signal | Fact |
|--------|------|
| PC shot | Left **Laptop** black · mid **Laptop + Stranger · AC8BEC2F** dark · you **sliver** |
| Banner | You + friend · stranger on the right · MATCHED |
| Hub | `party vs solo` then **offers=2 answers=1** |
| av-verify | product.ok is **1v1 leftover**, not 3-way faces |
| Phone | no adb this capture |
| Disk vs prod | disk `594/324/410` — **this tab looks like old 3-col lock** (rsync still needed) |

## Why last herd was not enough

`20260814T065106Z` landed clones, layout CSS, recvonly, wiki. Human still sees FAIL because:

1. **Prod lag** — laptop/PC still running old JS/CSS until rsync + hard refresh.  
2. **3rd offer drop** — hub `last_offer_at` is **per client**. Two offers in 3.5s → second dropped → unanswered 3rd.  
3. **Layout still reserves a dead 3rd column** when `#tile-third` is shown but has no media.  
4. **Identity** still dual-paints Laptop + hex on the empty 3rd.  
5. **No-cam** still black if advertise/recvonly not on the live tab.

## Recommended lanes (5 · non-overlapping)

| # | Lane | OWN | Do |
|---|------|-----|----|
| 1 | **p-hub** | `bridge/src/simple.rs` | Offer debounce **per target peer**, not per sender. Do not drop 2nd offer to a different `to=`. No ICE policy. No deploy. |
| 2 | **p-web** | `ui/live.js` | Hex who-sub ban on extras; one name per tile; 3rd chrome only with live A/V; no-cam portrait hook; keep-PC held. |
| 3 | **p-layout** | `ui/live-stage.css`, `ui/live.html` | 3-way: if 3rd empty, **two wide tiles** (partner \| you). 3 live remotes: equal thirds, you not sliver. Bump `?v=`. |
| 4 | **p-android** | `mobile/app/live.tsx` | No-cam portrait; extras `startCall2`; Linking off on audio; never paint hex. **Not** MediaSession. |
| 5 | **p-wiki** | wiki + this spec residual + `SMOKE-NEXT` pins | File FAIL; human rsync checklist; no PASS invent. |

**Out this hop:** MediaSession (just landed), force_relay, pool, SFU, APK unless human says build apk.

## Human gates (not agent)

1. Rsync `live.html` + `live.js` + `webrtc.js` + `live-stage.css` + `i18n.js`.  
2. Hard-refresh **laptop + PC**.  
3. Plug Pixel for a phone shot.  
4. Rematch: 1v1 first, then Find 3rd.  
5. Hub hop needs **your** compile/restart if you want debounce on prod.

## CHECKPOINTS

1. Spec (this file)  
2. Herd lands 5 lanes  
3. Director bump cache  
4. Human rsync + smoke — only then 3-way faces
