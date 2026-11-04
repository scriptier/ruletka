# T5-partyCap-i18n-wire — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` only — joinPeers cap log strings  
**Date:** 2026-08-11  
**Deploy:** none

## Goal
joinPeers hard-coded "max 3 opponents" → prefer `_t("log.partyCap")` when key exists, with EN fallback of existing string.

## Work

Grep: 4 hard-coded cap logs in `joinPeers` (slice over max, party mate+2, opponentIds skip, strangerCount >= 3).

Replaced each with:

```js
log(_t("log.partyCap") || "<existing EN string>");
```

| Path | Fallback kept |
|------|----------------|
| `allOpponents.length > maxOpponents` | `` `max 3 opponents — skipping ${n} extra peer(s) (mesh cost)` `` |
| `opponents.length > 2` (party mate+2) | `"max 3 opponents — party slot full (mate+2); skipping extra (mesh cost)"` |
| `!opponentIds.has(p.peer_id)` | `"max 3 opponents — skipping extra peer (mesh cost)"` |
| `strangerCount >= 3` | `"max 3 opponents — skipping extra peer (mesh cost)"` |

i18n key already present: `ui/i18n/en.json` / `ui/i18n.js` → `"max 3 opponents — skipping extra peer"` (+ localized packs).

## Verify (static)

```text
# all four joinPeers cap logs now call _t("log.partyCap")
```

- No other files touched.
- Cap logic / slice / strangerCount gates unchanged.
- No deploy, no multi PASS / GOAL_MET invented.

## Must not (honored)
ICE thrash, multi layout thrash, invent PASS, deploy.
