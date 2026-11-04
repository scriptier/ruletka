---
title: Laptop two-videos diagnose — 3 clients, leftover 1v1 idle
date: 2026-08-16
slug: laptop-two-videos-diag
source_type: note
source_url:
source_path: artifacts/av-verify/20260816T010340Z.json
captured_by: agent
skill: add-new-resource
---

# Raw: laptop two videos — scorecard diagnose (d-score)

## Source
- Type: note (scorecard read; no code edit)
- Path: `artifacts/av-verify/20260816T010340Z.json`
- Also: `artifacts/av-verify/latest.md` · `artifacts/av-verify/latest.json` (same stamp)
- Human / shots: `knowledge/raw/2026-08-16-laptop-vs-pc-3way-compare.md` (`010045Z`)
- Lane: herd `d-score` (read-mostly)
- Captured: 2026-08-16

## Scorecard headline

`20260816T010340Z` at=`2026-08-16T01:03:40Z` window **5 min**

- verdict **IDLE** · product **idle** · done=`False`
- matches=0 offers=0 answers=0 (signaling_ok=False)
- TURN: alloc_ok=0 peer_hot=71 max_rb=502949 err_437=0 (media_pass=False)
- av_path count=16 best_fin=7840 best_fout=7901 any_ok=True
- **PRODUCT**: web fin/fout=`7147/7901` · android fin/fout=`7840/7130` · `app_vc=422` · bind_v=`0` · fr_mismatch=False
- force_relay web=true android=1 · policy=relay both

**No MULTI_PASS.** product idle / leftover frames ≠ laptop sees two videos.

## 1. Three clients in the window (2 web + android)

| short | platform | role | evidence |
|-------|----------|------|----------|
| `4af1a3ab` | web | **this PC / Dragonov** (has cam) | offerer=1 connected relay→relay fin/fout climbing · also a 2nd PC offerer=0 ice=checking 0/0 |
| `84f65521` | web | **laptop** (no webcam) | **only** ice=checking 0/0 offerer=0 · never connected · never frames |
| `9773dc92` | android | Pixel / Courtier · **app_vc=422** | bind_v=1 ice=connected sendrecv frames climbing · **extra** bind_v=0 ice=new 0/0 |

Identity from beacons, not names: laptop is the web client that **never** leaves checking. This PC is the web client that still **sends+receives** on one PC.

## 2. Android extra ice=new 0/0

Repeating extra PC on `9773dc92` (last `01:03:37Z`):

```
from=9773dc92 platform=android app_vc=422 ice=new cs=new sig=stable
offerer=0 bind_v=0 v_kind=? v_dir=? frames_in=0 frames_out=0
```

Primary Android PC (last `01:03:34Z`):

```
from=9773dc92 ice=connected cs=connected bind_v=1 app_vc=422
v_kind=video v_readyState=live v_dir=sendrecv enc_active=1
frames_in=7840 frames_out=7130
```

Extra PeerConnection exists as **answerer**. No remote offer applied. ICE never left `new`. 0/0 is not a mid-ICE stall.

## 3. Laptop web ice=checking 0/0

Every `84f65521` beacon in the window (last `01:03:40Z`):

```
from=84f65521 platform=web ice=checking cs=connecting sig=stable
offerer=0 frames_in=0 frames_out=0 local_type=? remote_type=? pair=? ok=false
```

Laptop never reports ice=connected. Never reports candidates / pair. Never reports frames. This is the 3rd-hop web PC stuck in checking with **0/0**.

This PC also advertises a **second** web PC in the same state (`4af1a3ab` offerer=0 ice=checking 0/0). That is this-PC's extra hop toward the laptop — not the live 1v1.

## 4. This PC connected pair (the leftover 1v1)

Last live pair (`01:03:36Z` / `01:03:34Z`):

| who | ice | pair | fin/fout | ok |
|-----|-----|------|----------|----|
| `4af1a3ab` web offerer=1 | connected | relay→relay succeeded | 7147 / 7901 | true |
| `9773dc92` android bind_v=1 | connected | (primary) | 7840 / 7130 | (sendrecv live) |

That is **this PC ↔ Android 1v1**. Matches parsed table row `web connected relay→relay 7147/7901 ok=True` and `android connected 7840/7130`.

## 5. Leftover product idle/ok is that 1v1 — NOT laptop two videos

- Headline product.status=`idle` because **no matches in the 5 min window**.
- Leftover av_path frames (web 7147/7901 · android 7840/7130 · any_ok=True) are the **held PC↔phone pair**.
- Product-level bind_v=`0` is the leftover extra (Android extra ice=new).
- Laptop `84f65521` contributes **zero** frames. It cannot be the product pair.
- Human `010045Z` laptop shot: left Dragonov **black** · mid Partner no-cam · right YOU Laptop no-cam. Zero live cameras. Should be phone + this PC.

**Do not read product idle / leftover ok as laptop 2 videos. Do not invent MULTI_PASS.**

## Parsed av_path (from latest.md)

| platform | ice | local→remote | frames_in | frames_out | ok | who |
|----------|-----|--------------|-----------|------------|----|-----|
| android | new | ?→? | 0 | 0 | | extra `9773dc92` bind_v=0 |
| web | checking | ?→? | 0 | 0 | False | this PC extra **or** laptop |
| web | checking | ?→? | 0 | 0 | False | this PC extra **or** laptop |
| android | connected | ?→? | 7840 | 7130 | | primary `9773dc92` bind_v=1 |
| web | connected | relay→relay | 7147 | 7901 | True | this PC `4af1a3ab` offerer=1 |

Two web checking 0/0 = `4af1a3ab` extra + `84f65521` laptop. Neither is the connected pair.

## Do not invent

- MULTI_PASS
- This scorecard product idle / leftover frames as 3-way / laptop two-videos PASS
- New match in this 5 min window (matches=0)
- ICE / TURN / pool thrash — live 1v1 is already relay→relay
