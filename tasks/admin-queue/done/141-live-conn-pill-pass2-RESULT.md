# 141 — LiveConnPill pass2 audit — RESULT

## Status
COMPLETE

## Audit summary
Reviewed `mobile/src/live/LiveConnPill.tsx` (component logic/a11y — already fixed
in `079-conn-pill-a11y`, still correct: accessible summary wrapper, retry button
labels/states all intact) and its single call site in `mobile/app/live.tsx`
(~line 4038) that wires the component's props.

**Gap found:** `connectUi.ts` defines the progressive connect-copy contract used
by both the stage and the pill (`connectProgressBand`/`connectProgressLabelKey`,
doc comment: "Progressive connect copy by match age (seconds). 0–2: Linking ·
3–7: Finding path · 8+: Trying relay"). The `LiveStageVideo` call site wires all
three stages (`connectingPeer`/`linkingCameras`, `findingPath`, `tryingRelay` —
line ~3802). The `LiveConnPill` call site wired only the first two:
`stageFindingPathLabel={t("mobile.live.stageFindingPath")}` was passed, but
`stageTryingRelayLabel={undefined}` was hardcoded instead of the matching
`t("mobile.live.stageTryingRelay")` (same key already in active use two dozen
lines above, for `LiveStageVideo`). Effect: `LiveConnPill.linkingLabel()`
(`mobile/src/live/LiveConnPill.tsx:72-80`) can never reach its `elapsedSecs >= 8`
branch, so the pill's text silently stalls on "Finding path…" past 8s instead of
escalating to "Trying relay…" — inconsistent with the stage text shown right next
to it and with the documented progression contract.

**Left alone (out of scope / likely intentional):** `linkTierLabel`, `linkRtt`,
`linkRelay`, `qualityTier`, `turnBadgeLabel` are also hardcoded to empty/zero at
the same call site, disabling the pill's "quality bits" sub-line (RTT/relay/
quality tier). That data is already surfaced elsewhere on the Live screen (the
`meta` line built ~line 4500-4515 shows TURN badge, path relay/direct, and
quality tier), so suppressing the duplicate in the pill reads as a deliberate
declutter choice, not a wiring bug — left untouched per "minimal fix" scope.

## Fix
One-line change, existing key only, no new i18n string:

```
- stageTryingRelayLabel={undefined}
+ stageTryingRelayLabel={t("mobile.live.stageTryingRelay")}
```

`mobile/app/live.tsx` (~line 4056).

## Files touched
- `mobile/app/live.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — no new errors from this change;
  pre-existing unrelated errors only (missing `expo-clipboard`/`expo-keep-awake`/
  `react-native-view-shot` type decls, a `pointerEvents` typing issue on an
  unrelated `Text` at line 4020, and a few others already present before this
  edit — confirmed via `git stash`/`git stash pop` before/after error-count
  comparison).

## Connect risk
none — copy/label wiring only (uses an already-shipped i18n key, already
rendered by the sibling `LiveStageVideo` component). No `conn`/ICE/TURN/retry
logic, no MediaSession changes, no CONNECTIVITY_LOCK-covered code touched.

COMPLETE
