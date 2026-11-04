# BM3-hunt-layout-golden — RESULT

**Status:** COMPLETE (static audit) · **PASS on code layout contract**  
**Date:** 2026-08-12T03:13:49Z  
**HEAD:** `a0d195d`  
**Root:** `/home/drakosik/freenet-roulette`  
**OWN:** LiveStageVideo `lookingForThird` / `huntingThird` column split (top partner · bottom looking)  
**Code change:** none (read-only)  
**APK / phone / deploy:** none  
**Multi product PASS invent:** **none** (human find-3rd / multi smoke still OPEN)

## Goal

B5 hunt layout golden from `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md`:

> Android column top/bottom; PC trio — static audit LiveStageVideo column split.

Task card: `tasks/grok-loop/running/BM3-hunt-layout-golden.md` → static LiveStageVideo column split. Soft rules: RESULT COMPLETE; **no invent multi PASS**.

## DONE WHEN (static)

| Check | Result |
|-------|--------|
| Phone portrait hunt = **flex column** (horizontal midline) | **PASS** |
| Top = partner RTC path · bottom = looking brand + caption | **PASS** |
| Hunt does **not** flip `multiRemote` (no 1v1→multi remount) | **PASS** |
| Looking pane is sibling strip (`live-looking-for-third`), not partner tile swap | **PASS** |
| Wide landscape may row; portrait stays column | **PASS** |
| PC trio CSS/layout present (partner \| looking \| you) | **PASS** (static) |
| Device / human faces smoke | **not run** — **OPEN** |

## Verify

```bash
cd /home/drakosik/freenet-roulette
node mobile/src/live/stageStreams.test.mjs
# stageStreams.test.mjs: ok
```

| Item | Result |
|------|--------|
| `stageStreams.test.mjs` | **PASS** (`ok`) |
| Code edit | none |
| Device / multi / find-3rd smoke | not run / not claimed |

---

## Trace — Android column split

### 1. Prop wire (`mobile/app/live.tsx` ~5797–5804)

```text
lookingForThird =
  !remoteStream2 && !remoteStream3
  && !!remoteStream
  && !!(huntingWithPartner || findThirdPending)
```

- Requires live primary remote (partner on stage).
- Ends when media2/3 lands.
- Driven by hunt flags only — **not** bare `matchMode === "party_browse"` (avoids sticky after cancel).

### 2. Gates (`LiveStageVideo.tsx` ~350–365)

```text
huntingThird =
  lookingForThird
  && !remoteStream2 && !remoteStream3
  && (hasRemote || remoteStream)
  && (phase matched|search || remoteStream)

multiRemote = multiFromPeers   // stream2 | stream3 | extraPeerCount > 0 only
splitWide   = stageW/stageH >= 1.15
```

Comment lock (~350–351, ~431, ~616): *Must NOT flip multiRemote (unmounts 1v1 RTCView → partner freezes)*; *Hunt uses 1v1 VideoView + looking strip*; *1v1 OR find-3rd hunt: keep partner VideoView mounted; only wrap layout*.

### 3. Render tree (1v1 / hunt branch — else of `multiRemote`)

```
multiRemote ? [multi tiles column|row…] : (
  outer View:
    style = huntingThird
      ? (splitWide ? splitRemoteWide : splitRemote)   // column default
      : remoteFill
    partner half:
      style = huntingThird ? splitHuntTile* : remoteFill
      SwipeSkipOverlay → VideoView(displayMainStream)   ← same 1v1 mount path
    huntingThird ? looking half:
      testID=live-looking-for-third
      BrandLoadingLoop + lookingLabel caption
  PiP (!multiRemote)
)
```

| Pane | Portrait styles | Role |
|------|-----------------|------|
| Outer | `splitRemote` → `flexDirection: "column"` | horizontal mid-split host |
| Partner (first child) | `splitHuntTile` flex 1 · basis 50% · **minHeight 45%** | top conversationalist |
| Looking (sibling) | `splitHuntTile` + Last + `splitHuntTileLookingMin` **minHeight 35%** | bottom brand + caption |
| Landscape wide | `splitRemoteWide` **row** + `splitHuntTileWide*` minWidth floors | PC-like side-by-side only when aspect ≥ 1.15 |

