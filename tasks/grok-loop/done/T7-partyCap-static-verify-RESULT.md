# T7-partyCap-static-verify — RESULT

**Status:** COMPLETE  
**OWN:** RESULT read-only `ui/live.js` joinPeers  
**Date:** 2026-08-11  
**Code change:** none (read-only)

## Goal
Confirm `joinPeers` uses `_t("log.partyCap")` (T5 wire still on disk). COMPLETE.

## Grep

```text
grep -n '_t("log.partyCap")\|async function joinPeers' ui/live.js
```

| Pattern | In `ui/live.js` |
|---------|-----------------|
| `async function joinPeers` | **present** L26866 |
| `_t("log.partyCap")` | **4** hits — all inside `joinPeers` cap paths |
| Count | `grep -c '_t("log.partyCap")' ui/live.js` → **4** |

## Cap log sites (all use `_t("log.partyCap")` + EN fallback)

| # | Line | Gate | Fallback |
|---|------|------|----------|
| 1 | L26899 | `allOpponents.length > maxOpponents` | `` `max 3 opponents — skipping ${n} extra peer(s) (mesh cost)` `` |
| 2 | L26992 | `opponents.length > 2` (party mate+2) | `"max 3 opponents — party slot full (mate+2); skipping extra (mesh cost)"` |
| 3 | L27182 | `!opponentIds.has(p.peer_id)` | `"max 3 opponents — skipping extra peer (mesh cost)"` |
| 4 | L27189 | `strangerCount >= 3` | `"max 3 opponents — skipping extra peer (mesh cost)"` |

### Snippets

```26897:26902:ui/live.js
  if (allOpponents.length > maxOpponents) {
    log(
      _t("log.partyCap") ||
        `max 3 opponents — skipping ${allOpponents.length - maxOpponents} extra peer(s) (mesh cost)`
    );
  }
```

```26990:26995:ui/live.js
    if (opponents.length > 2) {
      log(
        _t("log.partyCap") ||
          "max 3 opponents — party slot full (mate+2); skipping extra (mesh cost)"
      );
    }
```

```27180:27193:ui/live.js
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

**CONFIRMED:** `joinPeers` wires all four party-cap log paths through `_t("log.partyCap")` with EN string fallbacks. T5 wire remains on disk. No code change. No deploy. No multi PASS / GOAL_MET invented. No human smoke of 5th peer.

## COMPLETE
