# Spec: 3-way cameras show (plan + hops)

**Status:** active · 2026-08-14 · herd `3way-cam` · **no MULTI_PASS**  
**Parent:** `current-multi-party.md` · `2026-08-14-3way-see-everyone.md` · `2026-08-14-finish-3way-4way.md`  
**Skills:** `multi-party-stage` · `av-fix-loop` · `android-partner-paint`  
**Latest measure:** CDP `234930Z` + phone `234751Z` + score `234754Z` · raw `2026-08-14-3way-ended-tracks-black.md` · gotcha **53**

```text
GOAL: In a live 3-way (PC Chrome + laptop/iPhone Chrome + Android app)
      each person sees the other two cameras (or an honest no-cam cylinder),
      hears them, and keeps the first camera when the 3rd joins.

DONE WHEN (human smoke — agents do not invent MULTI_PASS / product.ok):
  1) KEEP FIRST — after Find 3rd + 3rd joins, the original 1v1 faces stay
     moving on both ends ≥30s. No “spun into lobby”, no watchdog promote,
     no drop of a PC that already had ICE/frames.
  2) THREE FACES — each client shows 3 tiles (person | person | you).
     No black leftover slab (ended tracks + leftover videoWidth).
     No dummy has-remote-feed hiding the cylinder.
  3) PHONE SPLIT — Android extras>=1 splits 1v1 into stacked remotes
     (top first partner, bottom 3rd or connecting). Installed APK must
     be the extras hop (disk already; phone still 0.1.392).
  4) MESH — each client has a PC to each other person (1v2 offers≈answers).
     pool=0. No force_relay flip. No SFU.
  5) LEAVE — extra leave → 3→2, remaining camera stays. No rematch.

EVAL:
  - Human desk: 3 hard-refreshed browsers/app on live.js?v=635+ / webrtc 329+
    + APK that includes extras split. Agents do NOT invent MULTI_PASS.
  - CDP: #remote and #remote-third either live tracks + pixels OR cylinder.
    Never ended tracks + has-remote-feed + black.
  - av-verify after 1v2: do not treat leftover 1v1 product.ok as this gate.
    Need android frames on the NEW extra PC, not only the prior pair.
  - node --check ui/live.js ui/webrtc.js
  - node mobile/src/live/stageStreams.test.mjs
  - node mobile/src/live/matchPeers.test.mjs
  - pool=0; no force_relay flip

CHECKPOINTS:
  - Hard-refresh every Chrome tab to 635/329 (user) — required before
    scoring this hop.
  - APK bump only when human says build apk (phone extras is disk-only).
  - Hub per-target offer debounce (gotcha 40) needs compile/restart —
    not push.sh unless human says deploy.
  - 4-way smoke is later.

OUT OF SCOPE:
  - SFU · 4-way media smoke · Hide/Blur · Play upload · push.sh
  - ICE pool / force_relay policy
  - SoftBlur multi device

VERIFY:
  - Baseline FAIL: 234930Z Courtier black (ended tracks) · phone 1v1
    no-cam · user paste 632/326 promote + ice_failed · 1v2 offer recvonly
  - After each hop: shots + CDP + av-verify + units
  - Second critic: Claude on 635/329 (this herd)

LANE: herd 3way-cam (see phases)
OWN: one writer per file set
MUST NOT: pool>0 · force_relay flip · push.sh · APK flood · dual-write
          MediaSession · invent MULTI_PASS / product.ok / GOAL_MET
MAX HOPS: 1 implement per OWN then human hard-refresh + 3-way smoke
```

## Honest now (2026-08-14 23:53Z)

| Surface | Truth |
|---------|--------|
| Prod web | **`live.js?v=635` · `webrtc.js?v=329`** rsync `235308Z` (ended-track paint + no drop first-ok PC + recvonly promote) |
| User tab | Paste was still **632/326** — must hard-refresh |
| Debug Chrome | 3-col · Courtier **black** (tracks **ended**) · mid cylinder · you live |
| Phone | **0.1.392 / vc400** **1v1** no-cam. Extras split **on disk**, not installed |
| Score | Prior 1v1 frames both ways; **1v2** android **0/0** + web offer **recvonly** |

## Why cameras die (stack, not one bug)

| Layer | Failure | Hop |
|-------|---------|-----|
| **A Paint** | Ended tracks + leftover 427×320 + `has-remote-feed` = black slab | **635 landed** — needs refresh |
| **B First PC** | Find-3rd promote / lobby spin / ice_failed drop of the good PC | **328 skip promote + 329 no-drop** — needs refresh |
| **C 3rd SDP** | New PC offer `recvonly` before preview map → Android dummy / 0/0 | **329 promote+renego** — needs refresh |
| **D Phone layout** | extras>=1 split on disk; installed APK still 1v1 | **APK** (human) |
| **E Android extra PC** | 3rd join `startCall` / `dropDeadPc` / no secondary adopt → 0/0 | **MediaSession** this herd |
| **F Hub debounce** | Per-sender 3.5s drops 2nd offer in 1v2 (gotcha 40) | **Hub deploy** (human) |
| **G Occupancy** | Dead Courtier name stays on `#remote`; live extra not rebound | **635 rebind** — needs refresh |

## Phases (do in order; one writer each)

| Phase | What | Who | Gate |
|-------|------|-----|------|
| **0** | Human hard-refresh 635/329 | Human | Console pins match |
| **1** | Second critic + units + wiki | Claude | RESULT, no live.js write |
| **2** | Android extra PC must not tear primary; clone/adopt 2nd | Grok `MediaSession.ts` only | units + no 1v1 startCall on extras |
| **3** | Phone extras split audit (LiveStageVideo / stageStreams) | Grok mobile live UI | extras>=1 splits without remount |
| **4** | Human 3-way smoke after refresh | Human | faces or new FAIL lines |
| **5** | APK only if Phase 4 still phone 1v1 after refresh | Human says **build apk** | SMOKE-NEXT version only |
| **6** | Hub debounce deploy if offers>answers on 1v2 | Human says **deploy** | not this agent |

## Lanes this herd (non-overlapping)

| ID | Agent | OWN | Do not |
|----|-------|-----|--------|
| c-critic | Claude | `tasks/admin-queue` RESULT only | live.js, webrtc.js, MediaSession |
| c-unit | Claude | `mobile/src/live/*test.mjs` | live.js, MediaSession, APK |
| c-wiki | Claude | `knowledge/wiki/multi-party.md` `log.md` `resources.md` | now.md (director), live.js |
| g-media | Grok | `mobile/src/media/MediaSession.ts` + its unit tests | live.js, live.tsx, APK |
| g-and | Grok | `LiveStageVideo.tsx` `stageStreams.ts` `matchPeers.ts` | MediaSession, live.js |
| g-measure | Grok RO | artifacts shots / av-verify | no product code |

`ui/live.js` + `ui/webrtc.js` are **closed** this hop (just shipped 635/329).