### 4. Styles (`liveStyles.ts` ~679–767)

| Style | Direction / floor |
|-------|-------------------|
| `splitRemote` | **column** — phone multi / find-3rd horizontal midline |
| `splitRemoteWide` | **row** — wide/landscape only |
| `splitHuntTile` | partner top: minHeight **45%**, hairline bottom border |
| `splitHuntTileLookingMin` | looking bottom: minHeight **35%** |
| `splitLookingFill` | brand loop + caption host |

Product contract match: phone **top partner · bottom looking** (not PC side-by-side columns in portrait).

### 5. `stageStreams.ts`

- `multiRemote` = `remoteStream2 ‖ remoteStream3 ‖ extraPeerCount > 0` only (~51–55).
- Hunt UI intentionally **out of** stream picker; `huntingThird` is LiveStageVideo-only.

---

## Trace — PC trio (B5 sibling, static)

| Piece | Location | Role |
|-------|----------|------|
| `enableTrioLayout(on, { searching })` | `ui/live.js` ~11705 | toggles `stage-trio` + `stage-trio-searching` |
| Grid | `ui/live-stage.css` ~2180 | `grid-template-columns: 1fr 1fr 1fr` |
| Middle looking | `.tile-third` / `.third-empty` | brand loop middle while searching |
| Keep paint | `softKeepPartnerPaint` path (skill / prior audits) | not re-audited this hop for ICE/media |

PC is **vertical columns** (partner \| looking \| you); Android portrait is **horizontal mid-split**. Both intentional.

---

## Findings

1. **Column golden (Android portrait):** `splitRemote.flexDirection === "column"` + partner then looking children → top/bottom. **PASS.**
2. **No RTC remount on hunt:** stays on 1v1 `VideoView` path; only outer styles + looking sibling. **PASS.**
3. **Looking strip separate:** `BrandLoadingLoop` + caption under `testID="live-looking-for-third"`. **PASS.**
4. **Asymmetric floors:** partner ≥45%, looking ≥35% — conversationalist dominates. **PASS.**
5. **Clear gates:** remote2/3 kill lookingForThird; extras → multiRemote owns layout. **PASS.**
6. **No one-line layout bug** with static proof requiring a fix this hop.

**Edge (not FAIL):** if `extraPeerCount > 0` before `remoteStream2` binds, multiRemote wins and hunt UI yields to multi tiles — intentional handoff, not hunt remount of partner-only 1v1.

---

## Explicit non-claims (soft rules / no invent multi PASS)

| Claim | Verdict |
|-------|---------|
| Find-3rd human faces live ≥30s both clients | **NOT claimed** — smoke OPEN |
| Multi 3-way / 4-way GOAL_MET | **NOT claimed** |
| Phone APK binary ships this layout on device | **NOT claimed** — no rebuild this hop |
| PC softKeepPartnerPaint product PASS | **NOT claimed** — CSS/trio structure only |
| Deploy / prod CDN tip | **NOT claimed** |

Static **layout contract** PASS ≠ multi product PASS.

---

## Connect risk

**None.** Read-only UI layout audit. No ICE / pool / MediaSession / force_relay / deploy / APK.

---

## Files reviewed (read-only)

- `/home/drakosik/freenet-roulette/mobile/src/live/LiveStageVideo.tsx`
- `/home/drakosik/freenet-roulette/mobile/src/live/liveStyles.ts`
- `/home/drakosik/freenet-roulette/mobile/src/live/stageStreams.ts`
- `/home/drakosik/freenet-roulette/mobile/app/live.tsx` (lookingForThird prop)
- `/home/drakosik/freenet-roulette/ui/live-stage.css` (stage-trio)
- `/home/drakosik/freenet-roulette/ui/live.js` (`enableTrioLayout` presence)
- `/home/drakosik/freenet-roulette/.grok/skills/multi-party-stage/SKILL.md` (contract)
- `/home/drakosik/freenet-roulette/knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` (B5)

**Files touched:** none

---

## COMPLETE

Static audit **PASS** for Android `lookingForThird` **column** split (top partner · bottom looking) without flipping `multiRemote`. PC trio grid present on disk. No fix; no APK. Human find-3rd / multi smoke remains **OPEN** — do not invent multi GOAL_MET.
