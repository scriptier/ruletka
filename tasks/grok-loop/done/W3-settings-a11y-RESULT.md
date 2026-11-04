# W3-settings-a11y — RESULT

## Status
**COMPLETE**

## OWN
- `mobile/app/settings.tsx` only

## Goal
Settings sections have accessible labels; Modal open-on-PC dismisses on blur.

## What changed

### Section a11y labels
- `Section` card head keeps `accessibilityRole="button"` + `accessibilityState.expanded`.
- `accessibilityLabel` now includes **title · badge · subtitle** (joined) so TalkBack/VoiceOver announces the full section, not only the short title.
- Chevron + head text use `importantForAccessibility="no"` so the single Pressable owns the name (no double-speak).

### Missing control labels (same file)
- **Unblock** row CTA: `accessibilityRole="button"` + label `Unblock. {name|id}`.
- **Clear report history**: added `accessibilityLabel` (had role only).

### Open-on-PC Modal dismiss on blur
- `useFocusEffect` cleanup calls `setPcSheetOpen(false)` when Settings loses focus (back, tab, navigate away).
- Sheet still closes via `OpenOnPcSheet` `onClose` / backdrop / Android back (`onRequestClose` inside sheet component — unchanged OWN).

## Not done (by design)
- No edits to `OpenOnPcSheet.tsx` (outside OWN)
- No i18n key adds
- No APK / version bump

## Checklist

| # | Check | Result |
|---|--------|--------|
| 1 | All 8 Section heads have non-empty accessibilityLabel | OK — title + optional badge/subtitle |
| 2 | expanded state on section toggle | OK — `accessibilityState.expanded` |
| 3 | Unblock / clear-history labeled | OK |
| 4 | Open on PC → leave Settings → Modal closed | OK — focus cleanup |
| 5 | Open on PC → backdrop / close / Android back | OK — existing sheet `onClose` |
| 6 | No APK | Confirmed |

## Files
- `/home/drakosik/freenet-roulette/mobile/app/settings.tsx`

## Verify
- Static review of Section + focus cleanup + unblock/clear labels.
- `npx tsc --noEmit` — **no errors in `settings.tsx`** (pre-existing errors only in `live.tsx`, untouched).

## Connect risk
**none** — Settings UI a11y + Modal visibility state only; no MediaSession / ICE / live stage.

## Handoff smoke (device, human, optional)
1. Enable TalkBack → Settings → each section header announces title (and badge/subtitle when present) + expanded/collapsed.
2. About → Open on PC → sheet open → system Back / leave Settings → next screen not covered by ghost Modal.
3. Blocked list → Unblock button announces with peer name.
