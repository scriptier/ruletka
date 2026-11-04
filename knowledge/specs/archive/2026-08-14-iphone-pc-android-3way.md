# Spec: iPhone Safari + PC + Android 3-way (Android is 3rd)

**Status:** active · 2026-08-14 · human desk · **no MULTI_PASS**  
**Mix:** fiancée **iPhone Safari** ↔ **this PC browser** (1v1 first) → then **Android app** joins as 3rd.  
**Parent:** `2026-08-14-3way-see-everyone.md` · skill `multi-party-stage`

```text
GOAL: After iPhone Safari + PC are live, Android joining as 3rd must
      give each person the other two (or no-cam). Leaving the 3rd
      must keep the remaining pair (already observed).

DONE WHEN (human — agents do not invent MULTI_PASS):
  1) MEDIA — iPhone sees PC + Android. PC sees iPhone + Android.
     Android sees both browsers. Not “browsers see each other only.”
  2) LEAVE — iPhone hangup → 2 tiles and PC↔Android stay live
     (already true 2149Z; must not regress).
  3) CONNECT — Android ice≠failed; offers≈answers for the 1v2.
     pool=0. No force_relay flip. No SFU.
  4) LAYOUT — 3 people → 3 tiles. Android splits two remotes + PiP you.

EVAL:
  - av-verify during the 3-way: android fin/fout > 0, ice connected
    (214914Z was android 0/0 ice=failed · two webs host→host 4900+)
  - node --check ui/live.js ui/webrtc.js
  - node mobile/src/live/matchContinuity.test.mjs
  - node mobile/src/media/mediasessionMultiSafety.test.mjs
  - Human rematch this mix after rsync + APK if Android OWN shipped

CHECKPOINTS:
  - Dual inbound offers on Android-as-3rd must not both apply to media1
  - Web incremental join: do not rematch-tear iPhone↔PC when Android joins
  - 3→2 keep pair stays

OUT OF SCOPE:
  - SFU · coturn thrash · force_relay flip · 4-way smoke · push.sh
  - APK unless human says build apk · rsync unless proceed

VERIFY baseline:
  - Human: iPhone sees self+PC not Android; PC same; Android sees nobody
  - After iPhone end: 2 tiles, PC sees Android again
  - Score 214914Z product one-way · answers 6 < offers 8 · err_437=16
    · app_vc 400 · two web av_path host→host · android ice failed
```

## Diagnosis (do not ICE-thrash)

| Fact | Meaning |
|------|---------|
| Two webs **host→host** + huge frames | iPhone↔PC mesh is fine |
| Android **ice=failed 0/0** | Android never completed a PC to either browser |
| 3→2 restores Android on PC | Primary path can work; **join as 3rd** tears it |
| Usual desk was Android+PC then laptop 3rd | **This mix is inverted** — Android is the cold 3rd |

**Primary hypothesis:** both browser offers land on Android `media1` (signal before `secondaryPeerId` / extras latch) → `setRemote` thrash → ice=failed. `media2` never answers the second person.

**Secondary:** `startCall2` clone/share or 437 on 2nd TURN; must not kill media1.

**Not this hop:** flip force_relay, pool>0, coturn restart.

## Lanes

| ID | OWN | Do |
|----|-----|-----|
| **i3-and** | `live.tsx` · `matchContinuity.ts` · `matchPeers.ts` | Dual-offer route: 3rd-joiner latch both peers before SDP; extra SDP → media2; never steal media1 |
| **i3-ms** | `MediaSession.ts` + multi safety test | Answered primary rejects foreign offer; no dropDeadPc for extra; isolate ICE fail |
| **i3-web** | `ui/live.js` | Existing duo adding Android: incremental join; 3rd on `#remote-third` |
| **i3-webrtc** | `ui/webrtc.js` | iOS Safari 3-way transceiver + clone; pool=0; no 48k force |
| **i3-css** | `ui/live-stage.css` | 3 people → 3-col; do not collapse mid join |

Director bumps `live.html` pins after web/css land. **No MULTI_PASS.**
