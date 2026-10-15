# L19d-partyCap — RESULT

**Status:** COMPLETE  
**OWN:** RESULT read-only `ui/live.js` joinPeers `_t("log.partyCap")` count  
**Date:** 2026-08-12T03:43Z  
**HEAD:** `a0d195d`  
**Root:** `/home/drakosik/freenet-roulette`  
**Code change:** none (read-only)

## Goal
grep `_t("log.partyCap")` in `joinPeers` — RESULT COMPLETE. No invent multi PASS.

## Grep

```bash
cd /home/drakosik/freenet-roulette
grep -n '_t("log.partyCap")\|async function joinPeers' ui/live.js
grep -c '_t("log.partyCap")' ui/live.js
```

| Pattern | In `ui/live.js` |
|---------|-----------------|
| `async function joinPeers` | **present** L26956 |
| `_t("log.partyCap")` | **4** hits — all inside `joinPeers` cap paths |
| Count | `grep -c '_t("log.partyCap")' ui/live.js` → **4** |

## Cap log sites (all use `_t("log.partyCap")` + EN fallback)

| # | Line | Gate | Fallback |
|---|------|------|----------|
| 1 | L26989 | `allOpponents.length > maxOpponents` | `` `max 3 opponents — skipping ${n} extra peer(s) (mesh cost)` `` |
| 2 | L27082 | `opponents.length > 2` (party mate+2) | `"max 3 opponents — party slot full (mate+2); skipping extra (mesh cost)"` |
| 3 | L27272 | `!opponentIds.has(p.peer_id)` | `"max 3 opponents — skipping extra peer (mesh cost)"` |
| 4 | L27279 | `strangerCount >= 3` | `"max 3 opponents — skipping extra peer (mesh cost)"` |

### Snippets

```26987:26992:ui/live.js
  if (allOpponents.length > maxOpponents) {
    log(
      _t("log.partyCap") ||
        `max 3 opponents — skipping ${allOpponents.length - maxOpponents} extra peer(s) (mesh cost)`
    );
  }
```

```27080:27085:ui/live.js
    if (opponents.length > 2) {
      log(
        _t("log.partyCap") ||
          "max 3 opponents — party slot full (mate+2); skipping extra (mesh cost)"
      );
    }
```

```27270:27283:ui/live.js
      if (p.peer_id && opponentIds.size && !opponentIds.has(p.peer_id)) {
        log(
          _t("log.partyCap") ||
            "max 3 opponents — skipping extra peer (mesh cost)"
        );
        continue;
      }
      if (strangerCount >= 3) {
        log(
          _t("log.partyCap") ||
            "max 3 opponents — skipping extra peer (mesh cost)"
        );
        continue;
      }
```

## i18n key (context only)

`ui/i18n/en.json` L597: `"log.partyCap": "max 3 opponents — skipping extra peer"`

## Verdict (static only)

**CONFIRMED:** `joinPeers` wires all four party-cap log paths through `_t("log.partyCap")` with EN string fallbacks. Count = **4**. Matches prior L18e static verify. No code change. No deploy. No multi PASS / GOAL_MET invented. No human smoke of 5th peer.

## COMPLETE
