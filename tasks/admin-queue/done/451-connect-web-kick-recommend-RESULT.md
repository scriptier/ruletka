# RESULT: 451-connect-web-kick-recommend

## Status
DONE

## Completion promise
COMPLETE

## Plan
- Read baseline: `docs/CONNECTIVITY_LOCK.md` (frozen product decisions, server rules,
  client rules, speed targets), `knowledge/wiki/linking-speed.md` (hop9/hop10 residual
  journal — max mto **1264ms** vs target **&lt;800ms** warm; hop10 already shipped:
  pure offerer `connectBudget 1100`, `inflightGrace 1100`/400, offerer GUM async
  SDP-first).
- Trace web match→offer path in `ui/live.js`: `handleMatched` (:25398-25562),
  solo1v1 `kickSoloWebRtc` fast path (:25562-25760), `kickSoloWebRtc` itself
  (:26685-27258, GUM/connect-budget/mutex), `armOfferKickWatch` re-kick/re-emit
  watchdog (:10281-10446), paint-first frame watcher (:14240-14456).
- Trace offer/ICE emit in `ui/webrtc.js`: `connect()` (:1997-2175), `warmIcePool`
  (:684-813), `_createAndSendOffer` (:2745-2950), relay-wait gating
  (`shouldWaitForFirstRelay` :296-311, `relayWaitBudgetMs` :314-321,
  `waitForIceGatherRelayOrDone` :435-480), `applyIceDirectPreference` (:508-571).
- Rank by (impact on match→first-offer / paint-first feel) × (risk / CONNECTIVITY_LOCK
  exposure), cite file:line, no code edits to `ui/live.js`/`ui/webrtc.js` beyond what's
  explicitly allowed (1-line dead code) — found none, so purely read-only.
- Append findings to `knowledge/wiki/linking-speed.md` ("Recommended hop10 web"
  section) and this RESULT.

## Worktree note (knowledge/ path)
This worktree (`claude/p0-connectivity` branch) does not have `knowledge/` in its git
tree at all (`git ls-tree -r claude/p0-connectivity | grep knowledge` → 0 files; `main`
has 56). The shared `knowledge/wiki/linking-speed.md` the task pointed at lives in the
primary checkout (`/home/drakosik/freenet-roulette`) as a tracked-but-uncommitted
("M") live journal, actively edited by concurrent sessions (dated 2026-08-12 entries
from other agents were present on read). To avoid clobbering that shared,
concurrently-edited file — and per the sibling `450-connect-android-answer-recommend`
task's own correction note about accidentally writing into the primary checkout —
I copied the current primary-checkout content into this worktree
(`knowledge/wiki/linking-speed.md`, new file in this worktree) and appended the
"Recommended hop10 web" section only there. The primary checkout's copy was not
touched. Reconcile/merge when this branch lands.

## Top 5 ranked recommendations
(Full detail with fix sketches and DONE WHEN criteria in
`knowledge/wiki/linking-speed.md` § "Recommended hop10 web"; summary below.)

1. **HIGH impact / MEDIUM-HIGH risk** — `shouldWaitForFirstRelay()`
   (`ui/webrtc.js:296-311`) treats every match with a `turn:` URL in config as
   needing a relay candidate before the offer emits, not just pure `force_relay`.
   The hybrid (`force_relay=false`, `policy=all`) path pays up to **~620ms**
   (two sequential `waitForIceGatherRelayOrDone` waits, `:2818-2853`, budgets
   320ms + 300ms via `relayWaitBudgetMs()` `:314-321`) directly on match→offer,
   for a candidate type `docs/CONNECTIVITY_LOCK.md` says normal matches don't need
   ("ICE may use host"). The 2026-08-10 same-LAN hairpin incident this wait guards
   against is now caught server-side via hub `pair_force_relay` (same public IP →
   `force_relay=true`). Needs product.ok + phone+PC smoke gate before any cut.

