# Spec: Finish 3-way / 4-way (connect + UI)

**Status:** active · 2026-08-14 · herd `20260814T212123Z` · **no MULTI_PASS**  
**Skill:** `multi-party-stage` · parent `current-multi-party.md` · see-everyone `2026-08-14-3way-see-everyone.md`  
**Today FAIL:** `raw/2026-08-14-3way-624-shots.md` (`211817Z`)

```text
GOAL: Android + original PC + laptop 3rd each see the other two (or no-cam
      portrait), hear them, and show tile-count = people (2 / 3 / 4).
DONE WHEN:
  1) MEDIA — after Find 3rd accept + 3rd joins: original PC stays 3 columns
     (not 1v1). Laptop (3rd) paints both party members. Android keeps first
     partner RTCView and shows 3rd as second remote (not laptop-only).
  2) LAYOUT — 2 people → 2 tiles; 3 → 3; 4 → 4. No hunt “Find 3rd” mid
     column on a live MATCHED 3-way. 2×2 control only at 4 people.
  3) CONNECT — mesh: each client has a PC to each other person (offers≈answers
     for 1v2). pool=0. No force_relay flip. No SFU.
  4) 4-way stretch — you+3 remotes: four tiles, no permanent black orphan
     (layout + join cap already on disk; smoke later).
EVAL:
  - node --check ui/live.js
  - node mobile/src/live/stageStreams.test.mjs
  - node mobile/src/live/matchContinuity.test.mjs
  - grep: clearStaleTrioOnPair returns early on party_browse / yourRole=party
  - Human desk rematch (Android invite → laptop accept → original PC 3-col)
    — agents do NOT invent MULTI_PASS
CHECKPOINTS:
  - Human rsync live.js after web lane (say proceed)
  - Human APK only if Android keep-first needs a new build
  - No ICE / pool / force_relay this herd
OUT OF SCOPE:
  - SFU · 4-way media smoke this hop · watermark · Hide/Blur · Play upload
VERIFY:
  - Baseline: FAIL `211817Z` (PC 3-col works; Laptop+Courtier black;
    occupancy Laptop on main; phone still 1v1 0.1.392)
  - After: units + static grep; human 3-way paste
  - Second critic: optional verify-only after both implementers
LANE: herd (p-web · p-html · p-css · p-and)
OWN FILES: see lanes below
MUST NOT: pool>0 · force_relay flip · push.sh · APK flood · MediaSession ICE
          · dual-write live.js+MediaSession · invent MULTI_PASS / product.ok
MAX HOPS: 1 implement per OWN then human smoke
```

## Honest now

| Surface | Truth |
|---------|--------|
| Prod web | `live.js?v=624` · stage **439** · brand **19** — PC **3-col works** |
| Disk web | same **624 / 439** (re-read `ui/live.html` this hop). **No MULTI_PASS** |
| 3-way `211817Z` | Laptop+Courtier **black**; occupancy **Laptop on main** (`#remote`) |
| Phone | **0.1.392 / vc400** — still **1v1**; extra-tile split disk-only |
| This herd | `20260814T212123Z` **p-web** · **p-html** · **p-css** · **p-and** |
| 4-way | layout hooks on disk; **not** this desk smoke |

## Lanes (non-overlapping) — herd `20260814T212123Z`

Prior m-web/m-and/m-css hops landed **624 / 439** 3-col. This herd paints occupancy + no-cam + phone split.

| ID | OWN | Do | Do not |
|----|-----|----|--------|
| **p-web** | `ui/live.js` only | First partner stays on `#remote`; 3rd on `#remote-third`; Laptop must not steal main; hookNoCam on third | MediaSession · CSS · HTML · APK |
| **p-html** | `ui/live.html` only | no-cam portrait markup in `#tile-third` (and remote2 if missing) | live.js · CSS · APK |
| **p-css** | `ui/live-stage.css` only | no-cam cylinder on trio extra tiles; 3-col unchanged | live.js · live.html · APK |
| **p-and** | `live.tsx` · `LiveStageVideo.tsx` · `stageStreams.ts` + test | extraPeerCount≥1 second tile; no remount first RTCView | `MediaSession.ts` · ICE · APK · live.js |

Director after: optional rsync on **proceed**. **No MULTI_PASS.**

## Priority

1. **P0 occupancy + paint** — Laptop must not occupy main; remotes paint (or no-cam); phone 1v1→split.  
2. **P1 mesh** — laptop paints both remotes (joinPeers + answer).  
3. **P2 4-way tiles** — no orphan (CSS + existing cap).  
4. **P3** webrtc clone heal — only if a later scorecard shows shared-track freeze.

## MUST NOT

- Invent MULTI_PASS / product.ok / GOAL_MET  
- `iceCandidatePoolSize` ≠ 0 · force_relay flip · `push.sh`  
- Unmount partner RTCView to “enter multi”  
- Dual-write MediaSession + live.js  
