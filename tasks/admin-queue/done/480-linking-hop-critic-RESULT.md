# 480 — Second critic: linking hop10/11 + iOS audio coexistence — RESULT

## Status
COMPLETE

## Scope note
Read-only critic + tests only. This is an independent re-verification (not a
copy of any prior write-up), done directly against source in both trees. As
of this run, my worktree (`/home/drakosik/freenet-roulette-claude`) is
byte-identical to the main tree (`/home/drakosik/freenet-roulette`) for all
files touched by checks 1–4 (`ui/webrtc.js`, `ui/live.js`,
`mobile/src/media/MediaSession.ts` — confirmed via `diff`, 0 lines each), so
"worktree after sync" and main tree agree; no residual sync gap to caveat.

Herd run `20260814T021956Z` lanes on disk (`artifacts/herd/20260814T021956Z/
lanes/`): `link-harness` **status=done goal_met=yes** (gotcha-24 SKIP, see
check 5); `link-android-warm` **status=done goal_met=yes** (updated
`2026-08-14T02:27:25Z`, own=`mobile/app/live.tsx`, "preferRelay only when
hide_ip"). `live.tsx` is in my Must-not list, so I did not read its diff —
noting lane status only, since a prior critique pass had it as still
"working"; it has since landed.

## Checks

### 1. `iceCandidatePoolSize` / pool — PASS, still 0
- `ui/webrtc.js:17` `const ICE_CANDIDATE_POOL_SIZE = 0;` — comment: "LOCK
  2026-08-10: ALWAYS 0. Pool≥2 caused ALLOCATE storms + 437
  mismatched-allocation + peer_usage≈0."
- `ui/webrtc.js:19` `const ICE_RELAY_POOL_SIZE = 0;`
- `ui/webrtc.js:27` `DEFAULT_ICE.iceCandidatePoolSize = ICE_CANDIDATE_POOL_SIZE`.
- `mobile/src/media/MediaSession.ts:1745` `const iceCandidatePoolSize = 0;`
  (hardcoded literal, not derived from a variable that could drift).
- Repo-wide grep for `iceCandidatePoolSize` assignment finds no positive
  literal anywhere in `ui/` or `mobile/src/media/`.
- Unit test `mobile/src/media/mediasessionMultiSafety.test.mjs` asserts both
  `/const iceCandidatePoolSize\s*=\s*0/` present and
  `/iceCandidatePoolSize\s*=\s*[1-9]/` absent — ran green (below).

### 2. `relayWaitBudgetMs` 480 pure / 300 hybrid — PASS, confirmed, do not cut
- `ui/webrtc.js:314–322`, function `relayWaitBudgetMs()`:
  `if (hideIpRelayOnlyEnabled() || sessionForceRelayEnabled()) return 480;`
  ... `return 300;` for the hybrid/default path.
- Comment trail at L317 documents the hop history: "Hop3: 1100→850; hop7:
  850→700; hop8: 700→600; hop9: 600→520; hop11: 520→480" and hybrid
  "Hop7 ... 400. Hop8: 350. Hop9: 320. Hop11: 300."
- Per task constraint and per `knowledge/specs/current-linking-speed.md`
  ("Hop 11 ... Floor ... Do not cut `relayWaitBudgetMs` further without a
  new `product.ok` smoke") and `knowledge/raw/2026-08-14-linking-brainstorm.md`
  ("Avoid: Cut `relayWaitBudgetMs` again (already 480)") — I am **not**
  recommending any further cut. No evidence in this critique changes that.

### 3. hop10 `connectBudgetMs` 1100 pure offerer · `inflightGrace` 1100 — PASS, confirmed
- `ui/live.js:27227–27229`:
  ```
  const purePath = !!(msg && msg.force_relay);
  const connectBudgetMs = iOffer ? (purePath ? 1100 : 750) : 1800;
  ```
  Pure offerer = **1100**; hybrid offerer = 750; answerer = 1800.
- `ui/live.js:10347–10351`:
  ```
  const inflightGrace = msg?.force_relay ? 1100 : 400;
  ```
  Pure force_relay grace = **1100**; hybrid = 400.
- Both values match hop10 as specced in `current-linking-speed.md` ("Hop 10
  ... pure offerer `connectBudgetMs` **1100**; force_relay `inflightGrace`
  **1100** (hybrid 400)"). Adjacent comments (L27224, L10347–10348) carry
  stale numeric residue from earlier hops (pre-hop11 wait figures) but the
  live literals are current; comment staleness does not affect behavior.

### 4. iOS `isIosWebKit` omits sampleRate 48000, does not break pool/budgets — PASS
- `ui/webrtc.js:1098` `function isIosWebKit()` — UA-sniffs iPhone/iPad/iPod
  plus iPadOS-as-MacIntel (`navigator.platform === "MacIntel" &&
  navigator.maxTouchPoints > 1`), fails closed on exception.
- `ui/webrtc.js:1356–1357` and `:1385–1386`: both audio-constraint helpers
  gate `c.sampleRate = { ideal: 48000 }` behind `if (!isIosWebKit())`.
  Desktop/Android-web path unchanged; iOS Safari simply omits the field.
- Line-range check: pool logic lives at L13–30 / L505–572 / L700–730; the
  budget functions at L314–322; hop10 lives in `ui/live.js` L27222–27229 and
  L10347–10351. `isIosWebKit()` and its two call sites (L1356, L1385) sit in
  disjoint audio-constraint helpers with no shared state or helper calls
  into the pool/budget code. Verified live on the current file, not assumed.
- `isIosWebKit` / `sampleRate` do not appear in `mobile/src/media/
  MediaSession.ts` (grep: 0 hits) — this is web-client-only, no RN/Android
  interaction.

### 5. pair-smoke gotcha-24 — PASS, landed as SKIP (not hard FAIL)
- Herd lane `link-harness` (`artifacts/herd/20260814T021956Z/lanes/
  link-harness.json`): `status=done`, `goal_met=yes`, goal "pair-smoke: do
  not treat TURN=off wire 0/0 as product FAIL (gotcha 24)", notes "TURN=off
  wire 0/0 is SKIP not FAIL".
- Confirmed on disk in `scripts/pair-smoke.mjs`:
  - Header comment (L4, L28–32, L66) documents gotcha 24: harness has no
    local coturn, default `ROULETTE_TURN=off`, same-IP match still wants
    `force_relay` → client fail-open → wire 0/0 is harness residual.
  - `TURN_OFF` (L74–79) defaults true when `ROULETTE_TURN` is unset/off.
  - `REQUIRE_WIRE` (L80–81): `PAIR_SMOKE_REQUIRE_WIRE=1 || !TURN_OFF` — the
    default `ROULETTE_TURN=off` run does **not** require wire.
  - `gotcha24SkipReason()` (L652–657) builds the SKIP message; call sites
    L842–856 and L957 (`"SKIP overall (gotcha 24 — not product PASS)"`) route
    through skip, not a FAIL exit path, when `!REQUIRE_WIRE`.
  - Under default `ROULETTE_TURN=off`, this is a SKIP, not a hard FAIL —
    matches what the task asked me to confirm. Nothing to flag as regression.

## Unit test run
```
$ cd /home/drakosik/freenet-roulette-claude/mobile && node src/media/mediasessionMultiSafety.test.mjs
mediasessionMultiSafety.test.mjs: ok
```
This file already asserts (a) `iceCandidatePoolSize = 0` hardcoded and never
positive, and (b) Android answer-path pure-relay budget (hop11 android side)
guarded against reintroducing older, larger wait/cap values. Both assertions
the task offered as optional additions already exist — no duplicate added,
file not touched.

## Files touched
None. `git status` in this worktree shows no changes from this task beyond
this RESULT file itself.

## Verify commands run
- `node src/media/mediasessionMultiSafety.test.mjs` (from `mobile/`) — ok.
- `diff` of `MediaSession.ts`, `ui/webrtc.js`, `ui/live.js` between main tree
  and this worktree — all three empty (byte-identical).
- Direct `Read`/`Grep` of `ui/webrtc.js`, `ui/live.js`, `scripts/pair-smoke.mjs`,
  `mobile/src/media/MediaSession.ts` at the cited line ranges.
- Read `artifacts/herd/20260814T021956Z/{run.json,lanes/link-harness.json,
  lanes/link-android-warm.json}` for lane status; read
  `artifacts/av-verify/latest.md` (stamp `20260812T193821Z`, product `ok`,
  max_mto=1498/max_mta=2685) cited by `link-spec`.

## Connect risk
**none** — no code touched, no `MediaSession.ts`/`live.js`/`webrtc.js`/
`live.tsx` edits, no ICE/TURN/pool/budget changes recommended or made. All
five checks PASS as currently on disk; no regression found; no cut to
`relayWaitBudgetMs` recommended.

COMPLETE
