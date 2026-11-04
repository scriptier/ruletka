# Spec: 3-way see everyone (media + chrome + layout)

**Status:** active · human interview 2026-08-14 · herd proceed · **no MULTI_PASS**  
**Related:** `current-multi-party.md` · `2026-08-14-3way-black-plan.md` · skill `multi-party-stage` · `mobile-match-identity`  
**Shots:** `artifacts/shots/20260814T075019Z-android-black-partner.jpg` · `20260814T071810Z-3way-now-pc-live.png`

```text
GOAL: In a live 3-way (Android app + PC browser + laptop browser) each
      person sees the other two (or no-cam portrait), hears them, and
      can tell who is who. One person per tile. Tile count equals
      people: 2 / 3 / 4. 2×2 switch exists only when there are 4 people.

DONE WHEN (human smoke — agents do not invent MULTI_PASS):
  1) MEDIA — laptop: one tile is PC cam, one tile is Android cam.
     Not PC cam twice. Not a missing Android tile.
     PC: sees Android + laptop (laptop no-cam = portrait, not black).
     Android: sees both conversationalists (PC and laptop).
  2) ANDROID LAYOUT — when the 2nd remote is live, the old 1v1 big
     window splits into two equal stacked remotes (top one person,
     bottom the other). Small PiP stays the Android user's camera.
     Do not unmount the first partner RTCView to enter this tree.
  3) LAYOUT BY HEADCOUNT (web + Android) — tile count = people.
     1v1 (2 people): exactly 2 tiles. No 2×2 control.
     3-way (3 people): exactly 3 tiles. No 2×2 control.
     4-way (4 people): exactly 4 tiles. Optional switch to 2×2
     (same four people, one per cell, no duplicate cam).
     Android 3-way: big 1v1 window splits top/bottom remotes; PiP = you.
     Browser 3-way: columns person | person | you.
  4) CHROME — every remote tile has: name (never hex), location
     (or “Location hidden”), stars, and a volume control for that
     person. Missing stars on one conversationalist is FAIL.
     Volume: per-tile (that person only).

EVAL:
  - Human desk rematch after rsync + hub restart + hard refresh:
    laptop ≠ double PC; Android stacked two remotes + PiP you;
    both remotes named · located · starred · volume.
  - node --check ui/live.js ui/webrtc.js
  - Android: node src/live/stageStreams.test.mjs (and matchContinuity)
  - av-verify after rematch: 1v2 offers≈answers; leftover 1v1
    product.ok is NOT this gate
  - pool=0; no force_relay flip

CHECKPOINTS (human already answered):
  - Win = all three surfaces (media + Android stack + chrome), not
    chrome-only or Android-only.
  - Tile count = people. 2×2 control only when 4 people.
  - 1v1 and 3-way: no 2×2 option at all.
  - Volume = per person on that tile.

CHECKPOINTS still open:
  - 4-way 2×2 default vs last-used — default stays the 4-tile
    non-grid until human says otherwise.
  - 4-way smoke is not this desk hop (desk mix is 3 people).

OUT OF SCOPE:
  - SFU / mediasoup
  - 4-way media smoke this desk hop (layout rule is locked; mix is 3)
  - ICE / pool / force_relay policy
  - SoftBlur multi device
  - APK/deploy unless human says build apk / rsync

VERIFY:
  - Baseline: human FAIL — laptop double PC, Android black/missing
    second cam, PC chrome missing volume + loc + one ★
    (shot 075019Z phone black 1v1 leftover; 071810Z trio sliver)
  - After: same desk mix, new shot both browsers + phone
  - Second critic: verify-only after web+android layout hop

LANE: multi-party-stage (layout/slots) + mobile-match-identity (★/loc)
      + client-ice ONLY if a remote has frames_in=0 after answers
OWN FILES (non-overlapping if herded):
  - ui/live.js · ui/live-stage.css · ui/live.html
  - mobile/src/live/LiveStageVideo.tsx · stageStreams.ts · liveStyles.ts
  - mobile/app/live.tsx (hunt→multi wrap only; not MediaSession)
MUST NOT: pool>0; unmount live partner RTCView; invent MULTI_PASS;
          push.sh; dual-write MediaSession; APK flood
MAX HOPS: 2 implementer hops without new human smoke
```

## What the human said (locked)

Mix: **PC browser + laptop browser + Android app** (3 people).

| Surface | They see now | They want |
|---------|--------------|-----------|
| PC browser | Android cam works (progress). No volume. Location missing on both. Stars missing on one. | Each remote tile: volume + loc + stars |
| Laptop browser | **PC camera twice**. No Android cam. | One tile = PC, one tile = Android |
| Android | Does not see both conversationalists. 1v1 big window stays 1v1. | Big window **splits top/bottom** (one remote each). Small window = you |

**2v1** here means **you + two remotes** (3-way), not a sports score.

## Layout contracts (this spec) — locked 2026-08-14

Tile count **equals people**. One person per tile. **No empty extra tile.**

| People | Tiles | 2×2 switch | Android | PC / laptop |
|--------|-------|------------|---------|-------------|
| **2** (1v1) | **2** | **No** | Full partner + small you | Partner \| you |
| **3** (3-way) | **3** | **No** | Top remote · bottom remote + small you | Person \| person \| you |
| **4** | **4** | **Yes** | 4 tiles (3 remotes + you); optional 2×2 of the same four | 4 tiles; optional 2×2 of the same four |

- 2×2 must **not** appear in 1v1 or 3-way.
- 4-way 2×2 = the four people, one per cell. No fifth/empty cell.
- Duplicate PC cam on laptop = FAIL.
- Do not unmount the first partner RTCView when 1v1 → 3 tiles.

## Honesty

- Disk hops from herd `20260814T072031Z` (debounce, layout, identity) **need rsync + hub restart**. Prod lag can still look like this FAIL.
- 1v1 leftover `product.ok` / high android frames_in ≠ 3-way faces.
- **No MULTI_PASS** until human pastes both browsers + phone seeing the other two.

## Status

- **Active** — human said proceed + all subagents. Herd implement; no MULTI_PASS invent.
- Last measure: phone black partner 14:44 (`075019Z`); earlier trio sliver (`071810Z`).
