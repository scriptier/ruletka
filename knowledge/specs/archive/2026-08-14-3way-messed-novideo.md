# Spec: 3-way browser black + sliver + silent

**Status:** active · FAIL `084504Z` · **no MULTI_PASS**  
**Shots:** `artifacts/shots/20260814T084504Z-3way-messed-pc.png` · `…-phone.png`  
**Score:** av-verify `20260814T084452Z` product one-way · android 0/0 · app_vc **392**

```text
GOAL: In 3-way (PC + laptop + Android) each browser sees the other two
      (or no-cam portrait), hears them, 3 equal tiles, no Find-3rd
      middle on a live 3-way, you not a sliver.
DONE WHEN (disk — needs rsync + human smoke):
  A) MATCHED 3-way never shows hunt "Find 3rd" as the middle column.
     tile-third only if that peer has live A/V; else 2-wide partner|you.
  B) You-tile min-width equal third — never sliver.
  C) Remote <video> play() + srcObject bound per distinct peer.
     Same stream never on two tiles.
  D) Audio: remote audio elements unmuted / volume wired per tile.
  E) pool=0; no force_relay flip; 1v1 not torn.
EVAL:
  - node --check ui/live.js ui/webrtc.js
  - grep Find 3rd / stage-trio-searching vs MATCHED
  - av-verify after rematch: do not invent ok; 1v2 leftover ≠ 3-way
MUST NOT: pool>0; SFU; deploy; APK (phone is 392 until they install 385);
          invent MULTI_PASS
```

## Evidence

| Signal | Fact |
|--------|------|
| PC | Left Courrier black · mid Find 3rd · you sliver |
| Banner | You + friend · stranger on the right · MATCHED |
| Phone | 1v1 Partner ★0 black · vc **392** not 385 |
| Score | offers=3 answers=2 · android ice checking 0/0 |
| Tab | **prod ruletka.vip** — disk hops need **rsync** |

## Lanes

| Lane | OWN |
|------|-----|
| b-js | `ui/live.js` |
| b-css | `ui/live-stage.css` `ui/live.html` |
| b-webrtc | `ui/webrtc.js` |
| b-wiki | wiki + SMOKE-NEXT pins |
| Claude | critic + units + i18n |
