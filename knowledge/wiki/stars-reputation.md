# Stars + reputation (self-governing)

**Status:** concept — hub already implements peer praise / consensus reports. **Unverified** as product feel. No invent GOAL_MET.

Code: `bridge/src/star_ledger.rs` · `bridge/src/simple.rs` (`effective_trust_for`, `social_health_for`, `report_weight_against`) · UI sheet `ui/live.html` stars panel.

Raw: [`../raw/2026-08-22-stars-self-gov.md`](../raw/2026-08-22-stars-self-gov.md)

## Two ledgers (do not mix)

| | **Wallet ★** | **Trust / social health** |
|--|----------------|---------------------------|
| Earn | Hour bonus (+1 at 60 min), admin, some gifts | **Peer praise only**: post-chat `mint:rate_partner` and live `gift:*` |
| Spend | Hearts / bars / fireworks / Please stay | Not spendable |
| UI trap | Partner tile ★ is `max(stars, trust)` (gotcha **13**) | Looks like wallet |

Hour bonuses **must not** raise trust. Profile export **never** includes stars (hub account).

## Tiers

| Label | Effective trust | Unique gifters | Role |
|-------|-----------------|----------------|------|
| Normal | &lt; 100 | — | Post-chat gift cap **1** · report weight **1** (underage) |
| Trusted | ≥ **100** | ≥ **5** | Gift cap **2** · shield +1 ban-score · UI weight 2 |
| Senior | ≥ **250** | ≥ **12** | Gift cap **3** · shield +3 · UI weight 3 |

Gifter floors **cap** effective trust: one friend cannot mint Senior. Soft idle decay after **45d** (max 50% by 180d).

**Social health** = effective trust − bars stigma (received, 3/peer cap 30) − bars tax (given, 1/peer cap 15). Bars spam → 7d social-force mute.

## Reports (self-gov, not star-jury)

| Reason | Unique reporters | Ban |
|--------|------------------|-----|
| underage | **1** | 30d · **full** tier weight |
| explicit / hate | **3** | 90d / 14d |
| spam / scam | **4** | 7d |
| other | **4** | 3d |

**Lock (brigade v3):** Count only **★≥5** or **praise from ≥2 gifters**. Same IPv4 **/24** = 1 vote. Still 1 each, no ×2/×3. Explicit/hate: **3 clusters**. Mutual feud = 0. Raid spike → no permanent.

Trusted/Senior **shield** the *target* (harder to auto-ban), they do not get extra non-underage votes.

## Match

Queue soft-ranks by `social_health` (`entry_trust`). Not a hard gate. Not advertised in chrome.

## Why it doesn’t feel like a community

1. **Praise is skippable** — Next without post-chat ★ → trust stays 0 → no tiers.
2. **Chip is opaque** — `max(wallet, trust)` hides Praised-by-N.
3. **Report is a void** — no “N people flagged” until a ban.
4. **Senior power is rank + shield + gift cap**, not a ban hammer. UI must say that.

## MUST NOT

- Star-weighted auto-ban for “don’t like them” / explicit / hate (re-opens brigades).
- Count hour bonus as trust.
- Invent Trusted/Senior PASS from wallet ★.
- Ban from a single non-underage report.

## Recommended next (unverified)

1. **Shipped web 935/623:** partner tile **Trusted / Senior** only when trust + unique gifters (100/5 · 250/12). Praised-by chip already on. New/Known not shown.
2. Android HUD dock (`PartnerIdentityDock`) still needs `trustGifters` wire — PartnerChrome path unused on live.
3. Later: soft queue deprioritize after 3 unique non-underage reports — **not** a ban.

### Log

- 2026-08-22: herd `20260822T233257Z` — web **921/619**: praise chip stays on autohide; rate Skip quiet; toast they praised you. Android rate Skip ghost; PartnerChrome compact praised-by (HUD dock not wired — no live.tsx this hop). **Unverified** feel. No site APK.
- 2026-08-22: director interview; hub already peer-praise + consensus + shields. Feel gap = skippable praise + opaque chip. Hop **not shipped**.
