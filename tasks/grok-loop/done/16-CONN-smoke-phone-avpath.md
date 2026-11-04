# CONN: phone+PC smoke for android av_path (verify-only)

## Goal
CONN-after-MX was **WARN / one-way** with **no android av_path** (web↔web only). NEXT_ROLE=**smoke**. Get phone in a match ≥20s with PC; re-run av-verify. Honest only — no invent product.ok.

## OWN
- Phone exclusive one adb: prefer `-s 192.168.1.94:42227` (wireless; USB may no-permissions)
- RUN: WebPair or manual PC Start + phone Start; then `./scripts/av-verify.sh --min 10`
- RESULT: `tasks/grok-loop/done/CONN-smoke-phone-avpath-RESULT.md`
- Read-only product code

## Work
1. adb devices / connect wireless if needed; confirm package tip (expect ~0.1.373-vc381 post-MX)
2. Settings OK; Start match phone ↔ PC same-WiFi force_relay pure ≥20s
3. av-verify --min 10; require android av_path present? app_vc? fin/fout?
4. Artifacts note under artifacts/av-verify/ (script writes latest.*)
5. If no device BLOCKED honest

## Must not
- edit MediaSession/live.js (Claude 450 may be reading)
- deploy / invent multi PASS / invent product.ok beyond scorecard
- pool>0

## Done
RESULT with verdict, product, android av_path?, NEXT_ROLE
