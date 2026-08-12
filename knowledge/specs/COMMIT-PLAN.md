# Commit plan — freenet-roulette session WIP

**Date:** 2026-08-11  
**Branch:** `main`  
**Remote:** `origin/main` (`git@github.com:scriptier/ruletka.git`)  
**Policy this pass:** local commits only if cleanly groupable; **do not push**.

---

## Snapshot (read-only)

| Metric | Value |
|--------|--------|
| Ahead of `origin/main` | **2** (already committed) |
| Behind `origin/main` | **0** |
| Modified (tracked) | **71** files · **+15 645 / −3 808** |
| Untracked (porcelain) | **~155** paths |
| Staged | **none** |
| Working tree | **huge + mixed** — product live/media/i18n cross-cut |

### Already on `main` (not re-committed)

```
538cfa1 fix(connect): answerer must not addTrack before setRemote — restore same-LAN A/V
404ac44 fix(connect): never force_relay on same public IP — restore LAN A/V
```

### Dirty summary by area (tracked diffs)

| Area | Files (approx) | Lines | Notes |
|------|----------------|-------|--------|
| mobile live + MediaSession | 10 | +5k / −1k | `live.tsx`, `MediaSession.ts`, matchPeers, stage |
| i18n overlay + ui i18n | 14+ | +2.7k | bulk overlay fill; en.json small |
| web UI | 15 | +2.7k | `live.js`, `webrtc.js`, brand CSS |
| friends + linking | 3 | +0.7k | `friends.tsx`, invite path |
| identity | 3 | +0.6k | PartnerChrome, flagTrust, loc tests |
| gifts | 2 | +0.8k | GiftFxOverlay, LiveGiftBar |
| brand UI | 4 | +0.8k | live-brand, stage, watermark pieces |
| bridge | 1 | +0.2k | `simple.rs` geo/alias helpers |
| docs + AGENTS | 7 | +0.3k | locks, MOBILE_BUILD, agentic rewrite |
| scripts/deploy | 6 | +0.4k | coturn, turn setup, dispatch |

Untracked bulk: `.grok/**` skills+plugin, `knowledge/**`, agentic scripts, mobile brand/live components+tests, `tasks/admin-queue/done/*`, docs agentic plans.

---

## Decision this pass

| Action | Status |
|--------|--------|
| Write this plan | **done** |
| Local commits of product WIP (groups 2–4) | **deferred** — `live.tsx` / `MediaSession.ts` / i18n entangle friends, identity, gifts, brand, media |
| Local commit group 1 (skills+wiki+agentic) | **optional** — cleanly separable (mostly `??`); only if operator wants |
| Push to `origin` | **no** |

**Why not auto-split product commits:** intermediate states would leave broken imports (new `BrandWatermark` / `PartnerIdentityDock` / gift FX / matchPeers APIs only make sense together with `live.tsx` + overlay keys). Safe product commit = one large “session ship” or careful multi-step with tests after each — not drive-by partial staging.

---

## Proposed groups (4)

Execute in order. After each product commit: `cd mobile && npm test` (and `npm run test:match-ux` if group 3).

### Group 1 — skills + knowledge wiki + agentic tooling

**Theme:** agent environment compounds; no runtime product behavior.

**Include**

- `knowledge/` (README, SCHEMA, wiki/, specs/, logs/, raw/ — including small rail PNGs)
- `.grok/` (skills, hooks, personas, plugins/ruletka-connect)
- `.grok-plugin/marketplace.json`
- `docs/AGENTIC_ENGINEERING.md`, `docs/AGENT_LOOP_DESIGN.md`, `docs/AV_FIX_SUBAGENT_PLAN.md`
- `AGENTS.md` (agentic default-mode rewrite)
- `scripts/agentic-check.sh`, `scripts/agentic-loop.sh`, `scripts/av-loop.sh`, `scripts/av-verify.sh`
- `scripts/agents/dispatch.sh` (if only agentic-related hunks)
- `tasks/admin-queue/done/*` new RESULT/task pairs from this session

**Exclude**

- All `mobile/`, `ui/`, `bridge/`, coturn, product docs locks

**Suggested message**

```
docs(agentic): skills, knowledge wiki, and agent loop tooling

Add Karpathy/agentic skills under .grok, knowledge wiki+specs schema,
agentic-check/av-loop scripts, and AGENTS.md default-mode playbook.
Archive admin-queue done results from the session walk.
```

**Stage sketch**

```bash
git add knowledge/ .grok/ .grok-plugin/ \
  docs/AGENTIC_ENGINEERING.md docs/AGENT_LOOP_DESIGN.md docs/AV_FIX_SUBAGENT_PLAN.md \
  AGENTS.md \
  scripts/agentic-check.sh scripts/agentic-loop.sh scripts/av-loop.sh scripts/av-verify.sh \
  tasks/admin-queue/done/
# review dispatch.sh: only stage if agentic-only
git add -p scripts/agents/dispatch.sh
```

---

### Group 2 — mobile friends + invite + identity surface

**Theme:** friends list/invite UX and partner identity chrome (not full live stage rewrite).

**Include (when splitting carefully)**

