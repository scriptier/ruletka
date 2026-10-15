# W5 mobile hunt tile a11y — RESULT

## Status
**COMPLETE**

## OWN
- `mobile/app/live.tsx` only (a11y labels for multi/hunt surfaces)
- No APK

## Goal
lookingForThird / hunting panes + multi peer strip have accessibilityLabel where missing.

## What changed

### 1. Multi peer strip (matched + extras)
Previously unlabeled `Pressable` chips for focus swap:

| Surface | a11y |
|---------|------|
| Strip container | `accessibilityRole="summary"` + `mobile.live.partyOf` |
| Partner chip | `button` · `selected: !focusExtra` · `{name} · focus` when selected |
| Extra peer chips | `button` · `selected: focusExtra` · `{name} · focus` when selected |

- Child `Text` uses `importantForAccessibility="no"` so TalkBack/VoiceOver does not double-speak.
- Reuses existing keys only: `mobile.live.partyOf`, `mobile.live.focus`, `mobile.live.peer2`.

### 2. Hunt looking label wire (labels.lookingForThird)
Stage looking pane (in `LiveStageVideo`, `testID="live-looking-for-third"`) already had `accessibilityLabel={lookingLabel}` from this prop — but `t("trio.slotEmpty")` returns the **raw key** when overlay misses `trio.*` (packs have keys; mobile `t()` uses overlay only).

Miss-guard now:

1. `trio.slotEmpty` if resolved ≠ key  
2. `trio.searching` if resolved ≠ key  
3. `mobile.toast.findThirdAccepted` (overlay-backed)  
4. Hardcode `"Looking for a 3rd…"`

So hunt caption **and** its a11y label never announce `"trio.slotEmpty"`.

## Already OK (no edit outside OWN)
- `LiveStageVideo` hunt half: `accessibilityRole="text"` + `accessibilityLabel={lookingLabel}` + `testID="live-looking-for-third"`
- Multi split tiles: already labeled with name · focus
- `LiveMoreSheet` find-3rd / browse rows: already labeled via row helper

## Files
- `/home/drakosik/freenet-roulette/mobile/app/live.tsx`

## Verify

| # | Check | Result |
|---|--------|--------|
| 1 | Peer strip Pressables have accessibilityLabel | PASS (static) |
| 2 | Party strip summary labeled | PASS |
| 3 | lookingForThird miss-guard rejects raw keys | PASS |
| 4 | Fallback uses overlay key or EN hardcode | PASS |
| 5 | No APK / no MediaSession / no deploy | Confirmed |

## Connect risk
**None** — a11y props + string pick for looking label only. No WebRTC / ICE / MediaSession / mount path changes.

## Out of scope
- APK / AAB
- Overlay i18n key adds for `trio.*` (see backlog `W6-i18n-hunt-keys-audit`)
- `LiveStageVideo.tsx` / friends / settings / `_layout` find-third banner
- MediaSession thrash

## COMPLETE
