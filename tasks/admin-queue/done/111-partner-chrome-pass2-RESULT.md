# 111 — PartnerChrome accessibility second pass

## Status
COMPLETE

## Audit findings
Only real call site is `mobile/app/live.tsx:3888` and it always passes
`onLongPress` (+ `longPressHint`), so the `Pressable` branch is the one that
matters in production, not the bare `card` fallback.

`Pressable` is an accessible element by default: it collapses its whole
subtree into a single accessibility node and reads out **only** the
`accessibilityLabel` you give it. Before this pass the label was just
`props.name` — so a screen-reader user tapping the partner card heard the
name and the long-press hint, and nothing else. Everything a sighted user
reads on the card (flag/city/country line, ★ stars, trust tier, Friend chip,
"muted" chip) was silently dropped for VoiceOver/TalkBack users. This is the
one real finding: an information-parity bug, not just a labeling nit.

## Fix
Built `a11yLabel` from name + location line (or flag code, or the
locUnknown fallback) + all chip labels except the `timer` chip, and used it
as the Pressable's `accessibilityLabel`. Timer is intentionally excluded so
a focused screen-reader element doesn't get relabeled every second while a
call is live (would generate a lot of focus/label churn for AT users with
zero benefit, since a call timer isn't actionable info).

No changes to the `theyMutedMe` live-region pill (already correct via
`accessibilityLiveRegion="polite"`) or to the non-Pressable fallback branch
(dead in practice — every caller passes `onLongPress`).

## Files touched
- `mobile/src/identity/PartnerChrome.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — no new errors; PartnerChrome.tsx is
  clean. Remaining errors are pre-existing, unrelated (missing
  `expo-clipboard`/`expo-keep-awake` type declarations, `live.tsx` issues
  outside this component).
- No unit tests exist for this component (`find … -iname "*PartnerChrome*test*"`
  returned nothing) — nothing to run there.

## Connect risk
none — pure presentational/a11y label change, no signaling/media/offer code touched.

COMPLETE
