# RESULT: 125-settings-notify-chips

## Status
DONE (audit only — no code changes needed)

## Completion promise
COMPLETE

## What changed
- Audited `mobile/app/settings.tsx` notify-friend-call chips (the "notify
  on/off" toggle in the alerts section, lines ~909-922).
- Both chips use the shared `Chip` component (`mobile/app/settings.tsx:92`),
  which already implements full a11y for selected state:
  - `accessibilityRole="button"`
  - `accessibilityLabel={props.label}`
  - `accessibilityState={{ selected: props.active }}`
  - Inner `Text` is marked `importantForAccessibility="no"` so screen
    readers announce the Pressable's label/state once, not the label twice.
- No inline/duplicate chip markup exists in the notify section — it calls
  the shared component directly, same as every other Chip usage in the
  file (uiSounds, langChips, etc).
- No defects found; no diff required.

## Files
- None touched. Read-only audit of `mobile/app/settings.tsx`.

## Verify ran
- Manual read of `Chip` definition (`mobile/app/settings.tsx:92-116`) and
  the notify-section call sites (`mobile/app/settings.tsx:909-922`) to
  confirm `accessibilityState={{ selected: ... }}` is wired for both the
  "on" and "off" chip.
- Grepped the file for all `Chip` usages to confirm the notify chips are
  not a special-cased/inline variant bypassing the shared component.

## Connect risk
none — audit only, no code touched, no connectivity/offer/ICE logic
involved.
