# 497 — Android ↔ browser 3-way parity — second critic (read-only)

Status: **DONE (read-only review)** — 4/5 checks pass on disk, 1 gap found (Stop/Next labels still generic).

Spec: `knowledge/specs/2026-08-14-android-browser-parity.md` (read from main tree — not present in this worktree's `knowledge/specs/`; `mobile/src/live/` and `mobile/app/live.tsx` on disk in this worktree are untracked/ahead of git history, reviewed as-is).

## Check 1 — LiveStageVideo: 2 remotes = column top/bottom + PiP you; hunt wraps 1v1 VideoView

**PASS.**

- `mobile/src/live/stageStreams.ts:288-324` `pickStageChromeLayout`: with `remoteStream2` only (`has2=true`, `has3=false`) → `includeLocalTile = has3 = false`, `pipYou = !includeLocalTile = true`, `portraitColumn = wrapFirstPartner && !useGrid2x2 && !(splitWide && !includeLocalTile)` → `true` in portrait. Confirms 2-remote case renders as a top/bottom column with local self in the PiP (not a 4th tile).
- `mobile/src/live/LiveStageVideo.tsx:759-766` comment + tree: "First partner VideoView stays mounted; extra remotes wrap as siblings. Do not remount on 1v1→3-way." The main `VideoView` (line 787-794) is the same node used for 1v1, hunt, and multi (`stream={multiRemote ? remoteStream : displayMainStream}`); `huntingThird` (line 593-598) only changes the *wrapping* container style (`splitHuntTile*`, line 696-706), never unmounts/remounts the partner `VideoView`.

## Check 2 — live.tsx: startCall2/3 on 2nd/3rd peer; no partnerCamHidden on audio-first

**PASS.**

- `mobile/app/live.tsx:2784-2843` `startSecondary()` calls `media2.startCall(...)` (logged `startCall2 kick …`) as soon as a second peer is listed (before identity/geo storm per comment at 2779-2781); same pattern for `startTertiary()` at `2844-2902` (`startCall3 kick …`).
- `mobile/app/live.tsx:1204-1218`: `hasLiveRemoteMedia(s)` (any audio or video) ends "Linking" UI unconditionally, but `setPartnerCamHidden(false)` only fires inside `if (remoteVideoHasPicture(s))` — i.e. cam-hidden is cleared on real picture, never *set* true from audio-first. Comment at 1207-1208 states the invariant explicitly: "partnerCamHidden / partnerNoCam stay TRUE only from advertised no_cam / self_hide / cam_hide DC — never first audio-only stream." Grep of all `partnerCamHiddenRef.current = …` assignments (live.tsx:1215,1720,2224,3300,3778,3935,4164,4708,4965,5093) shows every `true` assignment is driven by an explicit hide-control signal (`on`/`hideCtrl` from DC), every bare `false` is a reset; none is a fallback from missing video tracks.

## Check 3 — Stop/Next: Leave 3rd / Leave call when extras live

**GAP — still generic**, not "or note if still generic" per task's own escape hatch.

- `mobile/src/i18n/packs/en.json:74-78` already ships the copy: `btn.stopLeaveCall` = "Leave call", `btn.stopLeaveThird` = "Leave 3rd" (also present in `mobile/src/i18n/overlay/en.json:8-10`).
- But `mobile/app/live.tsx` never references either key — `grep -n "stopLeaveCall\|stopLeaveThird"` over `mobile/app/live.tsx` returns nothing. Both `LiveBottomBar` label blocks (`live.tsx:7481` and `:7050`) hardcode `stop: t("btn.stop")`, and `next: t("btn.next")` (`:7474`) has no "skip 3rd" variant at all — no i18n key like that exists yet either.
- `mobile/src/live/LiveBottomBar.tsx:31-102` (`LiveBottomBarProps`) has no `extraPeerCount` prop and no conditional stop/next label — `onStop`/`onNext` are wired to a single fixed `labels.stop` / `labels.next` string regardless of party size.
- Net: DONE-WHEN item D (pair+3rd → "Leave 3rd" / you-are-3rd → "Leave call" / 1v1 → generic) is **not implemented**. Copy exists, wiring doesn't.

## Check 4 — 2×2 only when stream3 + extraPeerCount>=2

**PASS.**

- `mobile/src/live/stageStreams.ts:253-265` `canShowGrid2x2`: `!!(opts.remoteStream3 && Math.floor(Number(opts.extraPeerCount)||0) >= 2)` — exact match to spec wording. `pickStageChromeLayout` (line 305-309) derives `showGrid2x2Toggle`/`useGrid2x2` from this helper only; 1v1 and 3-way (`has3=false` or `extra<2`) never see the toggle.

## Check 5 — pool=0 in MediaSession; no force_relay policy edit this hop

**PASS** (current disk state; could not isolate a "this hop" diff since `mobile/src/media/MediaSession.ts` isn't at a comparable git baseline in this worktree — see note below).

- `mobile/src/media/MediaSession.ts:1767` `const iceCandidatePoolSize = 0;` (hardcoded, comment at 1757 references the 2026-08-10 pool≥2 ALLOCATE-storm regression).
- `mobile/src/media/MediaSession.ts:1759-1762` `pureRelay` gating unchanged from the hybrid contract: `hasTurn && (this.hideIp || this.forceRelayOnce || this.hubForceRelaySticky)` — i.e. relay-only is conditional (hide-IP or explicit force-relay signal), not an always-on policy flip. No edits to this function were made as part of this review.
- Note: `mobile/src/media/MediaSession.ts` differs substantially from the tracked `HEAD` blob in this worktree (large untracked delta, likely synced from Grok's main tree ahead of this branch's git history), so a byte-exact "no edit this hop" diff isn't verifiable from git alone in this worktree; judged by content only (no always-on relay found).

## No product file edits
Read-only review — no files touched.

## Verify commands run
None executed (no `node …test.mjs` / `npm run verify` listed as blocking for the critic role in this task; reviewed via `Read`/`Grep` against source only). If a code-verify pass is wanted, `mobile/src/live/stageStreams.test.mjs` covers `canShowGrid2x2`/`pickStageChromeLayout` (Check 1/4) but not the Stop/Next label gap (Check 3), since no test exists for the missing wiring.

## Connect risk
none — no code changed.

## Files touched
None.

COMPLETE
