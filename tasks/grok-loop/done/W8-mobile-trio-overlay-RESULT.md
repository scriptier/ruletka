# W8 mobile trio.* overlay keys — RESULT

## Status
**COMPLETE**

## Goal
Android hunt caption must not paint raw `trio.slotEmpty` — `t()` must resolve.

## OWN
- Mobile i18n loader / overlay (where `t()` actually reads)
- Add `trio.slotEmpty` + `trio.searching` to the surface that loads
- Prefer minimal: overlay EN + miss-guard if cheap
- No APK / adb / MediaSession / full 14-locale thrash / deploy

## Root cause
`mobile/src/i18n/index.tsx` `translate()` is **overlay-only**:

```ts
overlay[key] ?? enOverlay[key] ?? key
```

Full packs under `mobile/src/i18n/packs/*.json` already had both keys, but they are **not loaded at runtime** (size/OOM). Overlay files had **zero** `trio.*` keys → `t("trio.slotEmpty")` returned the literal key → truthy raw string won over the hardcode in `labels.lookingForThird`.

(W6 audit documented this; prior P1 overlay write was not present on disk.)

## What changed

### 1. Overlay EN (runtime surface for `t()`)
**File:** `/home/drakosik/freenet-roulette/mobile/src/i18n/overlay/en.json`

| Key | Value |
|-----|--------|
| `trio.slotEmpty` | `Looking for a 3rd…` |
| `trio.searching` | `Looking for a 3rd together…` |

Copied from canonical pack EN. Non-EN langs fall through to `enOverlay` via existing `translate()` chain — caption is English, never raw key.

### 2. Miss-guard (cheap belt)
**File:** `/home/drakosik/freenet-roulette/mobile/app/live.tsx` (~5740)

`labels.lookingForThird` now rejects when `t(k) === k`:

1. `t("trio.slotEmpty")` if resolved ≠ key  
2. `t("trio.searching")` if resolved ≠ key  
3. hardcode `"Looking for a 3rd…"`

So even if overlay keys regress, UI never paints `"trio.slotEmpty"`.

## Verify (static / simulated)

| Check | Result |
|-------|--------|
| `overlay/en.json` has both keys | **PASS** |
| Other overlays leave keys absent (minimal) | **PASS** (EN fallback) |
| Simulated EN label | **`Looking for a 3rd…`** |
| Simulated RU (via EN fallback) | **`Looking for a 3rd…`** (not raw key) |
| Empty overlay + miss-guard | **`Looking for a 3rd…`** |
| Grep `t()` loader | `index.tsx` → `mobile-overlay.ts` → `overlay/*.json` only |
| APK / adb / deploy | **Not done** (constraint) |
| Full 14-locale thrash | **Not done** (constraint; EN-only by design) |

## Files touched
- `/home/drakosik/freenet-roulette/mobile/src/i18n/overlay/en.json`
- `/home/drakosik/freenet-roulette/mobile/app/live.tsx`
- This RESULT

## Out of scope / follow-up
- Per-locale translated `trio.*` in non-EN overlays (optional polish; packs already have translations if a later card wants copy-in)
- APK rebuild / device smoke of find-3rd caption
- PC `ui/i18n` (already had keys; unaffected)

## Connect risk
**None** — two overlay strings + caption pick guard. No MediaSession / ICE / RTC / offer path.

## Completion promise
COMPLETE
