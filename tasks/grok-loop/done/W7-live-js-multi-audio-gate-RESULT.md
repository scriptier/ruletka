# W7-live-js-multi-audio-gate — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` multi-audio only (read-only)  
**Date:** 2026-08-12T02:07:43Z  
**Syntax:** `node --check ui/live.js` → **PASS** (exit 0)  
**Code change:** none (verify-only)

## Goal
Confirm multi-audio is only enabled when **nPeers ≥ 2** (not mere `party_browse` / find-3rd hunt with 1 media link).

## Checks

### 1. Entry points — gated, not unconditional
| Item | Location | Verdict |
|------|----------|---------|
| Flag + helpers | `multiPeerAudioActive` L20731; `countRemoteAudioPeers` L20733–20743; `isMultiPeerAudioFromMatch` L20746–20761; `enterMultiPeerAudioMode` L20846–20874; `leaveMultiPeerAudioMode` L20876–20883 | present |
| Early return if not multi | `enterMultiPeerAudioMode` L20847–20848: returns unless `isMultiPeerAudioFromMatch(peers)` **or** `countRemoteAudioPeers() >= 2` | PASS (has gate) |
| Call site: match | `handleMatched` L25711–25714 `enterMultiPeerAudioMode(peers)` | only path after gate |
| Call site: after PCs up | `joinPeers` L27502–27505 `enterMultiPeerAudioMode(list)` | only path after gate |
| Leave on hangup | L26019 `if (!keepFriend) leaveMultiPeerAudioMode()` | present |
| No other writers of `multiPeerAudioActive = true` | grep | only `enterMultiPeerAudioMode` |

### 2. `isMultiPeerAudioFromMatch` composition
| Condition | Location | Maps to nPeers≥2? | Verdict |
|-----------|----------|--------------------|---------|
| Empty peers → `countRemoteAudioPeers() >= 2` | L20747 | **Yes** (peerPcs) | PASS |
| `opponents.length >= 2` | L20753 | Yes (2+ remotes in match list) | PASS |
| `teammates >= 1 && opponents >= 1` | L20755 | Yes (2 identities in list; real trio/party) | PASS |
| `countRemoteAudioPeers() >= 2` | L20757 | **Yes** (peerPcs) | PASS |
| `trioBrowse && opponents.length >= 1` | L20759 | **No** — can be true with **1** remote PC / 1 opponent | **PARTIAL / gap** |

### 3. party_browse hunt (1 media link) vs real multi
| Scenario | Expected | Code path | Verdict |
|----------|----------|-----------|---------|
| Find-3rd accepted / only teammate listed (hunting) | multi-audio **off** | opponents=0, teammates≥1 → no branch true unless peerPcs≥2 | **PASS** — bare hunt does not force multi-audio |
| Mere `party_browse` flag alone | multi-audio **off** | no `matchMode === "party_browse"` check in audio gate; not sufficient by itself | **PASS** |
| 1v2 / 2+ opponents | multi-audio **on** | opponents≥2 | PASS |
| Teammate + stranger (3-way) | multi-audio **on** | teammates+opponents | PASS |
| peerPcs.size ≥ 2 | multi-audio **on** | countRemote ≥ 2 | PASS |
| Strict Android parity: `nPeers >= 2` only | multi-audio **only** if peer count ≥ 2 | Web uses match-list + **`trioBrowse && opponents≥1`** shortcut | **PARTIAL** |

Android reference (out of OWN, for parity note only):  
`mobile/app/live.tsx` ~2940–2957 — `const multi = nPeers >= 2` before `setMultiPeerAudio`.

### 4. Related multi encode floor (same spirit, not audio)
| Item | Location | Verdict |
|------|----------|---------|
| `applyMultiPeerOutboundQuality` no multi budget when `live.length <= 1` | L26102–26113 | PASS — encode multi only when 2+ PCs |
| joinPeers re-applies quality after connect | L27506–27509 | present |
| peer drop re-applies quality | L26291 | present |

### 5. Must-not (this job)
| Rule | Verdict |
|------|---------|
| No ICE thrash | no ICE/pool edits |
| No pool>0 | untouched |
| No dual MediaSession | web live.js only; no mobile edit |
| No deploy / APK / push | none |

## Honest summary

| Claim | Result |
|-------|--------|
| Multi-audio is **gated** (not always-on) | **PASS** |
| Bare `party_browse` / only-teammate find-3rd hunt with 1 PC does **not** enter multi-audio | **PASS** |
| Multi-audio **strictly** only when `nPeers >= 2` / `peerPcs.size >= 2` (Android-style) | **PARTIAL** — L20759 `trioBrowse && opponents.length >= 1` can enable multi-audio without 2 live PCs; match-list teammate+stranger can arm before second PC exists |

**GOAL_MET:** not claimed (no invent). Product intent “don’t thrash audio on hunt-only 1-link” is **on disk** for the only-teammate path. Strict `nPeers>=2` parity with Android is **not** a single-condition gate on web.

## Fix
None this hop (RESULT read-only). Optional follow-up (separate OWN, not done here):  
tighten `isMultiPeerAudioFromMatch` to require `countRemoteAudioPeers() >= 2` (or drop L20759), matching Android + skill DONE WHEN #5.

## Not done (by job scope)
- No code patch
- No deploy / APK
- No human smoke
- No mobile / MediaSession edits

## Job complete
Running job → done; RESULT filed. Read-only; zero edits to `ui/live.js`.
