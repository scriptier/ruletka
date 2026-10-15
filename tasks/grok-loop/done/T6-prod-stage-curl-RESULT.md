# T6 prod stage curl — RESULT

## Status
**COMPLETE** (read-only curl + disk compare — **no deploy**)

## OWN
- RESULT under `tasks/grok-loop/done/` only
- No product code edits
- No deploy / APK / phone adb

## Goal
Check prod `live-stage.css?v=` vs disk **386**; RESULT only. Soft rules. No invent multi PASS.

## Measured (2026-08-12T02:29:44Z UTC)

### Commands

```bash
grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=' ui/live.html
curl -sS -m 20 'https://ruletka.vip/live.html' | grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v='
curl -sS -o /dev/null -w '%{http_code}\n' -m 15 'https://ruletka.vip/live.html'
```

### Version table — prod vs disk

| Asset | Prod `https://ruletka.vip/live.html` (HTTP **200**) | Disk `ui/live.html` | Gap |
|-------|------------------------------------------------------|---------------------|-----|
| **live-stage.css** | **`?v=384`** | **`?v=386`** | **prod lags disk by 2** |
| **live.js** | `?v=561` | `?v=561` | none |
| **webrtc.js** | `?v=315` | `?v=315` | none |

Confirm lines:

```text
# disk
live-stage.css?v=386
live.js?v=561
webrtc.js?v=315

# prod
live-stage.css?v=384
live.js?v=561
webrtc.js?v=315
```

### Stage body note (soft)

| Source | HTTP | Size (bytes) | md5 |
|--------|------|--------------|-----|
| Disk `ui/live-stage.css` | n/a | **539 625** (unminified) | `a74871d7…` |
| Prod `live-stage.css?v=384` | 200 | **387 279** (minified ship) | `cfa9e066…` |
| Prod `live-stage.css?v=386` URL | 200 | **387 279** (same body as 384) | `cfa9e066…` |

- Prod HTML still stamps **384**; tip **386** not linked on prod live.html.
- Prod `?v=386` URL returns the **same** minified body as **384** (not disk 386 content) — expected until human `push.sh` ships the current tree.
- Disk stage tip is **386** (post director CSS fix); prod remains **384**.

## Verdict

| Check | Result |
|-------|--------|
| Prod reachable | **ok** (HTTP 200) |
| live.js / webrtc prod == disk | **ok** (561 / 315) |
| live-stage.css tip | **prod 384 vs disk 386** |
| Deploy this hop | **No** — agent wall |

**Human deploy needed** to land disk stage **386** (and current stage CSS body) on prod. Agent did **not** run `./scripts/deploy/push.sh`.

## Explicit non-claims / must-not

- No invent multi PASS / GOAL_MET / A/V PASS
- No deploy, no APK, no force-push
- No product code / CSS / HTML edits
- No ICE / pool thrash

## Connect risk
**None** — read-only curl + local grep.

## Done criteria

- [x] Curl prod live.html (200)
- [x] Disk stage noted **386**
- [x] Prod stage noted **384**
- [x] Gap stated: human deploy needed
- [x] No invent multi PASS
- [x] RESULT COMPLETE; no deploy

## COMPLETE or BLOCKED
**COMPLETE**
