# 781 — Hub gift-grant second critic (read-only)

## Status: FAIL (not shippable as-is — backend half of the feature is missing)

The goal was to confirm "crown 5/12, nice gifts mint ★1 wallet (not trust), bars/fence
do not mint" in `bridge/src/simple.rs` + `bridge/src/star_ledger.rs`. None of the
wallet-mint machinery for mid-match gifts exists in `bridge/src/simple.rs` yet. The
client (`mobile/src/stars/gifts.ts`) and the repo's own test
(`ui/gift-kinds.test.mjs`) already assume this backend work landed; it hasn't.

## Per-check results

### 1. Crown 5/12 — FAIL
`normalize_effect_kind` (`bridge/src/simple.rs:1519-1533`) has no `crown`/`crowns`/`king`
arm, and `effect_cost_duration` (`bridge/src/simple.rs:1536-1543`) has no `"crown" =>
(5, 12)` arm. `handle_spend_stars` (`bridge/src/simple.rs:1668-1687`) rejects any
unrecognized `effect` with `ok:false, message:"unknown effect"` before any cost/ledger
logic runs. A crown gift sent by a client is a no-op on the hub.
Meanwhile `mobile/src/stars/gifts.ts:37` already ships
`{ id: "crown", cost: 5, grantsStar: true }` — client/server drift.

### 2. Nice gifts mint ★1 wallet (not trust) — FAIL
There is no minting anywhere in the gift-spend path. `handle_spend_stars` only calls
`self.ledger_spend(&me_uid, &to_user_id, cost, &reason, ...)` with
`reason = format!("spend:{kind}")` (`bridge/src/simple.rs:1869-1877`), which **burns**
the spender's balance via `StarLedger::spend`. There is no `mint`/`mint_from`/`adjust`
call anywhere in this function or its helpers for flowers/balloons/confetti/heart/
fireworks/please_stay. No `fn gift_grants_wallet_star` exists in `simple.rs` at all
(`rg gift_grants_wallet_star bridge/src/simple.rs` → no matches). Recipients of "nice"
gifts get nothing credited today.

### 3. Bars/fence do not mint — PASS (trivially), but fence is not first-class — FAIL
Nothing mints for any kind right now, so bars/fence trivially "don't mint" — but that's
because the whole mint path is absent, not because of a bars/fence-specific guard.
Separately, `fence` is **not** its own effect kind: `normalize_effect_kind` maps
`"bars" | "jail" | "fence" => Some("bars")` (`bridge/src/simple.rs:1521`), so a fence
gift is indistinguishable from bars server-side — same cosmetic effect string
`"bars"`, same duration, and it feeds the same `record_bars_stigma_edge` /
`maybe_flag_bars_abuser` punitive-stigma accounting (`bridge/src/simple.rs:2021-2026`).
That contradicts the fence-specific UI/CSS/i18n assets already shipped in
`ui/live.js`, `ui/live.html`, `ui/live-stage.css`, `ui/i18n/en.json`.

### 4. `is_trust_mint_reason` (star_ledger.rs) — PASS as written
`bridge/src/star_ledger.rs:27-34` correctly restricts trust bumps to
`"mint:rate_partner"`, `*:rate_partner` suffix, literal `"rate_partner"`, or
`admin:trust*` reasons, and only fires on `KIND_MINT`/`KIND_ADJUST` events
(`bridge/src/star_ledger.rs:681-686`) — a `spend` event can never raise trust. Existing
unit test `mint_spend_roundtrip_and_idempotent_op`
(`bridge/src/star_ledger.rs:747-798`) exercises exactly this: a plain `"test_mint"`
mint doesn't move trust, a `"mint:rate_partner"` mint does, and a subsequent spend
doesn't burn trust. This part of the ledger is sound in isolation. Flag for whoever
implements gift-mint: pick a reason string for the future `gift:{kind}` wallet mint
that does **not** end in `:rate_partner` or equal `rate_partner`, or it will
accidentally start minting trust (e.g. `is_trust_mint_reason` is a substring/suffix
check, not an allowlist of exact known reasons).

## Smoke: 3 spends (traced via code, no live server — read-only task, no build/deploy authorized)

| kind | normalize_effect_kind | Result |
|---|---|---|
| `crown` | `None` | Rejected: `ok:false`, `"unknown effect"`, cost 0, nothing touches the ledger. |
| `shooting_star` | `None` | Rejected: `ok:false`, `"unknown effect"`, cost 0, nothing touches the ledger. |
| `bars` | `Some("bars")` | Accepted: cost/duration = default `(5, 15)` (`EFFECT_COST_STARS`/`EFFECT_DURATION_SECS`, `bridge/src/simple.rs:1516-1517` — not the crown 5/12 pair). `ledger_spend` burns 5★ from spender, reason `"spend:bars"`. No mint to anyone. Bars stigma edge recorded against the target. Internally consistent (spend-only) but shares its code path with `fence`. |

## Automated check

Ran the repo's own gift-kinds contract test against current source:

```
node ui/gift-kinds.test.mjs
```

7 of the failures point directly at `bridge/src/simple.rs` (the file in scope here):

```
FAIL hub must not alias fence to bars
FAIL hub fence first-class
FAIL hub credits +1 wallet via gift:{kind}
FAIL hub grants helper
FAIL bars/fence no ★1
FAIL hub crown aliases
FAIL hub crown 5/12
```
Exit code 1. This independently confirms the code-reading findings above — this isn't
an interpretation call, the checked-in test for this exact feature is red.

## Files touched
None (read-only per task scope). Only this RESULT file was written.

## Verify commands run
- `node ui/gift-kinds.test.mjs` (fails, 7 relevant assertions — see above)
- Manual read of `bridge/src/simple.rs` (normalize_effect_kind, effect_cost_duration,
  handle_spend_stars, broadcast_star_effect) and `bridge/src/star_ledger.rs`
  (`is_trust_mint_reason`, `mint`/`mint_from`/`spend`, unit tests)
- Manual read of `mobile/src/stars/gifts.ts` for client-side expectations

## Connect risk: none
No ICE/pool/offer/TURN code touched or read beyond scope; no product code edited.

## Recommendation
Do not ship "mid-match gifts" as safe yet — the wallet-mint half (crown gift,
`gift_grants_wallet_star` helper, `format!("gift:{kind}")` mint call, fence-as-
first-class) does not exist in `bridge/src/simple.rs`. Route back to implementation
before this task can pass a safety critic; re-run `node ui/gift-kinds.test.mjs`
(should exit 0) as the done-criterion once it lands.

COMPLETE
