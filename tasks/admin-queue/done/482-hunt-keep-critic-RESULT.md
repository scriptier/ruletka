# Second critic: 3-way hunt keep (no MediaSession) — RESULT

Status: DONE (read-only critic)

Herd: `artifacts/herd/20260814T030939Z` (main tree `/home/drakosik/freenet-roulette`, lanes hunt-wiki/hunt-web/hunt-css/hunt-android, all self-reported `GOAL_MET=yes`). All product files live in the main tree (not this worktree) — checked there, read-only.

## 1. live.js: hunt 1-peer does not show weak-reconnect recover tear
**Confirmed clean.** `isHuntOnePeer()` (`ui/live.js:14333`) = `trioBrowse && peerPcs.size < 2`. `canShowReconnectingMediaUx()` (`ui/live.js:14342`) returns `false` immediately when `isHuntOnePeer()` is true — gates all three call sites (`:10927`, `:11078`, `:11408`) away from the "Connection weak — reconnecting…" strip/rebuild copy. The `oniceconnectionstatechange` `"disconnected"` handler (`:10916-10925`) short-circuits even earlier for hunt: `if (isHuntOnePeer()) { scheduleSoftKeepPartnerPaint(); return; }` — no reconnect banner, no soft-recover call, just re-paints the existing partner stream (`softKeepPartnerPaint`, `:13145`). No tear.

## 2. live.tsx: party_browse same-peer skipEarly / keepPrimary
**Confirmed clean.** `mobile/app/live.tsx:2273-2289`: `huntOrBrowse` = `huntingWithPartnerRef.current || peer.mode === "party_browse" || matchModeRef.current === "party_browse"`. When `huntOrBrowse && extras.length === 0 && prevPrimary === peer.peerId && prevPrimary !== "legacy"`, it forces `keepPrimary = true; skipEarly = true;` (log: `"hunt keep same peer (no rebuild)"`) — this fires even when `hasLiveRemoteEarly` is false (i.e. a video blip), which is exactly the case the earlier `keepPrimary`/`skipEarly` logic (lines 2244-2264) would otherwise rebuild on. The `if (!skipEarly && !promoteSecondary)` gate at `:2290` is what wraps the `startCall EARLY` block, so `skipEarly=true` correctly skips the rebuild.

## 3. live-stage.css: remote-empty not covering partner in trio-searching
**Confirmed clean.** New "FINAL LOCK — PC find-3rd hunt (stage-trio-searching)" block at `ui/live-stage.css:20846` + the later "hunt-css pin" block at `:21022-21064` both force `#tile-remote #remote { display:block!important; opacity:1; visibility:visible }` and hide `#remote-empty` (`display:none!important; visibility:hidden; opacity:0; z-index:-1`) under `.stage-trio` / `.stage-trio-searching` / `html.match-live`. Comment explicitly states intent: "PC partner column must not go black … #remote-empty never covers partner … Beats `.tile-remote:not(.has-remote-feed) #remote-empty:not(.hidden)`." The "Looking for a 3rd" brand is scoped to `#tile-third`/`#third-empty` only, and a dedicated rule (`:20940-20948`) hides `#third-empty` inside `#tile-remote`/`#tile-local` so it can't paint over the partner column.

## 4. live.html pin bumped if live.js changed
**Confirmed clean.** `ui/live.html` diff bumps both: `live.js?v=552 → v=575` (preload + script tag) and `live-stage.css?v=380 → v=404` (matches hunt-web's own report "live.js 575 stage 404" and hunt-css's CSS-only change). Consistent, no stale pin.

## 5. No MULTI_PASS invent, no pool>0
**Confirmed clean.**
- All four lane REPORT blocks in `artifacts/herd/20260814T030939Z/lanes/*.md` say `GOAL_MET=yes` for their own scoped DONE WHEN (code/CSS/wiki changes), never claim device/human multi PASS.
- hunt-wiki's own output (`knowledge/wiki/log.md` +499 lines, new `knowledge/raw/2026-08-14-multi3-hunt-crash.md`, and pre-existing `knowledge/wiki/multi-party.md` — unchanged in this diff, already carries this residual) is a **FAIL** capture: "FAIL · NO MULTI_PASS — find-3rd hunt lost first partner; phone left match," explicitly "Not claimed: MULTI_PASS · human multi GOAL_MET · product.ok for 3-way … Hunt keep / softKeep / Connection-weak recover **fixed**." Every `MULTI_PASS` occurrence across the diff is a "no invent / ≠" disclaimer, never an assertion of pass.
- `grep -in "pool"` across the four changed files: only `pool=0` (pure-relay-never-primes, pre-existing/unrelated TURN-priming comments in `live.js`/`live.tsx`), never `pool>0` or a pool value being raised.
- No MediaSession.ts edits (hunt-android/hunt-web DO NOT); `live.tsx` only *uses* the existing `MediaSession` class (adds a `media3Ref`), doesn't touch `mobile/src/media/MediaSession.ts`. No ICE/TURN policy changes, no deploy, no APK.

## Files touched
None (read-only critic). This RESULT file only.

## Verify commands run
- `cat /home/drakosik/freenet-roulette/artifacts/herd/20260814T030939Z/run.json` + `lanes/*.md` (goal, OWN, DONE WHEN, REPORT for all 4 lanes)
- `git -C /home/drakosik/freenet-roulette status --short` / `diff --stat -- ui/live.js ui/live.html ui/live-stage.css mobile/app/live.tsx`
- `git diff -- ui/live.js` around `isHuntOnePeer`/`canShowReconnectingMediaUx` call sites (`:10916-10940`, `:11060-11090`, `:11395-11424`, `:14332-14349`)
- `git diff -- mobile/app/live.tsx` around `huntOrBrowse`/`keepPrimary`/`skipEarly` (`:2240-2305`)
- `grep -n "trio-searching\|remote-empty" ui/live-stage.css` + read `:20895-20965`, `:21015-21065`
- `git diff -- ui/live.html | grep -i "live.js\|live-stage.css"` → pin bump confirmed
- `git diff -- ui/live.js ui/live-stage.css mobile/app/live.tsx ui/live.html \| grep -in "pool\|MULTI_PASS"`
- Read `knowledge/raw/2026-08-14-multi3-hunt-crash.md`, `git diff -- knowledge/wiki/log.md`, `grep -n "hunt crash\|S1" knowledge/wiki/multi-party.md`

## Connect risk
none — read-only; no product files edited by this critic.

COMPLETE
