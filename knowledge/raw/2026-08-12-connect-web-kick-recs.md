# Raw: CONNECT web-kick recommendations (2026-08-12)

Source task: `tasks/grok-loop/done/CONN-L2-web-kick-RESULT.md`  
Lane: link-web-kick · PC web only  
Status: recommend-only (no code ship this hop)

## Residual cited

- Hop9 product.ok window: max_mto **1264** · max_mta **2700** · product **ok**
- Live sample (scorecard context): mto **1426** · window max_mto **1999** · android missing av_path · product one-way (not hop9 ok)
- Disk: `live.js?v=568` · `webrtc.js?v=315`
- Spec: no pool&gt;0 · no pure-wait cut without product.ok · no invent GOAL_MET

## Ranked 7 (summary)

1. **Align offerer connectBudgetMs ≥ pure worst first-relay** (~750 vs 520+350≈870) — `kickSoloWebRtc` ~27049 — reliability / p99 mto — hard-refresh  
2. **SDP-first: parallel cold GUM** (don’t await 280ms) — `kickSoloWebRtc` ~26650 — mto −0–280 cold — hard-refresh  
3. **offerKick inflightGrace align with budget** (force_relay 700→≥connect budget) — `armOfferKickWatch` ~10296 — less tear mid-gather — hard-refresh  
4. **Hard-refresh pin tip 568/315** before more surgery — `live.html` — unlock hop6–9 — hard-refresh / human deploy if CDN lag  
5. **Paint-first ontrack → paintFirst + frames watcher** (toast still frames-gated) — feel −100–400ms — hard-refresh  
6. **Don’t force-restart pure warm ALLOCATE mid-kick** when same-policy in flight — handleMatched warm ~25540 — warm mto — hard-refresh  
7. **offerKick two-phase: early re-emit only; tear after pure window** — armOfferKickWatch — thrash / answers&lt;offers — hard-refresh  

## Belts

No pure budget cut · no pool&gt;0 · no MediaSession · no GOAL_MET without re-smoke product.ok.