2. **MEDIUM-HIGH impact / MEDIUM risk** — `warmIcePool()`'s hybrid branch
   (`ui/webrtc.js:788-793`) only builds an empty PC object during queue wait; the
   pure/relay branch (`:744-787`) does a real prime (createOffer+setLocal+wait-for-
   relay+rollback). Without a hybrid prime, finding #1's wait can never be a cheap
   no-op — it's always a cold TURN ALLOCATE inline with the offer. Mirroring the
   pure-branch prime for `policy=all` (still `pool=0`, no lock violation) would make
   the wait near-instant if kept at all. Rides the same smoke gate as #1.

3. **LOW wire-speed impact / pure feel, LOW risk** — `handleMatched`
   (`ui/live.js:25398-25562`) does real synchronous work before the async
   `kick()` call but never paints "Linking cameras…" itself; the first visible
   status change comes from a later `onConnectionState`/frames callback
   (`:10772-10849`). Adding one `setConnStrip("warn", linkingCamerasLabel())` call
   near the top of `handleMatched` is UI-only, no offer/ICE logic touched, no
   product.ok gate needed.

4. **LOW impact, LOW risk, rides with #1** — the two sequential
   `waitForIceGatherRelayOrDone` calls (`ui/webrtc.js:2837-2853`) have no new
   signal source between them; collapsing to one call with the combined budget is
   latency-neutral but removes a redundant listener add/remove cycle. Bundle with
   #1's PR rather than shipping standalone.

5. **MINIMAL impact, LOW risk** — `kickSoloWebRtc`'s connect-budget race
   (`ui/live.js:27226-27241`) polls `pc._offerEmitOk` every 40ms instead of
   resolving on emit. The offer itself is already sent synchronously inside
   `pc.connect()` (`ui/webrtc.js:2923`), so this is not on the wire path — it only
   delays mutex release / `offerKick` retry responsiveness by up to 40ms. Lowest
   priority; event-driven signal instead of poll would be latency-neutral-or-better.

## Files
- `knowledge/wiki/linking-speed.md` — new file in this worktree (copied from primary
  checkout's current content, then appended "Recommended hop10 web" section + one log
  line). Primary checkout's own copy untouched.
- `tasks/admin-queue/done/451-connect-web-kick-recommend-RESULT.md` (this file)
- No changes to `ui/live.js` or `ui/webrtc.js` (read-only per task OWN scope; no
  qualifying 1-line dead code found)

## Verify ran
- Read-only: `Read`/`Grep` over `ui/live.js`, `ui/webrtc.js`, `docs/CONNECTIVITY_LOCK.md`,
  `knowledge/wiki/linking-speed.md`. No build/test run — no code changed.
- Cross-checked line-number citations against the current file contents (not from
  memory) before writing them into the wiki section and this RESULT.

## Connect risk
**none** for this diff itself — docs/wiki + RESULT only, no code changed. Findings
#1 and #2 explicitly require a `docs/CONNECTIVITY_LOCK.md`-mandated product.ok +
phone+PC smoke gate before implementation (they touch offer/ICE relay-wait timing);
#3–#5 are lower-risk (#3 UI-only, #4/#5 latency-neutral refactors) but should still
get at least a light smoke before merge, per house style.

## Handoff for morning
- This branch (`claude/p0-connectivity`, this worktree): docs-only diff, safe to
  merge/harvest as-is.
- Do not implement #1/#2 without the CONNECTIVITY_LOCK smoke gate (same-LAN/hairpin
  regression risk is exactly why the hybrid wait exists today — re-prove before
  cutting it).
- #3 (paint-first status) is the one item safe to implement directly without a speed
  gate if a follow-up task wants to just ship it.
- Reconcile this worktree's new `knowledge/wiki/linking-speed.md` with the primary
  checkout's live copy when merging (primary checkout likely has newer entries from
  concurrent sessions by the time this lands).

COMPLETE
