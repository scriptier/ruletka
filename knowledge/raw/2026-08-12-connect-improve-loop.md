# Raw: connect improve loop synth — 2026-08-12

## What

CONN-L5 director synth for freenet-roulette connect/linking improve loop.

## Baseline (av-verify)

- Stamp: **2026-08-12T04:48:52Z** · window 10m  
- **verdict=WARN** · **product=one-way** · web HOT 62634/62634 · **android 0/0**  
- No android av_path beacons · app_vc/bind_v null · dual-web pairs dominate journal  
- TURN HOT (max_rb≈499k, err_437=0) · answers 2 &lt; offers 3 · mto 1999 / mta 3368  
- Last match web↔android force_relay=true (scorecard cut ~2s after offer)

## Harvest (Grok L1–L4 COMPLETE)

| Sibling | Headline |
|---------|----------|
| L1 diagnose | NEXT_ROLE **android-answer**; not turn-media |
| L2 web-kick | connectBudget vs pure wait · GUM parallel · inflightGrace · pin **live.js?v=568** · paint-first |
| L3 android | triage A vs B · tip APK **0.1.370-vc378** · av_path interval gap · policy=all→relay · early kick |
| L4 hub-turn | media **HOT** freeze; answers&lt;offers = dual-web + phone silence; NEXT_ROLE **client-ice** |

Claude 450–452 still **PENDING** (session).

## Plan output

- `knowledge/specs/CONNECT-IMPROVE-PLAN.md`  
  - **P0** phone av_path smoke (vc378 + live.js?v=568)  
  - **P1** client-ice android answer/beacon  
  - **P2** early answer kick  
  - **P3** policy=all→relay  
  - **P4** hop10 web-kick reliability after product.ok  
  - **P5** hub log-only (no coturn restart)  
- GOAL_MET only product.ok or human faces · no deploy · no invent multi/blur PASS  

## Same-day contrast

Earlier product.ok windows exist (hop9 residual mto 1264/mta 2700; L19e app_vc=375). Baseline is a later window without phone A/V proof + dual-web pollution — not a free re-open of the 2026-08-10 one-way thrash saga.
