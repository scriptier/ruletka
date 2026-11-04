# W5 Claude worktree harvest note — RESULT

## Status
**COMPLETE** — summarized; **no merge applied**.

## Context
| | |
|--|--|
| Claude tree | `/home/drakosik/freenet-roulette-claude` |
| Branch | `claude/p0-connectivity` @ `349970c` |
| Main | `/home/drakosik/freenet-roulette` `main` @ `a0d195d` |
| Ancestry | Claude HEAD **is ancestor of main** (merge-base `349970c`) |
| Scope | Uncommitted **unit-test** fixes only; do not thrash product |

Claude worktree is heavily dirty (docs, mobile app, UI, APKs, untracked product). This note covers **unit-test paths only**.

---

## 1. Claude unit-test inventory (vs Claude HEAD)

### Modified (tracked on Claude HEAD)
| Path | Diff vs Claude HEAD | Notes |
|------|---------------------|--------|
| `mobile/scripts/test-friend-invite.mjs` | +89 / −6 | Reserved app segments; reject `ruletka://live` etc. as friend codes; `parseAppRouteUrl` + route cases; source export asserts |

### Untracked on Claude (exist on disk; not in Claude HEAD)
Claude HEAD only tracked `test-friend-invite.mjs`. These are untracked there but present as files:

**Runners / scripts**
- `mobile/scripts/test-connect-ui.mjs` — pure connectUi helpers
- `mobile/scripts/test-geo-localize.mjs` — geoLocalize transpile smoke
- `mobile/scripts/test-live-units.mjs` — runner for `src/{live,prefs,media}/*.test.mjs`
- `ui/scripts/test-geo-localize.mjs` — UI-side geo localize smoke

**`*.test.mjs`**
- `mobile/src/identity/formatLocLine.test.mjs` — loc line / hide_ip / peer id loose match
- `mobile/src/live/callMetrics.test.mjs` — timer / star progress
- `mobile/src/live/connectSteps.test.mjs` — queue/media/video steps
- `mobile/src/live/hubLobby.test.mjs` — status/lobby reducers
- `mobile/src/live/matchContinuity.test.mjs` — rematch keep/promote peers
- `mobile/src/live/matchPeers.test.mjs` — normalizePeer geo/stars/trust
- `mobile/src/live/partnerIdentityDisplay.test.mjs` — dock name placeholders
- `mobile/src/live/stageStreams.test.mjs` — stage layout / multi tiles (no hunt model)
- `mobile/src/media/connectUi.test.mjs` — CONNECTIVITY_LOCK auto-retry schedule
- `mobile/src/media/mediasessionMultiSafety.test.mjs` — static MediaSession multi invariants
- `mobile/src/media/offerSdpLooksPureRelay.test.mjs` — pure-relay SDP latch
- `mobile/src/prefs/blurMode.test.mjs` — blur mode normalize
- `mobile/src/stars/giftFxHold.test.mjs` — gift FX hold ms

### Headline fix in the only Claude-modified test
`test-friend-invite.mjs` (emu-smoke regression): app routes (`live`, `friends`, `settings`, …) must **not** parse as friend codes; `ruletka://AB12CD` still works; `?friend=CODE99` still wins; plus `parseAppRouteUrl` cases.

---

## 2. Claude vs main content (byte compare)

**All unit-test paths above: `SAME` (working tree Claude ≡ working tree main).**

There is **no unique unit-test content** left in Claude that main does not already have on disk.

### Main git state for those paths
| Path | Main tracked? | Main working tree |
|------|---------------|-------------------|
| Most `mobile/scripts/test-*.mjs` + `*.test.mjs` listed | Yes (committed) | Matches Claude |
| `mobile/src/live/stageStreams.test.mjs` | Yes | **Dirty** vs main HEAD (+319/−1); content **equals** Claude |
| `mobile/src/media/mediasessionMultiSafety.test.mjs` | **No** (untracked) | On disk, equals Claude; already verified green (`P1-mediasession-test-only-RESULT`) |
| `ui/scripts/test-geo-localize.mjs` | Yes | Matches Claude |

---

## 3. Safe harvest paths vs main conflicts

### Already on main (harvest = noop)
Every unit-test file listed in §1 — content identical. **Do not re-copy.**

### Safe *if* still missing (they are not missing on disk)
Criteria: test-only / runner-only, no product thrash:
- `mobile/src/**/*.test.mjs`
- `mobile/scripts/test-*.mjs`
- `ui/scripts/test-geo-localize.mjs`
- `mobile/scripts/test-live-units.mjs` (aggregator only)

### Not safe / out of harvest scope for this task
- Product sources under Claude dirt: `mobile/app/*`, `MediaSession.ts`, hub, i18n packs, UI live.js, etc.
- Docs, APKs under `ui/download/`, agent scripts, `tasks/`, brand assets
- Anything requiring paired product edit when main already diverged for other reasons

### Main residual (not Claude-unique; for awareness only)
- Uncommitted expansion of `stageStreams.test.mjs` on main (same bytes as Claude)
- Untracked `mediasessionMultiSafety.test.mjs` on main (same bytes; prior P1 recheck green)

---

## 4. Merge decision

| Rule | Outcome |
|------|---------|
| Merge unless one-file safe test-only **with no main conflict** | **No merge** |
| Reason | Zero content delta Claude→main for unit tests; nothing unique to apply |
| Risk if forced copy | None functional, but pure noise / thrash |

**Action taken:** note only. No files copied, no commit, no deploy, no force push.

---

## 5. Suggested follow-ups (not this OWN)
1. On main: `git add mobile/src/media/mediasessionMultiSafety.test.mjs` when ready to track (already green).
2. On main: decide commit vs discard dirty `stageStreams.test.mjs` (+hunt-related coverage already present in working tree).
3. Do **not** bulk-merge Claude worktree product dirt.

## COMPLETE
RESULT written. Harvest of Claude unit-test fixes: **already present on main; no apply.**
