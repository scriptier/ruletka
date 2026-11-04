---
title: Diagnose laptop Chrome sees PC not Android (same Chrome)
date: 2026-08-15
slug: laptop-no-android-diag
source_type: note
source_url:
source_path: artifacts/av-verify/20260815T201602Z.json
captured_by: agent
skill: add-new-resource
---

# Raw: laptop sees PC, not Android — 3rd-link diagnose (d-link)

## Source
- Type: note (scorecard + code read; no code edit)
- Path: `artifacts/av-verify/20260815T201602Z.json`
- Also: `artifacts/av-verify/20260815T202019Z.json` · `artifacts/av-verify/latest.md` (at=`2026-08-15T20:20:19Z`)
- Human / shots: `knowledge/raw/2026-08-15-3way-held-nocam-cover.md`
- Spec: `knowledge/specs/2026-08-15-3way-held-nobreak.md`
- Lane: herd `20260815T202150Z` d-link (diagnose only)
- Captured: 2026-08-15

## Original (untouched)

Human (2026-08-15 ~20:16Z), from `2026-08-15-3way-held-nocam-cover.md`:

> on android when we went 3 way video didnt freeze and didnt disconect while we were searching for 3rd, when 3rd was connected pc browser is good, laptop browser was showing pc browser but for some reason not showing android camera, its strange because pc browser and laptop browser has exactly same version of chrome but one sees android cam and the other doesnt...

Locks from that paste: laptop has no webcam; laptop↔PC works; PC good; hunt-keep held.

## 1. Client IDs (scorecard window — still valid in 201602Z and 202019Z)

| short | platform | role in this 3-way | evidence |
|-------|----------|--------------------|----------|
| `31c76917` | android | Pixel / phone | `av_path from=31c76917 platform=android` · `app_vc=412` · `bind_v=1` on primary |
| `27d2e4ab` | web | **PC / Драконов** (has cam) | `offerer=1` · one PC `fin+fout` both climbing · one PC `fin=0 fout` climbing · one PC `ice=new` |
| `53ddf52d` | web | **Laptop** (no webcam) | `offerer=0` · `ice=connected` · `frames_in` climbing · **`frames_out=0`** |

Full ids from hub `solo matched` at `2026-08-15T20:15:39Z`:

- `27d2e4ab-52b6-4e2d-b285-20819f1764b3` (offerer_a=true, platform_a=web)
- `53ddf52d-b069-4e83-bdc2-a212a85cf696` (offerer_b=false, platform_b=web)

Identity is from beacons, not names: laptop is the web client with **fout=0** (honest no-cam recv). PC is the web client that still **sends** video.

## 2. What `answers 2 < offers 3` and `web ice=new 0/0` mean

av-verify (`scripts/av-verify.sh`) counts **only**:

- `matches` = grep **`solo matched`** (does **not** count `party vs solo matched (1v2)`)
- `offers` / `answers` = grep **`first offer after match`** / **`first answer after match`**

So `matches=3 offers=3 answers=2` is **three 1v1 solo pairings** in the 8–20 min window, not a 3-way product gate. Last match in both JSON files: **web↔web** `force_relay=true` — the `20:15:39Z` line above.

**The unanswered offer (offer 3, no first-answer):**

`2026-08-15T20:15:47Z` `first offer after match SLOW from=27d2e4ab match_to_offer_ms=7726 platform=web video_dir=sendrecv`

Then the same client stays stuck (202019Z beacons, repeating):

```
from=27d2e4ab ice=new cs=new sig=have-local-offer offerer=1 frames_in=0 frames_out=0
```

Meaning: **PC created a local SDP offer and never got an answer.** ICE never left `new`. This is the counted 3rd offer. It sits on the **web↔web rematch** (PC→laptop), **not** a completed laptop→Android mesh edge.

**Two different `ice=new 0/0`s — do not collapse them:**

| who | sig | bind | meaning |
|-----|-----|------|---------|
| `27d2e4ab` PC | `have-local-offer` | n/a (web) | offer sent / local description set; **no answer** |
| `31c76917` Android **extra** | `stable` | `bind_v=0` · `v_kind=?` | `startCall2` PeerConnection exists as **answerer**; **no remote offer** ever applied |

Android extra already `ice=new bind_v=0` at **20:15:21Z and 20:15:29Z** — **18s before** the web↔web solo rematch. Phone was waiting for a 3rd-link offer while laptop still only beacons the PC recvonly PC.

