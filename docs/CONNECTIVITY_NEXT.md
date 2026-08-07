# Connectivity plan — **P2P first** (SFU shelved)

**Date:** 2026-08-07 (updated)  
**Product decision:** Stay **peer-to-peer**. SFU/LiveKit is **not** the default path.  
Optional SFU remains a **future** scale/reliability option only if P2P stays broken after root-cause fixes.

## Why phone saw no browser camera (likely)

Hub proved **offer + answer + audio both ways** and **phone→browser video**.  

Browser UI still showed **your real local preview** while **Hide / sticky stranger hide** can replace **outbound** video with a **black canvas track**:

- Local tile = real cam (CSS / canvas for *you*)
- Peer (Play app) = **black “video”** → feels like “no conversationalist camera”

Sticky auto-hide on every stranger match made this the default after one Hide press.

**Fix shipped:** stranger matches **force real camera outbound** unless settings opt-in `hideFromStrangersDefault` (default off). Hide still works mid-call, but does not auto-stick across matches.

## P2P rules (keep)

See `docs/CONNECTIVITY_LOCK.md`:

- Host coturn, no always-on force_relay  
- One offer per match  
- Web preferred offerer  
- No second non-restart offer thrash  

## Still improve on P2P (without SFU)

| Issue | Approach |
|-------|----------|
| Slow match→offer (~10–25s) | Warm cam before Start; single kickSolo; measure hub MTO |
| One-way video | Real outbound tracks; Android RTCView repaint (0.1.125+) |
| Rematch thrash | Don’t spam Next; fix double-offer at source |

## SFU / LiveKit

**Not enabling.** Files under `deploy/livekit/` and `ui/livekit-media.js` are **experimental only** — do not install for production unless product decision changes.

## Smoke checklist

1. Hard-refresh browser (Ctrl+Shift+R)  
2. Install APK **0.1.125+**  
3. Confirm browser **Hide** is off (no “hidden” badge on self)  
4. Match once, wait 15s, no Next spam  
5. Both cameras both ways  
6. `./scripts/hub-match-speed.sh 30` — 1 offer + 1 answer, few drops  
