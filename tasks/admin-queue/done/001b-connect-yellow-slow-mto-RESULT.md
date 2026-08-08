# 001b RESULT — Residual slow match→offer (YELLOW)

**COMPLETE**

## Fresh hub evidence (2026-08-07)

| Sample | MTO | Notes |
|--------|-----|--------|
| web↔web | 472–861ms | healthy |
| web↔android | 258–1276ms | healthy first path |
| web↔android | **24175ms**, **24266ms** | first accepted offer only after hard rebuild |
| drops | age_ms ~789–827 | second offer thrash (pre-fix client) |

## Root-cause class

**True first-offer stall** (not rematch accounting bug):

1. `armOfferKickWatch` returned early when `__ruletMatchOfferLock` was set **without** any local SDP / emitOk.
2. Lock was set at start of `_createAndSendOffer` before `createOffer` resolved; if createOffer hung or never emit, offerKick never recovered → hard watch ~24s → first logged MTO ~24s.
3. Hub MTO only logs first *accepted* offer; `last_offer_at` reset on rematch is correct.

Secondary: mid-offer re-kick clearing `offerSentOnce` after successful emit (fixed earlier session).

## Fix landed (this pass)

| File | Change |
|------|--------|
| `ui/live.js` | offerKick trusts **real SDP/emitOk only**; clears stale lock; re-kick at 1s/2.2s/4.5s |
| `ui/webrtc.js` | 2.5s createOffer hang frees locks for offerKick |
| `bridge/src/simple.rs` | log `SLOW` when MTO ≥ 3s |

Did **not** re-enable force_relay / docker coturn / multi-offer spam.

## Connect risk

**Low–medium** — only recover path when first offer never left wire; healthy path unchanged.

## Deploy

Ship with connect speed batch (user authorized proceed).
