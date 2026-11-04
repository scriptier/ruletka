# L19 prod curl live.js 566 — RESULT

## Status
**COMPLETE**

## OWN
- Read-only: disk `ui/live.html` + curl prod `https://ruletka.vip/live.html` and key assets
- No product file edits, no deploy, no force-push, no APK, no phone adb
- **No invent multi / blur product PASS**

## Goal
curl prod live.html pins; confirm **live.js?v=566** and **sounds/match.mp3** HTTP **200**; confirm prod `live.js?v=566` body contains `match.mp3`. RESULT table. No invent PASS.

## When
2026-08-12T03:43:20Z (UTC)  
Git HEAD (short): **a0d195d**

## 1) Disk pins (`ui/live.html` — 190499 B, sha256 `7d5bb2ff…`)

| Line | Pin |
|------|-----|
| L395 | `live-stage.css?v=388` |
| L396 | `live-brand.css?v=12` |
| L397 | `live.js?v=566` (preload) |
| L3031 | `webrtc.js?v=315` |
| L3032 | `live.js?v=566` (script) |

**match.mp3 (disk reference via `ui/live.js`, not in live.html):**  
`sounds/match.mp3?v=1` → file `ui/sounds/match.mp3` (15165 B, sha256 `9bd3f216…`)

## 2) Prod pins (`https://ruletka.vip/live.html` — HTTP **200**, 190499 B, sha256 `7d5bb2ff…`)

| Line | Pin |
|------|-----|
| L395 | `live-stage.css?v=388` |
| L396 | `live-brand.css?v=12` |
| L397 | `live.js?v=566` (preload) |
| L3031 | `webrtc.js?v=315` |
| L3032 | `live.js?v=566` (script) |

**live.html disk ↔ prod:** **BYTE_IDENTICAL**

## 3) Pin + asset table — disk vs prod

| pin / asset | disk | prod | verdict |
|-------------|------|------|---------|
| **live.js** `?v=` | **566** | **566** | **match** (pin string) |
| **live-brand.css** `?v=` | **12** | **12** | **match** (pin string) |
| **live-stage.css** `?v=` | **388** | **388** | **match** (pin string) |
| **webrtc.js** `?v=` | **315** | **315** | **match** (pin string) |
| **sounds/match.mp3** HTTP | present 15165 B | HTTP **200**, 15165 B | **match** |
| **sounds/match.mp3?v=1** HTTP | same file | HTTP **200**, 15165 B | **match** |
| **live.js body contains `match.mp3`** | yes (`sounds/match.mp3?v=1`, 2 refs) | yes (`sounds/match.mp3?v=1`, 2 refs via `matchChimeUrl`) | **match** |

### Body content (sha256 / size) — beyond pin strings

| asset URL | disk size / sha256 (prefix) | prod HTTP / size / sha256 (prefix) | body verdict |
|-----------|-----------------------------|-------------------------------------|--------------|
| `live.js?v=566` | 1 129 406 B `282050d6…` | **200** / 648 877 B `c80d1709…` | **content lag** (disk ≠ prod; pin same) |
| `live-brand.css?v=12` | 9 191 B `ce7e7b04…` | **200** / 9 191 B `ce7e7b04…` | **match** (BYTE_IDENTICAL) |
| `live-stage.css?v=388` | 539 865 B `974c7cca…` | **200** / 387 902 B `ce9098df…` | **content lag** (disk ≠ prod; pin same) |
| `webrtc.js?v=315` | 137 885 B `85615220…` | **200** / 62 388 B `222bc31d…` | **content lag** (disk ≠ prod; pin same) |
| `sounds/match.mp3` | 15 165 B `9bd3f216…` | **200** / 15 165 B `9bd3f216…` | **match** (BYTE_IDENTICAL) |
| `live.html` | 190 499 B `7d5bb2ff…` | **200** / 190 499 B `7d5bb2ff…` | **match** (BYTE_IDENTICAL) |

### Prod `live.js?v=566` — `match.mp3` evidence

Minified body contains `matchChimeUrl` / `MATCH_CHIME` and **2** string hits:

```text
function matchChimeUrl(){try{return new URL("sounds/match.mp3?v=1",location.href).href}catch(e){return"sounds/match.mp3?v=1"}}
```

### HTTP status recheck (all 200)

| URL | HTTP |
|-----|------|
| `https://ruletka.vip/live.html` | 200 |
| `https://ruletka.vip/live.js?v=566` | 200 |
| `https://ruletka.vip/sounds/match.mp3` | 200 |
| `https://ruletka.vip/sounds/match.mp3?v=1` | 200 |
| `https://ruletka.vip/live-stage.css?v=388` | 200 |
| `https://ruletka.vip/live-brand.css?v=12` | 200 |
| `https://ruletka.vip/webrtc.js?v=315` | 200 |

## 4) Summary (honest)

| Check | Result |
|-------|--------|
| Prod HTML pins include **live.js?v=566** | **YES** (preload L397 + script L3032) |
| Prod HTML pins match disk tip (566 / 388 / 12 / 315) | **YES** (pin strings + live.html byte-identical) |
| **sounds/match.mp3** HTTP 200 | **YES** (15165 B, sha match disk) |
| Prod **live.js?v=566** contains **match.mp3** | **YES** (`sounds/match.mp3?v=1`, 2 refs) |
| Full body parity live.js / stage / webrtc | **NO** — prod still smaller; same body lag pattern as L16 (pin stamped; bodies not fully shipped) |

**Note:** Prod `live.js?v=566` body sha `c80d1709…` / 648877 B is the **same** body size/sha L16 reported for then-`?v=565`. HTML pin moved **565→566** and stage pin **387→388** on both disk and VIP HTML; live.js/stage/webrtc **bodies** still lag disk tip.

## 5) Explicit non-claims

- **No multi / blur product PASS** invented or asserted.
- **No** Friends / Settings / Play Console GOAL_MET.
- **No deploy performed** (no rsync, push.sh, systemctl, coturn, droplet).
- **No APK**, no force-push, no product source edits.
- Pin-string **match** ≠ full content deploy parity for live.js / stage / webrtc.
- This card is **curl/static pin evidence only** — not human smoke, not av-verify product PASS.

## 6) Card hygiene

- RESULT: `tasks/grok-loop/done/L19-prod-curl-RESULT.md`
- Card moved: `tasks/grok-loop/running/L19-prod-curl.md` → `tasks/grok-loop/done/L19-prod-curl.md`
