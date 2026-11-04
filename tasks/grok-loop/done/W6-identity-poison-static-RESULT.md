# W6 identity poison static audit (PC) — RESULT

**Status:** COMPLETE · **PASS**  
**OWN:** RESULT only (read-only `ui/live.js` identity helpers)  
**Date:** 2026-08-11  
**Syntax:** `node --check ui/live.js` → **PASS** (exit 0)  
**Deploy:** none  
**Code edits:** none (no proof one-line bug requiring fix)

## Goal
Confirm `isRealPartnerDisplayName` rejects Partner/hex; `lastGoodPartnerName` latch mid-trio.

## Grep summary

| Symbol | Sites (approx) | Role |
|--------|----------------|------|
| `isPoisonDisplayName` | ~1077–1085 | empty / anon / Partner / 6–12 hex |
| `isRealPartnerDisplayName` | ~1580–1593 + 30+ call sites | gate latch + paint |
| `lastGoodPartnerName` / `lastGoodPartnerUserId` | ~1577–1578 | Courtier latch state |
| `latchGoodPartnerName` / `clearGoodPartnerNameLatch` | ~1595–1614 | write / hangup clear |
| `stealMainLatch` | ~8933–8939 | DC stranger skip mid-trio |
| `latchedStillPresent` | ~25562–25575 | Matched clear only if mate left |

## 1. `isRealPartnerDisplayName` rejects Partner / hex — **PASS**

```1580:1593:ui/live.js
function isRealPartnerDisplayName(raw) {
  const s = String(raw || "").trim();
  if (!s || isPoisonDisplayName(s)) return false;
  if (/^[0-9A-Fa-f]{6,12}$/.test(s)) return false;
  // Generic i18n "Partner" / "Собеседник" is not a real display name
  if (/^partner$/i.test(s)) return false;
  try {
    const t1 = String(_t("trio.partner") || "").trim();
    const t2 = String(_t("remote.partner") || "").trim();
    if (t1 && s.toLowerCase() === t1.toLowerCase()) return false;
    if (t2 && s.toLowerCase() === t2.toLowerCase()) return false;
  } catch (_) {}
  return true;
}
```

| Input class | Rejected? | Via |
|-------------|-----------|-----|
| `""` / whitespace | yes | empty |
| `Partner` / `partner` / `PARTNER` | yes | `isPoison` + `/^partner$/i` |
| i18n `trio.partner` / `remote.partner` | yes | `_t` equality |
| `anon` | yes | `isPoisonDisplayName` |
| 6–12 hex (`6664acc4`, `DABC741D`, `abcdef`) | yes | poison + redundant hex regex |
| Real names (`Courtier`, `Драконов`, `Alice`) | no (accept) | fall-through `true` |

Mirror probe (same predicates, no DOM/`_t`): **PROBE_ALL_PASS** for empty/Partner/hex/real cases.

`latchGoodPartnerName` only writes when `isRealPartnerDisplayName` passes (~1597) — poison never enters the latch.

## 2. Mid-trio latch — **PASS**

| Path | Location | Behavior | Verdict |
|------|----------|----------|---------|
| DC `partner_identity` | ~8930–8965 | `stealMainLatch` when `trioBrowse` + uid ≠ latched mate + latched Courtier real → skip latch/paint/meta overwrite | **PASS** |
| keep-PC re-Matched | ~25111–25139 | different peer hub name does not steal latch; re-paint prefers `lastGoodPartnerName` | **PASS** |
| Matched primary / find-3rd | ~25554–25582 | clear latch only if latched uid **not** in `peers` (`latchedStillPresent`); stranger primary does not re-latch over mate | **PASS** |
| Main `#remote-name` paint | ~25756–25790 | `trioBrowse` → prefer `matePeer`; name order `rawPeer → lastGoodPartnerName → lastMatchMeta` | **PASS** |
| Split soft path | ~25720–25748 | real/latched only; soft tag via `setDisplayNameOnTile` (latch keep, not wipe) | **PASS** |
| `bindFirstPartnerToMain` | ~12930–12940 | prefer raw real else `lastGoodPartnerName` over meta | **PASS** |
| find-third soft reflow | ~32919–32924 | re-paint latched Courtier after stage-trio blank risk | **PASS** |
| Connecting empty wipe | ~14655–14668 | mid-match keep latched name on `#remote-name` | **PASS** |
| Hangup | `clearGoodPartnerNameLatch` | clears name + uid + recovery timers | **PASS** (via reset paths) |

`setDisplayNameOnTile` (~1647–1650): poison/empty name on `#remote-name` falls back to latched Courtier before generic Partner.

## 3. Residual (non-blocking — no fix this job)

| Item | Note |
|------|------|
| `resolvePartnerPaintName` candidate order | Comment says prefer latch; code ranks `lastMatchMeta?.name` **before** `lastGoodPartnerName` (~1626–1627). Mid-trio **writers** work around this by passing explicit latch-first names. |
| `lastMatchMeta.name` mid-find-3rd | Still tracks stranger/block primary when primary has a *real* name; main tile paint uses latch/mate, not meta alone. Partner **menu** (~32005–32009) can show stranger primary name (block target) — intentional for gift/block primary, not main Courtier chip. |
| `schedulePartnerNameRecovery` | Uses `resolvePartnerPaintName({})`; if meta already holds a real stranger name mid-trio, recovery could re-paint that name. Soft residual; main trio accept path + `stealMainLatch` + softKeep re-assert Courtier. Not a one-line proven ship-blocker in this static pass. |

No code change: residuals are order/priority soft notes, not broken reject/latch gates.

## Verify ran

```bash
node --check ui/live.js   # exit 0
# mirror isRealPartnerDisplayName probes → PROBE_ALL_PASS
```

Static asserts confirmed by read: poison reject, latch write-gate, `stealMainLatch`, `latchedStillPresent`, mate-prefer main paint, softKeep Courtier.

## Not done (by job scope)

- No `ui/live.js` edit
- No deploy / cache v-bump / APK
- No human PC↔phone find-3rd smoke (code-path static only)

## Connect risk

**None** — identity chrome audit only. No ICE / offer / pool / MediaSession thrash.

## Job complete

Running task → done; RESULT filed at  
`/home/drakosik/freenet-roulette/tasks/grok-loop/done/W6-identity-poison-static-RESULT.md`
