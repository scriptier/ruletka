# W8-multi-joinpeers-log — RESULT

**Status:** COMPLETE  
**OWN:** RESULT read-only `ui/live.js` joinPeers  
**Date:** 2026-08-11  
**Code change:** none (read-only)

## Goal
Confirm partyCap log when 5th peer (cap hit / rejected); RESULT only. No invent multi PASS / GOAL_MET.

## Grep

```text
rg -n 'partyCap|maxOpponents|joinPeers' ui/live.js
```

In-repo equivalent (rg binary absent on host): content search for `partyCap|maxOpponents|joinPeers` in `ui/live.js`.

| Pattern | In `ui/live.js` |
|---------|-----------------|
| `partyCap` | **absent** (no `_t("log.partyCap")`, no string `partyCap`) |
| `maxOpponents` | **present** ~26895–26902 |
| `joinPeers` | **present** (function + call sites) |

`log.partyCap` **does** exist in i18n (`ui/i18n/en.json` L597: `"max 3 opponents — skipping extra peer"`) and `ui/i18n.js`, but **joinPeers does not call it**.

## Cap / 5th-peer log paths in `joinPeers`

### 1. Slice over maxOpponents — log **present** (hard-coded EN)

```26888:26902:ui/live.js
  // Cap 3 opponents (you + 3 remotes = 4-way). Mesh cost — no remote4 without HTML.
  const allOpponents = list
    .filter((p) => p.role === "stranger" || p.role === "party")
    .sort((a, b) => String(a.peer_id).localeCompare(String(b.peer_id)));
  // ...
  const maxOpponents =
    friendMeta && (yourRole === "party" || trioBrowse) ? 2 : 3;
  if (allOpponents.length > maxOpponents) {
    log(
      `max 3 opponents — skipping ${allOpponents.length - maxOpponents} extra peer(s) (mesh cost)`
    );
  }
  const opponents = allOpponents.slice(0, maxOpponents);
```

When a 5th person yields a 4th opponent in the list (solo: >3 strangers), this fires before slice drops extras.

### 2. Party layout overfill (mate+2 already) — log **present** (hard-coded EN)

```26989:26993:ui/live.js
    if (opponents.length > 2) {
      log(
        "max 3 opponents — party slot full (mate+2); skipping extra (mesh cost)"
      );
    }
```

Note: after slice, `opponents` is already capped (`maxOpponents` 2 with mate), so this branch is defensive / unlikely on normal path.

### 3. PC open gate: outside opponentIds / strangerCount ≥ 3 — logs **present** (hard-coded EN)

```27173:27189:ui/live.js
    const strangerCount = [...peerPcs.values()].filter(
      (pc) => pc._role === "stranger" || pc._role === "party"
    ).length;
    // Max 3 opponents (you+3). Prefer stable opponentIds from sorted slice; skip 4th+.
    if (p.role === "stranger" || p.role === "party") {
      if (p.peer_id && opponentIds.size && !opponentIds.has(p.peer_id)) {
        log(
          "max 3 opponents — skipping extra peer (mesh cost)"
        );
        continue;
      }
      if (strangerCount >= 3) {
        log(
          "max 3 opponents — skipping extra peer (mesh cost)"
        );
        continue;
      }
    }
```

These are the live reject paths when a 5th peer would open a 4th remote PC: skip + log, no silent drop.

## Summary

| Item | Present? | Lines / note |
|------|----------|--------------|
| i18n key `log.partyCap` | **outside** joinPeers (i18n only) | en: “max 3 opponents — skipping extra peer” |
| joinPeers uses `_t("log.partyCap")` | **absent** | hard-coded EN only |
| Cap-hit UI log on extra peer | **present** | L26897–26900, L26989–26992, L27178–27181, L27184–27187 |
| maxOpponents slice (3 solo / 2 party+mate) | **present** | L26895–26902 |
| strangerCount ≥ 3 gate | **present** | L27184–27188 |

**Verdict (static only):** Cap-hit logging is **present** in `joinPeers` as hard-coded “max 3 opponents — skipping …” lines (same wording family as `log.partyCap`, not the i18n key). No runtime/human smoke of 5th peer performed. No multi PASS / GOAL_MET invented.

## Not done (by job scope)
- No live.js edits
- No deploy
- No human smoke of 5th peer

## Job complete
RESULT filed; card moved running → done.
