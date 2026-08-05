# Two-person liquidity test (friend_calls)

**Goal:** move admin **friend_calls** (and rings) off zero with a real session — not more product polish.

## Before you start

1. Hard-reload **both** browsers after every deploy (`live.js?v=` in Network tab must match the latest ship).
2. If you see **Update available** → **Reload** (safe when not mid-call).
3. Use **two devices** or two browsers (not two tabs of the same identity — one tab kicks the other).

## Path A — Friend invite (preferred for product week)

| Step | Person A (host) | Person B (guest) |
|------|-----------------|------------------|
| 1 | Open `https://ruletka.vip/live.html` · accept 18+ · allow cam | Same |
| 2 | Settings / Friends · note **your friend code** | — |
| 3 | Empty card: **Share invite · I’m live** (or copy link `live.html?friend=CODE`) | Open the link |
| 4 | — | Auto: Friends opens · request sends when hub connects |
| 5 | Friends → **Accept** request | — |
| 6 | Either side: **Call** when other shows Online | Answer |
| 7 | Talk ≥30s · hang up | — |

**Done when:** Admin shows `friend_calls` ≥ 1 (and ideally a `call_ring` first).  
Client events (if analytics on): `funnel_invite_share` → `funnel_invite_land` → `funnel_invite_request` → `funnel_invite_connected`.

## Path B — Stranger match (pool liquidity)

| Step | A | B |
|------|---|---|
| 1 | Both on live · same hub | Both |
| 2 | **Start** | **Start** within ~30s |
| 3 | Match · chat ≥8s | Same |
| 4 | Optional: **Add friend** on last-partner popup | Accept later |

**Done when:** Admin **matches** today ≥ 1.

## After deploy (always)

```text
1. Deploy UI/bridge
2. Hard reload (or SW “Reload”)
3. Confirm Network: live.js?v=… and live-stage.css?v=… are the new numbers
4. Run Path A once with a real second person
```

## If friend_calls stay 0

- Same identity opened twice → second tab disconnected (use two profiles).
- Guest never Accept’d · host never Called.
- Hub offline / wrong host (check Settings → hub).
- Fix **people + fixed evening slots**, not more UI chrome.
