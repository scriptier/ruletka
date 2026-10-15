# 823 — iOS PartnerIdentityDock + LiveSearchLabel

## Status
COMPLETE

## What changed

**`PartnerIdentityDock.tsx`** — the top-strip identity dock (name/★/flag/loc/
praised-by-N) is rendered with a `paddingTop` supplied by `live.tsx`
(`Math.max(insets.top - 10, 0)`), a value tuned for Android's shorter status
bar. On notched/Dynamic-Island iPhones that under-shoots the safe area and
also sits in the band where iOS draws its transient camera/mic-in-use pill
and volume HUD, so the identity text could paint under the notch or get
covered. Since `live.tsx` is out of scope for this task, the dock now reads
`useSafeAreaInsets()` itself and, **iOS only** and **only for
`placement="top"`** (the one real caller), overrides the incoming
`paddingTop` with `Math.max(insets.top, 44) + 6` — a floor at the real top
inset plus a small buffer, layered on top of `props.style` in the style
array so it wins without touching the caller. Android is untouched: the
override is `null` off-iOS, so `live.tsx`'s existing padding still applies
exactly as before.

**`LiveSearchLabel.tsx`** — the "Looking…" title / meta two-liner sits in
`live.tsx`'s overlay, which already pads by `insets.top` for the search
phase, so it wasn't under the notch. It could still land under the same
transient iOS volume/camera HUD band, so it now adds a small **iOS-only**
`marginTop: 10` after `style` in its own root `View` style array. Android
unaffected (`null` off-iOS).

I checked whether the title itself needed a "no wait/online" fix (per the
task Goal wording): `title` is built only from `lookingLabel` + dots +
elapsed-seconds; `waitLine`/`queueInPoolLabel` only ever feed the separate
`meta` line. That separation is already platform-agnostic (same JS on both
OSes, no `Platform.OS` branch existed or was needed here), so no change was
required for that half of the Goal — confirmed by reading the component and
the `mobile.live.looking` / `mobile.live.waitLine` i18n strings, not assumed.

## Files touched
- `mobile/src/live/PartnerIdentityDock.tsx`
- `mobile/src/live/LiveSearchLabel.tsx`

No other files touched. `live.tsx`, `MediaSession.ts`, and `liveStyles.ts`
were **not** edited, per Must-not.

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — no new errors from either touched
  file; only pre-existing errors elsewhere (missing `expo-clipboard` /
  `expo-av` / `react-native-gesture-handler` modules, unrelated `live.tsx`
  lines, etc. — same set with or without this change).
- `node src/live/partnerIdentityDisplay.test.mjs` → OK
- `node src/live/matchPeers.test.mjs` → OK
- `node scripts/verify-match-ux.mjs` → `L0 done: 139 ok, 0 fail`
- No iOS simulator/device in this environment — verified via types + the
  existing static/unit checks above only, not an on-device TestFlight smoke.

## Notes
- `knowledge/specs/current-ios-parity.md` does not exist in this worktree
  (only `knowledge/specs/2026-08-20-ru-reach.md` is present); read it from
  the main tree (`/home/drakosik/freenet-roulette/knowledge/specs/current-ios-parity.md`)
  instead — same content, confirms `Platform.OS` iOS branches are the
  expected shape for this spec's tasks.
- `PartnerIdentityDock` / `LiveSearchLabel` have exactly one real caller
  each in `live.tsx` (both `placement="top"`) — confirmed via grep — so the
  `placement === "top"` guard on the iOS override doesn't leave any other
  call site un-adjusted.

## Connect risk
none — no hub/ICE/MediaSession/live.tsx changes; both edits are
`Platform.OS === "ios"`-gated style tweaks inside the two owned components.
`connectivity-lock` script not run (no offer/ICE/media-session touched).
