# P0-multi-joinPeers-cap-audit — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` joinPeers/cap only  
**Date:** 2026-08-11  
**Syntax:** `node --check ui/live.js` → **PASS** (exit 0)  
**Code change:** none (verify-only; cap contracts intact)

## Goal
Confirm live.js opponents `slice(0,3)` and `strangerCount >= 3`; no silent drop. Max 3 opponents (you + 3 remotes = 4-way).

## Checks

### 1. opponents slice / maxOpponents — PASS
| Item | Location | Verdict |
|------|----------|---------|
| Cap comment: 3 opponents (you + 3 remotes = 4-way) | `joinPeers` ~26888 | PASS |
| `allOpponents` = strangers/party sorted by peer_id | ~26889–26891 | PASS |
| Solo max **3**; party+mate max **2** strangers (mate occupies a remote tile) | `maxOpponents` ~26895–26896 | PASS |
| `opponents = allOpponents.slice(0, maxOpponents)` | ~26902 | PASS |
| `handleMatched` layout also `.slice(0, 3)` for opponents | ~25706–25708 | PASS |
| HTML slots: `#remote` / `#remote2` / `#remote-third` only (no remote4) | layout block ~26947+ | PASS |

### 2. strangerCount >= 3 gate — PASS
| Item | Location | Verdict |
|------|----------|---------|
| `strangerCount` counts PCs with `_role` stranger\|party | ~27173–27175 | PASS |
| Gate `strangerCount >= 3` → skip new stranger PC | ~27184–27188 | PASS |
| Prefer stable `opponentIds` from sorted slice; skip peer not in set | ~27177–27182 | PASS |

### 3. No silent drop — PASS
| Item | Location | Verdict |
|------|----------|---------|
| Log when `allOpponents.length > maxOpponents` | ~26897–26900 | PASS (not silent) |
| Log when peer outside `opponentIds` | ~27179–27181 | PASS |
| Log when `strangerCount >= 3` | ~27185–27187 | PASS |
| Party slot-full log (mate+2) | ~26989–26992 | PASS |
| i18n `log.partyCap` says max **3** (en/ru/uk/…) | `ui/i18n/*.json` | PASS (string content; joinPeers uses hard-coded EN log lines with same “max 3 opponents” wording) |

## Fix
None. Surgical fix not required — max **3** opponents enforced at:
1. sorted slice (`maxOpponents` 3 solo / 2 party-with-mate),
2. `opponentIds` membership,
3. live `strangerCount >= 3` before open PC.

Consistent with `knowledge/wiki/multi-party.md` + `knowledge/specs/current-multi-party.md` + multi-party-stage skill (cap you+3).

## Not done (by job scope)
- No deploy / no APK
- No live.js edits (cap already correct)
- No human smoke of 5th peer partyCap path

## Job complete
Moved running job → done; RESULT filed.
