# BM2 blur match apply fix — RESULT

**Status:** COMPLETE  
**OWN:** `mobile/app/live.tsx` blur/match paths only  
**Date:** 2026-08-12  
**APK / deploy / multi PASS:** none (no invent)

## Goal
BM1 forensics: prefs `intro` mid-match but `veil_visible=no` and **no** `[blur] show`. Ensure Matched strangers with intro|hold get `applyMatchBlurVeil` once when remote stream is ready (and at Matched).

## Root cause

| Finding | Detail |
|---------|--------|
| First Matched veil was **inline** `setRemoteBlurred` + optional console log | Not always via `applyMatchBlurVeil`; easy to miss on `keepPrimary` thrash |
| `keepPrimary` rematch **skipped** the veil block entirely | Soft rematch / stream-before-paint races left `remoteBlurred=false` with no re-apply |
| `onRemoteStream` only re-armed intro timer if **already** veiled | Never **mounted** veil when Matched paint missed |
| BM1 mid-match at ~10–15s | Even a working **intro** peels after ~2.8s of frames — so clear video at 10s is expected *if* show/hide ran; the proven bug was **zero** `[blur] show` |

## Fix (minimal, single writer)

### 1. Single apply path + show log
`applyMatchBlurVeil(why)` remains the only auto-veil writer; always:
```
console.log(`[blur] show why=${why} mode=${mode}`)
```
whys: `match` | `match_keep` | `remote_stream` | `remote_ready` | `heal_matched` | `prefs_load` | `settings_focus`

### 2. `blurWantAutoRef` + match gen / peel gen
- `blurWantAutoRef` — Matched/prefs arm intro|hold stranger intent; **cleared on any peel**
- `matchBlurGenRef` — bumped on each `!keepPrimary` match
- `blurPeelGenRef` — stamped on peel so keepPrimary does **not** re-veil after intro_auto / eye / prefs_off

### 3. Matched handler
- **`!keepPrimary`:** bump gen → arm want → `applyMatchBlurVeil("match")` or clear veil for off/friend
- **`keepPrimary` + wantBlur:** if peeled this gen → leave clear; else arm want and `applyMatchBlurVeil("match_keep")` if not already veiled

### 4. Remote stream ready (belt)
Primary `onRemoteStream` when matched + `blurWantAutoRef` + not veiled:
```
applyMatchBlurVeilRef.current("remote_stream")
```

### 5. React ensure (remote live)
- Idle/error → matched heal: arm want + `applyMatchBlurVeil("heal_matched")` for intro|hold strangers
- Already matched + remoteLive + want armed + not veiled: `applyMatchBlurVeil("remote_ready")`

## Files
| Path | Change |
|------|--------|
| `/home/drakosik/freenet-roulette/mobile/app/live.tsx` | blur/match apply paths only (no LiveStageVideo / MediaSession / ui/*) |

## Not done / soft rules
- No APK build (prefer verify-in-source; human smoke later)
- No invent multi PASS / human PASS
- No LiveStageVideo z-order (BM2-veil-zorder sibling)
- Intro peel timing (A3) may coexist in same file from sibling job — not claimed here
- Device re-smoke not run this hop (no adb exclusive)

## Verify hints (human / next hop)
1. Settings → Blur strangers → **Intro** or **Hold**
2. Play ↔ PC stranger match
3. logcat: expect `[blur] show why=match` and/or `why=remote_stream` / `remote_ready`
4. Hold: veil stays until Show video; Intro: veil then `[blur] hide why=intro_auto` (~2.8s after frames)
5. After peel, thrash rematch must **not** instantly re-veil (peel gen)

## Merge advice
- Safe with BM2-veil-zorder (different OWN file)
- If conflict on `live.tsx` intro-timer constants, keep both: gen/want refs **and** intro max-wait peels
- Smoke on device APK after bump before GOAL_MET

## Job complete
Card → `tasks/grok-loop/done/BM2-blur-match-apply-fix.md`  
RESULT → `tasks/grok-loop/done/BM2-blur-match-apply-fix-RESULT.md`
