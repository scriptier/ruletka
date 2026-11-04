---
title: 3-way look then Courtier frozen (030415Z → 030650Z)
date: 2026-08-15
slug: 3way-look-then-frozen
source_type: screenshot
source_url:
source_path: artifacts/shots/20260815T030415Z-3way-look-pc.png
captured_by: agent
skill: add-new-resource
binary_inlined: false
---

# Raw: 3-way look then Courtier frozen

## Source
- Type: screenshot
- Paths:
  - `artifacts/shots/20260815T030415Z-3way-look-pc.png`
  - `artifacts/shots/20260815T030415Z-3way-look-phone.png`
  - `artifacts/shots/20260815T030421Z-cdp-3way-look.png`
  - `artifacts/shots/20260815T030645Z-courtier-frozen2-pc.png`
  - `artifacts/shots/20260815T030645Z-courtier-frozen2-phone.png`
  - `artifacts/shots/20260815T030650Z-cdp-courtier-frozen2.png`
- Captured: 2026-08-15
- Pins: live.js **649** · webrtc **331** · APK on those shots **0.1.394 / vc402** (keepFirstOnOmit hop **0.1.395 / vc403** not yet smoked)

## Description (for search without opening binary)

### 030415Z / 030421Z — “look at 3way”

- **PC:** 3-col Courtier | Laptop no-cam | Dragonov self **live** (eating banana). Courtier looking at ceiling — face visible, not yet the later still. Banner “You + friend · stranger on the right”. Relay Same Lan. Leave 3rd visible.
- **Phone:** **idle Start**. “Your camera · 3 online · tap Start”. LAST CHAT Partner 10m. No-cam brand + leftover “Talking with microphone · Partner”. Self PiP (hand). **Not in the 3-way.**
- Sequence: phone already left (or spun to lobby) while PC still shows 3-col.

### 030645Z / 030650Z — same shit frozen

- **PC:** same 3-col names Courtier | Laptop no-cam | Dragonov. Left tile **frozen last frame** (hand raised). CDP: remote t stuck, teammate ice=disconnected cs=failed, unique=2.
- **Phone:** **1v1** (not split). No-cam Partner ★0 + self PiP of ceiling. Cam local only; not on PC left tile.

## Original

Binary not inlined. Open `source_path` files. Thin earlier sidecar: `raw/2026-08-15-3way-courtier-frozen2.md` (030650Z only). Do not edit that file.

## Agent notes (not product.ok)

Herd `20260815T031653Z` a-diagnose: hub 3rd-join Matched often `peers=[Laptop]` only → old `pickPrimaryPeerIndex` returned 0 → Android remounted Laptop as primary → tore Courtier PC.

Also: 030415 phone **Start** while PC still 3-col = possible lobby-spin / partner-left before the remount. keepFirstOnOmit does not help if phone already left.

Disk hop (not smoked): `pickPrimaryPeerIndex` `-1` + `live.tsx` keep prevPrimary. APK **0.1.395 / vc403**. **no MULTI_PASS.**
