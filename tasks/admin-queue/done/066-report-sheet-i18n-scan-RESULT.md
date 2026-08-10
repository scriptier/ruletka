# 066 — ReportSheet string audit EN/RU

## Status
COMPLETE — no changes needed.

## Findings
Audited every user-visible string in `mobile/src/safety/ReportSheet.tsx`:

- Title, subtitle, screenshot placeholders, quick-explicit button, reason
  list, underage tip, "also block" note, submit button, and cancel button
  all render via `t(key)`.
- `REPORT_REASONS` entries use `t(r.labelKey) || r.fallback` — the
  English `fallback` strings are only a defensive default if a key is
  missing at runtime, not rendered directly.
- Lines 109/116 (`accessibilityLabel` / quick-explicit text) similarly use
  `t("mobile.live.reportExplicitQuick") || "Report explicit · block · next"`.

Verified all 16 keys referenced by the component exist in both overlay
files with real translations (not stubs):
`mobile.live.reportTitle`, `reportSub`, `reportCapturing`, `reportNoShot`,
`reportExplicitQuick`, `reportReason`, `reportUnderageTip`,
`reasonUnderage`, `reasonExplicit`, `reasonHarassment`, `reasonHate`,
`reasonSpam`, `reasonOther`, `reportAlsoBlock`, `reportSubmit`,
`mobile.common.cancel`.

Since every key resolves in both `en.json` and `ru.json`, the English
`fallback`/`||` literals in the component are unreachable in practice.
No hardcoded EN user strings need wiring.

## Files touched
None (audit only).

## Verify commands run
- `grep -n "\"mobile.live.<key>\":" en.json ru.json` for all 16 keys used
  by `ReportSheet.tsx` — all present in both files.

## Connect risk
none

COMPLETE
