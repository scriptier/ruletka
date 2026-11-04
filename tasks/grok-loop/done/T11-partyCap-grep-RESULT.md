# T11-partyCap-grep — RESULT

**Status:** COMPLETE  
**OWN:** RESULT read-only grep (disk + prod curl)  
**Date:** 2026-08-12  
**Code change:** none  
**Deploy:** none

## Goal
Confirm `partyCap` on disk `ui/live.js`; prod still **0**.

## Disk

```text
$ grep -c partyCap ui/live.js
4
```

| Pattern | Count | Lines |
|---------|-------|-------|
| `partyCap` | **4** | L26899, L26992, L27182, L27189 |
| `_t("log.partyCap")` | **4** | same four (joinPeers cap paths) |

Disk size: **1 126 268** bytes · sha256 prefix `c0c8ccc18216bcd7…`

## Prod curl (`https://ruletka.vip`)

```text
$ curl -sS -m 20 'https://ruletka.vip/live.html' | grep -nE 'live\.js\?v=|…'
397:  <link rel="preload" href="live.js?v=561" as="script" />
3032:  <script src="live.js?v=561" defer></script>
# stage still v=384; webrtc v=315

$ curl -sS -m 30 'https://ruletka.vip/live.js' -o /tmp/prod-live.js
$ grep -c partyCap /tmp/prod-live.js
0
```

| Source | HTTP body size | `grep -c partyCap` | `log.partyCap` | sha256 prefix |
|--------|----------------|--------------------|----------------|---------------|
| Prod `live.js` (no query) | 647 770 | **0** | **0** | `fee7bd44bd2583f0…` |
| Prod `live.js?v=561` | 647 770 | **0** | **0** | same |
| Prod `live.js?v=562` | 647 770 | **0** | **0** | same (CDN ignores tip; same body) |
| Disk `ui/live.js` | 1 126 268 | **4** | **4** | `c0c8ccc18216bcd7…` |

## Verdict

| Check | Result |
|-------|--------|
| Disk has partyCap | **YES — 4** (`_t("log.partyCap")` ×4 in joinPeers) |
| Prod live.js body partyCap | **0** (still older minified ship) |
| Prod HTML pin | **`live.js?v=561`** (disk HTML **562**; lag unchanged) |
| disk == prod | **NO** until human deploy |

**CONFIRMED:** partyCap present on disk (4); prod still 0. No code change. No deploy. No invent multi PASS / GOAL_MET.

## COMPLETE
