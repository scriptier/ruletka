# Hub gift-grant second critic (read-only)

## Goal
Confirm hub mid-match gifts are safe to ship: crown 5/12, nice gifts mint ★1 wallet (not trust), bars/fence do not mint.

## OWN
- READ `bridge/src/simple.rs` gift spend / normalize / grant
- READ `bridge/src/star_ledger.rs` `is_trust_mint_reason`
- WRITE only `tasks/admin-queue/done/781-hub-gift-grant-critic-RESULT.md`

## Must not
- Edit product code
- Deploy / APK / ICE / pool / push

## Done
RESULT: PASS/FAIL per check + smoke 3 spends (crown, shooting_star, bars). COMPLETE when written.
