# L20 prod body lag note — RESULT

## Status
**COMPLETE**

## OWN
- `knowledge/specs/SMOKE-NEXT.md` tip / agent notes only
- No product source edits, no deploy, no force-push, no APK, no phone adb
- **No invent multi / blur product PASS**

## Goal
Doc note in SMOKE-NEXT agent notes: pin strings match **566/388** (tip) but prod `live.js` / stage / webrtc **bodies** may lag (L16/L19 curl). No invent multi PASS. No deploy.

## When
2026-08-12 (doc-only hop)

## What changed

| File | Change |
|------|--------|
| [`knowledge/specs/SMOKE-NEXT.md`](../../knowledge/specs/SMOKE-NEXT.md) | Banner tip: **Prod body lag (L16/L19)** — pin match ≠ body deploy parity; human deploy required; multi/blur **human-smoke-open** |
| same | Agent table row: replace stale L13-only prod note with **L19** tip curl (566/388/12/315) + **L16** same-pattern cite; brand + match.mp3 BYTE_IDENTICAL; live.js body lag holds across pin bump |
| same | Sources list: add `L16-prod-pin-curl-RESULT.md`, `L19-prod-curl-RESULT.md` |
| same | Multi / blur rows remain **human-smoke-open** / unchecked (unchanged intent) |

## Honesty (cite L16 / L19)

| Source | Finding preserved |
|--------|-------------------|
| [`L16-prod-pin-curl-RESULT.md`](L16-prod-pin-curl-RESULT.md) | Pin strings matched then-disk (**565/387/12/315**); **body lag** on live.js / stage / webrtc (prod smaller / different sha); brand + match.mp3 match; **pin match ≠ body deploy parity** |
| [`L19-prod-curl-RESULT.md`](L19-prod-curl-RESULT.md) | Tip pins **566/388/12/315** match on VIP HTML; live.html BYTE_IDENTICAL; **same body lag** — prod live.js `?v=566` body same size/sha as L16 `?v=565`; stage/webrtc still lag; match.mp3 + brand OK |

**Rule for agents:** seeing `live.js?v=566` / stage `?v=388` on prod HTML does **not** mean full JS/CSS/WebRTC content is deployed. Human deploy still required for content parity. Agents **must not** deploy.

## Explicit non-claims

- **No multi / blur product PASS** invented or asserted — §D multi and blur stay **human-smoke-open**.
- **No** Friends / Settings / Play Console / GOAL_MET.
- **No deploy** performed (no rsync, push.sh, systemctl, coturn, droplet).
- **No APK**, no force-push, no product source edits beyond SMOKE-NEXT notes.
- This card is **doc note only** — not re-curl, not human smoke, not av-verify product PASS.

## Card hygiene

- RESULT: `tasks/grok-loop/done/L20-prod-body-lag-note-RESULT.md`
- Card moved: `tasks/grok-loop/running/L20-prod-body-lag-note.md` → `tasks/grok-loop/done/L20-prod-body-lag-note.md`
