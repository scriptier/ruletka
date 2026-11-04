# T6-livejs-cache-bump-partyCap — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.html` only (cache-bust query)  
**Date:** 2026-08-11  
**Deploy:** none

## Goal
Bump `live.js?v=561` → `562` in `live.html` only after partyCap i18n is on disk.

## Preconditions (verified)
partyCap i18n wire present on disk (`T5-partyCap-i18n-wire`):

```text
ui/live.js — 4× `_t("log.partyCap")` in joinPeers cap paths
  L26899, L26992, L27182, L27189
```

## Work
Pre-bump disk still had **561** → performed bump.

| Site | Before | After |
|------|--------|-------|
| preload (~L397) | `live.js?v=561` | `live.js?v=562` |
| script (~L3032) | `live.js?v=561` | `live.js?v=562` |

Unchanged: `webrtc.js?v=315`, `live-stage.css?v=386`. No `live.js` body edits.

## Verify
```text
$ grep -nE 'live\.js\?v=' ui/live.html
397:  <link rel="preload" href="live.js?v=562" as="script" />
3032:  <script src="live.js?v=562" defer></script>
```
- Only **562** present for `live.js?v=`
- `webrtc.js?v=315` unchanged
- `live-stage.css?v=386` unchanged
- partyCap `_t("log.partyCap")` count in `ui/live.js`: **4**

## Connect risk
**None** — cache-bust query string only; no logic/signal path changes.

## Human smoke / multi
Not claimed. No invent multi PASS / GOAL_MET. No deploy.

## COMPLETE
