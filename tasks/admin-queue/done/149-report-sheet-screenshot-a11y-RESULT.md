# 149 — ReportSheet screenshot a11y — RESULT

## Status
COMPLETE

## Audit
`mobile/src/safety/ReportSheet.tsx` renders the captured screenshot preview in
one of three states inside `shotWrap`: capturing (spinner + text), loaded
(`Image`), or unavailable (placeholder text). The two text-based states were
already accessible by default (RN `Text` is an accessibility element and
`shotHint` announces "Capturing screenshot…" / "Screenshot unavailable — you
can still report").

The loaded-screenshot `Image` had no accessibility treatment. RN images are
accessibility elements by default on iOS, so VoiceOver/TalkBack would land on
it and announce a bare, uninformative "Image" — the actual visual content
(the partner's video-stage capture) can't be meaningfully described via alt
text anyway, and its context is already conveyed by the visible `sub` text
above it (`mobile.live.reportSub`: "Partner {name}. A screenshot is attached
when possible.").

## Fix
Marked the screenshot preview `Image` as decorative (`accessible={false}`,
`importantForAccessibility="no"`) so screen readers skip it instead of
announcing an empty "Image", consistent with the `importantForAccessibility="no"`
pattern already used elsewhere in this file for redundant nodes. No new
copy/keys added — reused existing `t()` behavior only.

## Files touched
- `mobile/src/safety/ReportSheet.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — no errors in `ReportSheet.tsx`.

## Connect risk
none — UI-only accessibility attribute on a report-flow screenshot preview,
no changes to media/signaling/connect logic.

COMPLETE