Laptop `53ddf52d` in this window: **only** `ice=connected offerer=0 fin↑ fout=0`. **No** `offerer=1` beacon. Laptop never created (or never advertised) the web→Android offerer PC.

**product.ok in this scorecard is leftover 1v1, not this 3-way.** `201602Z` / `202019Z`: web fin/fout `7430/8312` → `7539/8312`, android `8104/7409`, `app_vc=412`, last match web↔web. That is PC↔Android 1v1 + PC→laptop recv. **Do not invent MULTI_PASS / 3-way product.ok.**

Hub disk `last_offer_at` is already **per `to=` pair** (`bridge/src/simple.rs` ~9357–9456). This window has **offers=3** (the 3rd offer was accepted/logged). This FAIL is **not** gotcha **40** drop (that would hide the offer). Do not re-thrash debounce.

## 3. Why same Chrome version still differs (ROLE, not Chrome build)

Hub `match_peer` (`simple.rs` ~4988–5006):

- **web vs mobile → web is always offerer**, phone answers
- same platform → `wait_started`, then `peer_id`

So:

| link | offerer | in this window | human |
|------|---------|----------------|-------|
| PC `27d2e4ab` ↔ Android `31c76917` | PC (`offerer=1`) | ice=connected, both frames, `ok=true` | PC good; phone saw PC cam (then no-cam cover — other lanes) |
| PC `27d2e4ab` ↔ Laptop `53ddf52d` | PC (`offerer=1`) | ice=connected; laptop `fout=0` recvonly | laptop shows PC |
| Laptop `53ddf52d` ↔ Android `31c76917` | **Laptop must be offerer=1** | **missing** — no laptop `offerer=1` beacon; Android extra waits `offerer=0` | laptop does not show Android |

Same Chrome build can only paint a camera if that tab has an **RTCPeerConnection to that person** with decoded frames. PC has the Android 1v1 PC (`fin+fout`). Laptop has **one** PC, to the other browser (recvonly). Chrome version is a red herring (gotcha **50** / **38**).

`ui/live.js` `handleMatched` **kickSolo** runs only when `peers.length===1` (`solo1v1`). `joinPeers` uses **per-peer** `p.is_offerer` (~32034). After `20:15:39Z` hub **`solo matched` web↔web**, laptop’s latest Matched is a **1-peer 1v1** to PC → kickSolo / keep-live-PC; **Android is not in that list**, so no second PC.

Android `startCall2` (`live.tsx` ~3128) uses `second.isOfferer`. Extra beacons are `offerer=0` — correct for mobile-vs-web. Phone will **never** send the 3rd offer. Waiting forever is the designed answerer path (gotcha **52**: do not promote answerer mid-multi).

Laptop no-cam (`fout=0`) is honest recvonly on the **PC** link. It does **not** explain a missing Android tile. Recvonly laptop can still **offer** to Android (web vs mobile) and receive Android video.

Gotcha map (read-only): **38** (laptop sees PC not Android — rematch tore / skipped 3rd PC), **40** (debounce — **not** this window), **41** (same stream on two tiles ≠ missing Android), **49** (3rd isolation / dual-browser vs phone), **52** (do not promote answerer), **54** (3rd tile ≠ ICE-up).

## 4. Exactly one recommended next hop

**File:** `ui/live.js`  
**Hop:** On 3rd-join keep-path, if a listed (or last 1v2) **mobile** peer has no `peerPcs` entry, call `joinPeers` for that peer with hub `p.is_offerer` so the laptop (web) sends the Android offer — do not stay on the single kickSolo / PC-browser recvonly PC.

## 5. MUST NOT

- ICE thrash / `MediaSession.ts` ICE / pool>0
- `force_relay` flip (same-LAN Relayed = designed FRA TURN)
- Hunt remount / unmount first RTCView / `startCall` primary rematch
- Edit `webrtc.js`, `live.tsx`, `simple.rs` on this hop (`last_offer_at` already per-target; offers=3)
- Invent `product.ok` / **MULTI_PASS** for this 3-way
- APK / `push.sh` / deploy

## Do not invent

- MULTI_PASS
- This scorecard `product.ok` as 3-way PASS
- Chrome-version theory
- “Need force_relay / TURN / pool” — TURN HOT `max_rb=930341`; media on the two **working** links is already relay→relay
