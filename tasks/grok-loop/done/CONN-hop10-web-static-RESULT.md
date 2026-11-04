# CONN hop10 web-kick static re-read — RESULT

**Status:** COMPLETE  
**OWN:** READ `ui/live.js` only  
**Date:** 2026-08-12  
**Code change:** none (static verify; no edit / deploy / ICE thrash)

## Goal

Verify hop10 web-kick numbers still present: **connectBudget 1100** · **inflightGrace 1100** · **GUM async**. Note residual risks. **No invent product.ok / GOAL_MET.**

## Verdict: PASS — all three on disk

| Check | Expected | Location | State |
|-------|----------|----------|-------|
| pure offerer connectBudget | **1100** | `ui/live.js` ~27126 | **PASS** `purePath ? 1100 : 750` |
| hybrid offerer connectBudget | 750 | same | PASS |
| answerer connectBudget | 1800 | same | PASS |
| force_relay inflightGrace | **1100** | ~10348 | **PASS** `msg?.force_relay ? 1100 : 400` |
| hybrid inflightGrace | 400 | same | PASS |
| offerer cold GUM | **async SDP-first** | ~26728–26751 | **PASS** `void getUserMedia(...).then(...)` — no await before connect |
| answerer GUM | short race | ~26752–26771 | PASS race **220** ms (unchanged hop10 intent) |
| empty-cam offerer proceed | empty transceivers | ~26789–26792 | PASS log + `stream = null` |

### Evidence (line refs)

**1. inflightGrace 1100 (armOfferKickWatch)**

```
// In-flight without local yet: pure force_relay must cover first-relay
// wait (webrtc ~520+350) + offerer connectBudget (~1100). hop10 grace
// 1100 (was 700) so offerKick does not tear mid-pure gather. Hybrid 400.
const inflightGrace = msg?.force_relay ? 1100 : 400;
```
Path: `/home/drakosik/freenet-roulette/ui/live.js` ~10344–10348

**2. connectBudget 1100 (kickSoloWebRtc)**

```
// Hop10 connect: pure force_relay offerer 1100ms (≥ pure wait ~870 + slack);
// hybrid offerer 750; answerer 1800. Free ASAP when emit already ok.
const purePath = !!(msg && msg.force_relay);
const connectBudgetMs = iOffer ? (purePath ? 1100 : 750) : 1800;
```
Path: `/home/drakosik/freenet-roulette/ui/live.js` ~27121–27126  
Emit-ok poll frees before full budget (~27167–27180); budget finish frees `_offerInFlight` + match locks when no emit.

**3. Offerer GUM async (kickSoloWebRtc)**

```
// Hop10 offerer: do NOT await cold GUM before connect — SDP-first empty
// transceivers; GUM resolves in background and pushOutboundVideoTracks later.
if (!live && iOffer) {
  // Fire GUM async — never block match→offer on cam
  void navigator.mediaDevices.getUserMedia(gumConstraints).then(...)
  stream = previewStream || null;
}
// Offerer: proceed even without media (transceivers in connect). Cam attaches later.
```
Path: `/home/drakosik/freenet-roulette/ui/live.js` ~26696–26792

## Residual risks (static — not fixed this job)

1. **Empty-cam offer window** — offerer may emit SDP before GUM resolves; partner sees no video until `pushOutboundVideoTracks` after attach. Hung/denied GUM → prolonged one-way until heal/re-push.
2. **Budget still race vs pure gather** — hop10 aligns grace+budget to ~1100 vs webrtc pure wait ~520+350≈870; p99 gather beyond 1100 can still free mid-path (offerKick re-kick / hard rebuild belt).
3. **Answerer still serial short GUM** — 220 ms race (not SDP-first); hung camera still costs up to that + fallback 400 ms preview race.
4. **Speed residual unchanged** — hop10 is reliability (less tear mid-pure gather), not mto/mta GOAL_MET. Prior residual targets (**mto 1264 / mta 2700**) not re-measured here.
5. **Ship pin / hard-refresh** — disk has hop10 logic; prod must load the pinned `live.js?v=…` (wiki historically **569** for hop10) — static re-read does **not** curl prod or claim ship live.
6. **No product.ok** from this job — needs human/device smoke after hard-refresh, not static grep.

## Must-not confirmed

- **No edit** to `ui/live.js` (or any code)
- **No deploy**
- **No ICE thrash** / pool change / MediaSession / webrtc.js touch
- **No product.ok / GOAL_MET** invented

## Job complete

RESULT filed. Running card → `tasks/grok-loop/done/06-CONN-web-kick-static.md`.