- `mobile/app/friends.tsx`
- `mobile/src/linking/FriendInviteHandler.tsx`, `mobile/src/linking/friendInvite.ts`
- `mobile/scripts/test-friend-invite.mjs`
- `mobile/src/identity/PartnerChrome.tsx`, `flagTrust.ts`, `formatLocLine.test.mjs`
- `mobile/src/hub/types.ts` (partner geo / MatchPeer aliases)
- `mobile/app/+native-intent.ts` (if invite deep-link only)
- Related overlay keys only if isolated (hard — see risk)

**Risk:** identity dock/chrome also imported from `live.tsx`; may need Group 3 same day.

**Suggested message**

```
feat(mobile): friends invite flow and partner identity chrome

Harden friend invite linking, expand friends screen, and improve
PartnerChrome / flag trust / loc-line display with unit coverage.
```

---

### Group 3 — live UX: brand + gifts + match stage + media

**Theme:** the big mobile+web live experience hop (brand watermark/loading, gift FX density, swipe skip, identity dock, MediaSession, matchPeers).

**Include**

- `mobile/app/live.tsx`, `mobile/app/index.tsx`, `mobile/app/settings.tsx` (if live-adjacent only)
- `mobile/src/live/**` (all modified + new: Brand*, PartnerIdentityDock, SwipeSkipOverlay, stage, bars, styles, tests)
- `mobile/src/media/MediaSession.ts`, `adaptiveQuality.ts`, `offerSdpLooksPureRelay.test.mjs`
- `mobile/src/stars/GiftFxOverlay.tsx`
- `mobile/src/prefs/store.ts`
- `mobile/src/i18n/overlay/*.json`
- `mobile/assets/brand/loading-screen.mp4` (~3.6M — confirm wanted in git)
- `mobile/scripts/verify-match-ux.mjs`, `verify-before-apk.sh`, `device-smoke.sh`, `push-apk-to-phone.sh`, `build-apk-local.sh`
- `mobile/package.json`, `mobile/app.json`
- `ui/live.js`, `ui/webrtc.js`, `ui/live.html`, `ui/live-brand.css`, `ui/live-stage.css`, `ui/i18n/*`, `ui/deploy.json`
- Product docs: `docs/CONNECTIVITY_LOCK.md`, `CONNECT_MONITOR.md`, `DEVICE_SMOKE.md`, `MOBILE_BUILD.md`, `PLAY_TODAY.md`, `VIDEO_PATH_LOCK.md`

**Suggested message**

```
feat(live): brand stage, gift FX, identity dock, and media path UX

Ship mobile+web live chrome (watermark, loading loop, swipe skip),
trimmed gift fireworks, partner identity dock, matchPeers/MediaSession
hardening, overlay i18n fill, and pre-APK verify scripts.
```

**Note:** Prefer **one** commit here over false precision. Optionally split web (`ui/**`) as 3b if web can land without mobile imports (it can — separate clients).

---

### Group 4 — bridge + TURN ops + pair tooling

**Theme:** server/path ops separate from client chrome.

**Include**

- `bridge/src/simple.rs`
- `scripts/deploy/coturn.conf`, `scripts/deploy/setup-turn.sh`
- `scripts/test-coturn-relay.sh`
- `scripts/phone-web-pair.mjs`
- `scripts/_fill-overlay-i18n-once.py` (one-shot; commit only if reusable, else drop)

**Suggested message**

```
fix(ops): bridge geo aliases and coturn public/public external-ip

Normalize partner_geo camelCase aliases in the bridge; lock coturn
external-ip=PUBLIC/PUBLIC for relay hairpin; refresh turn test scripts.
```

---

## Optional 3b split (if group 3 still too large)

| Sub | Paths |
|-----|--------|
| 3a mobile live+media+i18n overlay | `mobile/**` listed in group 3 |
| 3b web live parity | `ui/**` |
| 3c docs locks only | `docs/CONNECTIVITY_*`, `VIDEO_PATH_LOCK`, `MOBILE_BUILD`, `DEVICE_SMOKE`, `PLAY_TODAY` |

---

## Do not commit / review first

| Path | Reason |
|------|--------|
| `mobile/assets/brand/loading-screen.mp4` | 3.6 MB binary — confirm LFS or intentional |
| Secrets / env | coturn uses `__TURN_SECRET__` placeholders (OK) |
| `.admin-worktrees/` | gitignored — leave out |
| Runtime `tasks/admin-queue/running|failed|reports` | gitignored |
| Unrelated WIP outside this session | re-check before `git add -A` |

---

## Execution checklist (human or next agent)

```bash
# 0) re-read status
git status -sb
git log origin/main..HEAD --oneline

# 1) Group 1 only (safest first local commit)
# ... stage as above ...
git commit -m "$(cat <<'EOF'
docs(agentic): skills, knowledge wiki, and agent loop tooling

Add Karpathy/agentic skills under .grok, knowledge wiki+specs schema,
agentic-check/av-loop scripts, and AGENTS.md default-mode playbook.
Archive admin-queue done results from the session walk.
EOF
)"

# 2–4) product groups only after smoke plan — DO NOT push
# git push   # ← forbidden this task
```

---

## Return status for this task

| Item | Result |
|------|--------|
| Ahead / behind | **ahead 2**, behind 0 |
| Dirty | 71 modified + ~155 untracked; ~+15.6k/−3.8k tracked |
| Commit plan path | `knowledge/specs/COMMIT-PLAN.md` |
| Local commits made this task | **none** (tree too mixed for safe multi-group product commits; plan only) |
| Push | **not done** |
