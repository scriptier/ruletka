# W5 MediaSession multi static recheck — RESULT

## Status
**COMPLETE** (read-only audit — no code edit)

## OWN
- Static recheck of `mobile/src/media/MediaSession.ts` multi secondary path
- Confirm secondary never stops shared primary preview
- Confirm pure **answer** gather budgets untouched
- Code edit only if one clear multi regression with proof → **none found**
- **No APK**

## Goal
| Claim | Status |
|-------|--------|
| Secondary path never `stop()` shared primary preview | ☑ |
| Clone secondary outbound preferred; share fallback unowned | ☑ |
| Pure answer gather budget ≤ **280** ms | ☑ untouched |
| `waitForIceGather` no 250 ms floor | ☑ untouched |
| `iceCandidatePoolSize = 0` | ☑ untouched |
| No GUM on secondary (`adoptLocalStream` / skip markers) | ☑ |

## Grep map (secondary / stop / local)

There is **no** `setLocalStream` on MediaSession. UI React state uses `setLocalStream`; multi secondary binds via **`adoptLocalStream`**.

| Symbol | Role |
|--------|------|
| `secondaryLink` | Multi secondary PC latch (adopt / setMultiPeerAudio secondary) |
| `localStreamOwned` | false when sharing primary preview tracks |
| `ownedCloneTracks` | Clones created for secondary outbound only |
| `adoptLocalStream` | Secondary entry: no 2nd GUM; prefer clone; `owned = ownsAll` |
| `tryBuildSecondaryOutbound` | `track.clone()` video (+ audio if easy); share fallback |
| `releaseOwnedClones` | `stop()` **clones only** |
| `detachLocalSenders` | `replaceTrack(null)` before `pc.close` (RN shared-track safety) |
| `mayStopLocal` | `localStreamOwned && !secondaryLink` |
| `closeCall_no_stop_shared` | Log when full hangup skips stop on secondary/unowned |
| `closeCall_secondary_drop_local_ref` | `keepLocal` secondary: drop ref, no stop |
| `ensure_local_skip_secondary_no_gum` | No GUM mid multi |
| `open_local_skip_secondary_no_gum` | No GUM mid multi |
| `refresh_local_skip_secondary` | Secondary: re-enable only, no GUM/stop |
| `flip_skip_secondary` | Secondary: no camera flip |
| `keepLocal` | Mid-match rebuilds; sticky pure relay preserved |

### Call sites (Android multi)
- `mobile/app/live.tsx`: media2 / media3 `adoptLocalStream(primary local)` on multi join; close secondary/tertiary with `keepLocal: true`
- Promote: `markAsPrimary()` on surviving PC after primary swap (encode ceiling + clear secondary flag; does **not** force `localStreamOwned=true` when tracks were shared)

## closeCall ownership (proof)

```text
// Full hangup (!keepLocal)
releaseOwnedClones()                          // clones only
mayStopLocal = localStreamOwned && !secondaryLink
if (mayStopLocal) → stop local tracks
else if (secondaryLink || !localStreamOwned) → closeCall_no_stop_shared (no stop)

// keepLocal + (secondaryLink || !localStreamOwned)
releaseOwnedClones()
drop localStream ref WITHOUT stop → closeCall_secondary_drop_local_ref
```

**Decision table** (mirrors production):

| localStreamOwned | secondaryLink | mayStopLocal |
|------------------|---------------|--------------|
| true | false | yes (primary GUM hangup) |
| true | true | **no** (full-clone secondary) |
| false | true | **no** (shared / mixed adopt) |
| false | false | **no** (shared after flag clear / promote) |

Secondary hangup therefore cannot kill primary cam via `track.stop()`.

## Pure answer budgets (untouched)

| Check | Location | Value |
|-------|----------|-------|
| Answer pure wait cap | `createAnswer` path ~L5372 | `Math.min(this.relayWaitBudgetMs(), **280**)` |
| Early-exit | first `typ relay` in SDP or candidate | kept |
| Fail-open | `n===0` → emit without strip | kept |
| `relayWaitBudgetMs()` pure | ~L3934 | 1200 base (answer still min-capped 280) |
| `waitForIceGatherRelayOrDone` | ~L464 | `Math.max(0, maxMs)` — **no 250 floor** |
| `iceCandidatePoolSize` | `pcConfig` ~L1737 | **hardcoded 0** |
| Offer pure wait (not answer) | ~L4076 | cap **400** (offerer path; separate from answer) |

No regression vs P1-mediasession-multi locks. Hop10 150 hard-cap not reintroduced on answer.

## Encode budgets (secondary vs primary multi)

| Mode | Ceiling |
|------|---------|
| `secondaryLink` | clamp to **low** (`adoptLocalStream` / `setMultiPeerAudio({secondary})` / `setNetworkHints`) |
| Primary multi (`multiPeerAudio`) | clamp to **mid** |
| `markAsPrimary` | restores network ceiling; multi still ≤ mid |

Encode params only — no cam restart / GUM on secondary.

## Static verify

```bash
cd mobile && node src/media/mediasessionMultiSafety.test.mjs
# mediasessionMultiSafety.test.mjs: ok
```

| Invariant (test) | Result |
|------------------|--------|
| `iceCandidatePoolSize = 0` only | PASS |
| Pure answer budget cap 280 | PASS |
| waitForIceGather no 250 floor | PASS |
| Secondary no-GUM markers | PASS |
| `mayStopLocal = owned && !secondary` | PASS |
| `closeCall_no_stop_shared` / `closeCall_secondary_drop_local_ref` | PASS |
| adopt + clone path present | PASS |
| flip / refresh secondary guards | PASS |
| No APK | PASS (constraint) |

## Residual (not a ship-blocker; no edit this hop)

1. **`refreshLocalVideoTrack` / `flipCamera`** only guard `secondaryLink`, not `!localStreamOwned`. After `markAsPrimary()` on a **shared** (non-clone) adopt, `secondaryLink=false` while `localStreamOwned` may stay false. **`closeCall` remains safe** via `!localStreamOwned`. Residual: promote + no-clone share + hard refresh could theoretically touch shared tracks. Prefer-clone path + live.tsx always `adoptLocalStream` mitigates. **Not a clear proven multi regression** → no code edit per OWN.

2. Mid-call `pc.close` rebuilds: hangup path always `detachLocalSenders`; clone path still preferred for secondary.

3. Device 3-way hangup smoke remains human gate (logs: `adopt_local secondary=1`, `closeCall_no_stop_shared` / `closeCall_secondary_drop_local_ref`, `answer_first_relay … budget=280`, `pc_cfg … pool=0`).

## Connect risk
**None from this hop** — read-only. No ICE thrash, no dual MediaSession rewrite, no deploy.

## Files touched
- **None** (audit only)
- RESULT: `tasks/grok-loop/done/W5-mediasession-static-recheck-RESULT.md`
- Task moved: `running/` → `done/W5-mediasession-static-recheck.md`

## Merge advice
No merge required. Secondary no-stop + pure answer ≤280 remain green on static test. Optional later: widen refresh/flip guard to `secondaryLink || !localStreamOwned` if promote+share ever shows cam kill in logs.

## COMPLETE or BLOCKED
**COMPLETE**
