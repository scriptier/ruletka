# RESULT: 050-settings-last-connect-timing

## Status
DONE

## Completion promise
COMPLETE

## Important note — task premise didn't hold in this worktree
The task said `MediaSession.getLastConnectTiming()` and a "CONNECT toast on first frame"
were "already shipped." They are not present anywhere in git history or on this worktree's
`main`. I found the real state: **another agent/process has a large, uncommitted WIP**
sitting directly in the primary checkout (`/home/drakosik/freenet-roulette`, not this
worktree) that rewrites `mobile/src/media/MediaSession.ts` (ICE server normalization,
TURN UDP/TCP ordering, SDP candidate stripping) and adds several new untracked files:
`connectUi.ts`, `connectRetry.ts`, `linkQuality.ts`, `pipPrefs.ts`,
`useAutoConnectRetry.ts`, `useNetworkMediaPolicy.ts`, and `lastConnectStats.ts` (the
last one is exactly this feature's persistence layer, already half-built there).
None of that is committed, so it isn't visible in this isolated worktree, and
`mobile/app/live.tsx` on `main` currently has **broken imports** pointing at those
not-yet-committed files — `main` won't type-check/build as committed today, independent
of anything in this task. This is a pre-existing/parallel-work issue, not something I
introduced or fixed (per the "don't refactor unrelated build noise" rule).

Since I'm barred from touching `MediaSession.ts` and shouldn't duplicate another agent's
in-flight uncommitted work, I implemented the feature **entirely in the UI layer**
(`live.tsx` + one new small helper file), using data `MediaSession` already exposes
today (`connectElapsedMs()` and the existing `onConnectionState` phase strings
`connect_t0 …` / `timing <phase> +<ms>ms` / `remote_video_ok … t=<ms>ms`). No WebRTC
offer/answer/ICE/gather/retry logic was touched.

## What changed
- New `mobile/src/media/lastConnectSummary.ts`: AsyncStorage-backed persistence
  (`saveLastConnectSummary`, `loadLastConnectSummary`) for the last match's
  `{ offerMs, answerMs, iceMs, firstFrameMs }`, plus a pure `formatConnectMs()`
  formatter (`—` / `123ms` / `1.2s`). Mirrors the existing `mobile/src/prefs/store.ts`
  pattern.
- `mobile/app/live.tsx`: added a `connectTimingRef` that resets on `connect_t0` (start
  of a connect attempt), captures `offerMs`/`answerMs` by parsing the existing
  `timing <phase> +<ms>ms` phase strings (`offer_applied`/`offer_sent…`,
  `answer_sent`/`answer_applied`), captures `iceMs` from `media.connectElapsedMs()`
  when the peer connection reaches `connected`, and captures `firstFrameMs` (already
  computed in the existing `remote_video_ok` handler) — then persists the summary via
  `saveLastConnectSummary`. Purely additive parsing of strings `MediaSession` already
  emits; no change to connect logic itself.
- `mobile/app/settings.tsx`: loads the last summary on focus (added to the existing
  `useFocusEffect` alongside blocks/reports/hubs) and renders it as a small block in
  the existing **About** section: "Last connect — offer Xms · answer Xms · ice Xms ·
  video Xms", or "No connect yet" when nothing is stored.
- `mobile/src/i18n/overlay/en.json`: added `mobile.settings.lastConnectTitle`,
  `mobile.settings.lastConnectSummary`, `mobile.settings.lastConnectEmpty`. Did not
  mirror other locales — confirmed in `mobile/src/i18n/index.tsx` (`translate()`) that
  missing overlay keys fall back to the English overlay automatically, so only `en.json`
  is required.

## Files
- mobile/src/media/lastConnectSummary.ts (new)
- mobile/app/live.tsx
- mobile/app/settings.tsx
- mobile/src/i18n/overlay/en.json

## Verify ran
- `node -e "JSON.parse(...)"` on `en.json` — valid JSON.
- Manual full diff review of `live.tsx`/`settings.tsx` changes (see above) — no
  MediaSession/ui/webrtc.js/ui/live.js touched; capture logic is a self-contained
  regex parse of existing phase strings.
- Could **not** run `tsc --noEmit` — this isolated worktree has no `mobile/node_modules`
  installed, and separately `main`'s `live.tsx` already fails to resolve several
  imports (see note above) for reasons unrelated to this change. Both are pre-existing
  environment/repo-state issues, not caused by this task.
- Could not smoke-test in a running app (no device/emulator in this environment;
  Grok/human owns local APK builds per CLAUDE.md).

## Connect risk
hold — not for connect-path risk (nothing here touches offer/answer/ICE), but because
`main`'s `mobile/app/live.tsx` currently has broken imports from the uncommitted WIP
sitting in the primary checkout. This branch should be rebased/merged **after** that
other work lands and `main` type-checks again, and the merge will need care in
`mobile/app/live.tsx` (my `connectTimingRef` additions sit right next to code the other
WIP also touches) and a possible file-name collision with their
`mobile/src/media/lastConnectStats.ts` vs. my `mobile/src/media/lastConnectSummary.ts`
(same purpose, different name/shape — pick one and drop the other rather than keeping
both).

## Handoff for morning
- merge branch: `admin/20260809T063004Z-050-settings-last-connect-timing`
- **First**: get the other in-flight `MediaSession.ts`/`connectUi.ts`/etc. WIP in the
  primary checkout (`/home/drakosik/freenet-roulette`) committed so `main` type-checks
  again — that work already contains a more complete `lastConnectStats.ts` capturing
  offer/answer/ice/firstFrame directly inside `MediaSession`, which is a cleaner source
  of truth than my UI-layer regex parsing once it lands. Recommend: keep whichever
  persistence file is more complete, wire Settings/`live.tsx` display to it, and drop
  the other.
- smoke: open Settings → About after one Play↔PC match and confirm the "Last connect"
  line shows non-placeholder numbers; confirm "No connect yet" shows on a fresh install
  before any match.
- do not: deploy without Play↔PC check; do not merge before `main`'s `live.tsx` imports
  are fixed (currently broken independent of this task).
