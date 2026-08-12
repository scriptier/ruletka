# Raw: product.ok achieved 2026-08-10

## Scorecard
- at ~22:14Z av-verify PASS product=ok
- app_vc=305 bind_v=1 hub_fr=1 force_relay=1 policy=relay
- web fin/fout=1288/1537 android fin/fout=160/62

## Ship path that worked
1. Sticky hub force_relay + closeCall keepLocal keep sticky (296)
2. bindAnswerOutbound m-line (earlier)
3. encodings.active + fresh GUM dead encoder (297)

## Linking latency still slow
- mto ~1.7s mta ~3.8s on pure path → new spec current-linking-speed.md
