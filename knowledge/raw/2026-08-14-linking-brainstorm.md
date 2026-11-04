# Raw: P2P + linking-speed brainstorm — 2026-08-14

**Director:** Grok after iOS-audio herd + human ask “improve connection + linking speed; fire agents.”  
**Not:** product FAIL · linking GOAL_MET · APK · deploy · MediaSession hop

## What we already know (do not re-thrash)

| Fact | Evidence |
|------|----------|
| A/V **works** same-WiFi pure | `av-verify` **product.ok** `20260812T193821Z` web 4372/5038 · android 5021/4371 · app_vc **383** · fr_mismatch false |
| Speed **not** GOAL_MET | that stamp max_mto=**1498** / max_mta=**2685** (wiki still cites older 1895/3122) |
| Stretch | mto &lt;800 warm / &lt;1500 pure · mta &lt;2500 |
| Hop10 on disk | `connectBudgetMs` 1100 pure offerer · inflightGrace 1100 · GUM async SDP-first |
| Hop11 wait already below old floor | `relayWaitBudgetMs` **480** pure / **300** hybrid (plan said do not cut &lt;520 without re-smoke) |
| Android EARLY kick | `live.tsx` `startCall EARLY` answerer-fast already |
| pair-smoke false FAIL | `ROULETTE_TURN=off` + same-IP `force_relay` → wire 0/0 (gotcha 24) |
| Phone smoke older | `064214Z` mto 1895 / mta 3122 · still product.ok |

## Brainstorm — where time actually goes

```
match → web kickSolo (GUM/SDP) → first typ relay wait → emit offer (mto)
      → android startCall EARLY → setRemote → bindAnswer → createAnswer
      → answer relay wait → emit answer (mta)
      → ICE + first frames (feel)
```

| Bucket | Typical | Lever | This hop? |
|--------|---------|-------|-----------|
| Web offer gather / first relay | 0.5–1.5s pure | already 480ms cap + early-exit | **No more cut** |
| Android answer serial (bind + answer) | ~1.2–1.5s of mta−mto | MediaSession bind await (product.ok belt) | **No** — one writer + smoke |
| Kick / emit race | hop6–10 | hop10 on disk | static reconfirm only |
| **Feel** after match UI | paint-first | live.js | later, not this hop |
| **Harness lies** | pair-smoke 0/0 | TURN=off | **YES — fix** |
| Wiki stale residual | 1895/3122 | compound 1498/2685 | **YES** |
| iOS Safari audio | crackle/delay | just shipped 574/317 | separate · unverified |

## Prefer / avoid (next 2 hops)

**Prefer**
1. Honest harness (gotcha 24) so agents stop “fixing” fake 0/0.
2. Compound latest product.ok **1498/2685** — closer to stretch than morning wiki.
3. Static reconfirm hop10/11 survived iOS `webrtc.js` sampleRate gate.
4. Human hard-refresh + one phone match → new av-verify before any budget/MediaSession hop.

**Avoid**
- Cut `relayWaitBudgetMs` again (already 480).
- Dual-write MediaSession + live.js.
- pool&gt;0, dual-offer, sticky wipe, SFU.
- Invent linking GOAL_MET from this brainstorm.

## Herd this turn

`link-harness` · `link-wiki` · `link-spec` · `link-static` — no MediaSession, no live.js, no webrtc.js.
