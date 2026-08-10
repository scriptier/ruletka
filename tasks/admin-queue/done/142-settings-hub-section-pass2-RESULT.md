# 142 — Settings hub section pass2 — RESULT

## Status
COMPLETE

## Audit summary
Reviewed the "Hub connection" section of `mobile/app/settings.tsx`
(`t("mobile.settings.hubSection")`, ~lines 1014-1136): the Section header/badge,
the Reconnect/Check-hubs buttons, and the per-hub row list built from
`listCandidateHubs`/`probeHub` (`mobile/src/hubs/directory.ts`). Also checked
`switchHub`/`reconnectHub` in `mobile/src/hub/HubProvider.tsx` for correctness
(no changes needed there — read-only check since that file borders
CONNECTIVITY_LOCK-adjacent signaling code, out of scope for this task).

**Gap found:** each hub row already computes a translated `health` string for
its `accessibilityLabel` (`t("mobile.settings.hubHealthy")` /
`t("mobile.settings.hubDown")` / `t("mobile.common.loading")` for the
still-probing case). But the *visible* status pill re-implemented the same
three-way ternary and used a hardcoded `"…"` literal instead of
`t("mobile.common.loading")` for the probing state — so a screen reader user
and a sighted user got different text for the same state, and the logic was
duplicated for no reason.

## Fix
Minimal, existing-key-only change in `mobile/app/settings.tsx`
(~line 1119-1127): replaced the duplicated ternary + `"…"` literal in the
visible status `<Text>` with the already-computed `health` variable, so the
pill and the accessibility label always agree:

```
- {row.ok === true
-   ? t("mobile.settings.hubHealthy")
-   : row.ok === false
-     ? t("mobile.settings.hubDown")
-     : "…"}
+ {health}
```

No new i18n keys added; no other Hub-section behavior changed.

## Files touched
- `mobile/app/settings.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — only pre-existing, unrelated
  errors (missing type decls for `expo-clipboard` etc., due to `node_modules`
  not being installed in this worktree); confirmed via `git stash`/`git stash
  pop` that the same errors exist before and after this edit, i.e. nothing new
  introduced by this change.
- `grep -n "{health}" mobile/app/settings.tsx` — confirms the edit landed.

## Connect risk
none — copy/text-consistency fix only inside the Settings hub-picker UI. No
CONNECTIVITY_LOCK, MediaSession, offer/ICE/TURN, or `HubProvider` connect/
reconnect logic touched.

COMPLETE
