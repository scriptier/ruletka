# BM1 blur prefs race audit — RESULT

**Status:** COMPLETE · **NO PROVEN PERMANENT RACE**  
**OWN:** `mobile/app/live.tsx` blur block only (read-only)  
**Date:** 2026-08-11  
**Code edit:** none (prefer RESULT; one-line fix only if proven race — not proven)  
**MediaSession:** untouched · **Multi:** no invent PASS · **APK/deploy:** none

## Goal
Trace `blurPrefsReadyRef` vs first Matched veil / `applyMatchBlurVeil` — does Settings **Off** still auto-veil when AsyncStorage load is late?

## Grep map

| Symbol | Sites | Role |
|--------|-------|------|
| `blurPrefsReadyRef` | init `false` ~366; set `true` prefs_load ~1655; set `true` settings_focus ~3736; read match veil ~2851–2859 | Gate “prefs known” |
| `blurModeRef` | init `"intro"` ~365; write prefs_load ~1653; match ~2844; settings_focus ~3734 | Live mode for veil |
| `blurAutoAppliedRef` | match sets; reveal clears; toggle forces `false`; peel gate | Distinguishes auto veil vs eye |
| `applyMatchBlurVeil` | def ~453; **prefs_load** ~1661; **settings_focus** ~3741 | Auto veil for intro/hold only |
| Match path veil | **inline** ~2838–2868 (`why=match` log) | **Not** via `applyMatchBlurVeil("match")` |
| `revealPartnerVideo("prefs_off")` | prefs_load ~1662–1664 | Peel optimistic intro when real mode is off |
| `loadMatchPrefs` | mount effect ~1637; `useFocusEffect` ~3724 | AsyncStorage source |

There is **no** `applyMatchBlurVeil("match")` call site. First Matched veil is **inline** in the `matched` handler.

## Order of operations (mount → match)

```text
1. Mount Live
   blurModeRef = "intro"          // optimistic default (not off)
   blurPrefsReadyRef = false
   blurAutoAppliedRef = false

2. loadMatchPrefs().then  (AsyncStorage — async)
   blurModeRef = normalized mode   // off | intro | hold
   blurPrefsReadyRef = true
   if phase === matched:
     intro|hold → applyMatchBlurVeil("prefs_load")
     off + auto + veiled → revealPartnerVideo("prefs_off")

3. Hub matched (!keepPrimary)
   mode = blurModeRef (or "intro" if garbage)
   effective =
     !prefsReady && mode === "off" ? "intro" : mode
   wantBlur = !friend && (effective === intro|hold)
   setRemoteBlurred / blurAutoAppliedRef = wantBlur
   intro → scheduleIntroUnblur()

4. useFocusEffect (return from Settings)
   re-load prefs → ready=true
   if matched && (intro|hold) → applyMatchBlurVeil("settings_focus")
   // Off: no peel here (by design comment)
```

## Race matrix

| Sequence | wantBlur on Matched | After prefs_load | Permanent Off veil? |
|----------|---------------------|------------------|---------------------|
| Prefs **before** match, mode=off | false (`effective=off`, ready=1) | n/a (already ready) | **No** |
| Prefs **after** match, mode=off | true (optimistic intro; default ref) | `prefs_off` peel if auto+veiled | **No** (transient only) |
| Prefs after match, mode=intro/hold | true | `applyMatchBlurVeil("prefs_load")` (idempotent) | n/a (correct) |
| Friend match | false (gated) | applyMatchBlurVeil early-return | **No** |
| Eye toggle then prefs off | true, auto=false | peel **skipped** (preserve manual) | intentional |

### Why “Off ignored until ready” does not permanently veil

1. **Default is intro, not off.** Until AsyncStorage returns, `blurModeRef` is `"intro"`. Optimistic veil is expected product default, not a stuck-off failure.
2. **Peel path exists.** When late prefs resolve to `off`, mount prefs callback peels only auto-applied veils:
   ```ts
   // ~1658–1665
   if (phaseRef.current === "matched") {
     if (mode === "hold" || mode === "intro") {
       applyMatchBlurVeil("prefs_load");
     } else if (blurAutoAppliedRef.current && remoteBlurredRef.current) {
       revealPartnerVideo("prefs_off");
     }
   }
   ```
3. **`!ready && mode === "off" → intro` is nearly dead.** Mode and ready are written **synchronously back-to-back** in both load sites; nothing sets `mode=off` with `ready=false`. The branch is defensive only. Real optimistic veil is from **default `"intro"`**, not from that ternary.
4. **No re-apply thrash after peel.** `applyMatchBlurVeil` returns immediately when `mode` is not intro/hold; off never re-veils from prefs_load/settings_focus apply paths.

## Verdict on plan A2 claim

| Claim | Verdict |
|-------|---------|
| “Off mode still veils if load late” (permanent) | **Not proven** — late load peels via `prefs_off` |
| Transient optimistic intro before AsyncStorage | **By design** (comment ~2838–2840) |
| One-line fix required | **No** |

## Residual (not A2 race; out of one-line fix scope)

| Item | Notes |
|------|-------|
| `settings_focus` Off mid-call | Returning from Settings with mode=off does **not** peel an existing auto-veil (~3737–3742). Only intro/hold re-apply. If product wants “Settings Off clears auto veil mid-match”, that is a small prefs_focus peel (mirror prefs_load), not a first-match race. |
| `keepPrimary` rematch | Match veil block skipped when `keepPrimary` — prior veil state kept. Not Off-prefs race. |
| One-shot store migrations | `store.ts` BLUR_UX_INTRO_KEY can Off→intro **once** if key missing; `saveMatchPrefs` stamps the key so explicit Settings Off sticks. Separate from live race. |

## Fix
**None.** No proven permanent race of Settings Off still auto-veiling after prefs resolve.

## Not done (by job scope)
- No device smoke / logcat proof of peel timing
- No `live.tsx` edit
- No MediaSession / multi invent PASS
- No APK

## Job complete
RESULT filed → `tasks/grok-loop/done/BM1-blur-prefs-race-audit-RESULT.md`; running card moved to done.
