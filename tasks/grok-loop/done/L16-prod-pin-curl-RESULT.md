# L16 prod pin curl ruletka.vip — RESULT

## Status
**COMPLETE**

## OWN
- Read-only: disk `ui/live.html` + curl prod `https://ruletka.vip/live.html` and key assets
- No product file edits, no deploy, no force-push, no APK, no phone adb
- No multi/blur product claims

## Goal
curl prod live.html pins vs disk (live.js / brand / stage / webrtc / match.mp3). RESULT table. No invent multi PASS. No deploy.

## When
2026-08-12T03:27:21Z (UTC)

## 1) Disk pins (`ui/live.html`)

| Line | Pin |
|------|-----|
| L395 | `live-stage.css?v=387` |
| L396 | `live-brand.css?v=12` |
| L397 | `live.js?v=565` (preload) |
| L3031 | `webrtc.js?v=315` |
| L3032 | `live.js?v=565` (script) |

**match.mp3 (disk reference via `ui/live.js`, not in live.html):**  
`sounds/match.mp3?v=1` → file `ui/sounds/match.mp3` (15165 B)

## 2) Prod pins (`https://ruletka.vip/live.html` — HTTP 200, 190499 B)

| Line | Pin |
|------|-----|
| L395 | `live-stage.css?v=387` |
| L396 | `live-brand.css?v=12` |
| L397 | `live.js?v=565` (preload) |
| L3031 | `webrtc.js?v=315` |
| L3032 | `live.js?v=565` (script) |

## 3) Pin + asset table — disk vs prod

| pin / asset | disk | prod | verdict |
|-------------|------|------|---------|
| **live.js** `?v=` | **565** | **565** | **match** (pin string) |
| **live-brand.css** `?v=` | **12** | **12** | **match** (pin string) |
| **live-stage.css** `?v=` | **387** | **387** | **match** (pin string) |
| **webrtc.js** `?v=` | **315** | **315** | **match** (pin string) |
| **sounds/match.mp3** HTTP | present 15165 B, sha match | HTTP **200**, 15165 B, same sha | **match** |
| **sounds/match.mp3?v=1** HTTP | same file | HTTP **200**, 15165 B | **match** |

### Body content (sha256 / size) — beyond pin strings

| asset URL | disk size / sha256 (prefix) | prod HTTP / size / sha256 (prefix) | body verdict |
|-----------|-----------------------------|-------------------------------------|--------------|
| `live.js?v=565` | 1 129 406 B `282050d6…` | 200 / 648 877 B `c80d1709…` | **content lag** (disk ≠ prod; pin same) |
| `live-brand.css?v=12` | 9 191 B `ce7e7b04…` | 200 / 9 191 B `ce7e7b04…` | **match** |
| `live-stage.css?v=387` | 539 865 B `974c7cca…` | 200 / 387 902 B `ce9098df…` | **content lag** (disk ≠ prod; pin same) |
| `webrtc.js?v=315` | 137 885 B `85615220…` | 200 / 62 388 B `222bc31d…` | **content lag** (disk ≠ prod; pin same) |
| `sounds/match.mp3` | 15 165 B `9bd3f216…` | 200 / 15 165 B `9bd3f216…` | **match** |
| `live.html` | 190 499 B | 200 / 190 499 B | pin lines match; size match |

**Summary:** All HTML `?v=` pins for live.js / brand / stage / webrtc **match** disk tip (565 / 12 / 387 / 315). **match.mp3** is live on prod (HTTP 200) and byte-identical to disk.  
**However:** prod **bodies** for `live.js`, `live-stage.css`, and `webrtc.js` differ from disk (prod smaller; different sha256) despite matching query pins — disk is ahead or pin was stamped without shipping those bodies. **brand + match.mp3 bodies match.**

## 4) Explicit non-claims

- **No multi / blur product PASS** invented or asserted.
- **No deploy performed** (no rsync, push.sh, systemctl, coturn, droplet).
- **No APK**, no force-push, no product source edits.
- Pin-string **match** ≠ full content deploy parity for live.js / stage / webrtc.

## 5) Card hygiene

- RESULT: `tasks/grok-loop/done/L16-prod-pin-curl-RESULT.md`
- Card moved: `tasks/grok-loop/running/L16-prod-pin-curl.md` → `tasks/grok-loop/done/L16-prod-pin-curl.md`
