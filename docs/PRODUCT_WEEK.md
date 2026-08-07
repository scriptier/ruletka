# Product week plan (liquidity first)

**North star:** weekly users who complete ≥1 real match **or** ≥1 friend call.

Supporting: alone% (`alone_joins / queue_joins`), wait time, friend rings → calls.

## This week (P0) — mobile shipped 0.1.74–0.1.76

| Work | Done when | Status |
|------|-----------|--------|
| Invite funnel instrumented | Events: `funnel_invite_share` → land → request → connected | **Mobile 0.1.74** + hub `/v1/funnel` |
| Empty pool = one Share CTA | Dominant invite on Home / alone queue | **Mobile 0.1.74–75** |
| Homepage busy hours + quiet CTA | Quiet → Invite; busy (2+ wait) → Start | **Mobile 0.1.75** |
| Admin north star strip | Alone %, matches, friend calls, kill-polish tip | **Web admin** (glance-north) |
| Notif opt-in after Accept | One-shot enable call alerts | **Mobile 0.1.76** |

## Do not ship this week

- Lottie gifts, multi-hub stars, more themes, IAP, soft-popup onboarding
- Extra admin charts until peak_online regularly > 10

## Kill criteria

If after **7 days** of real traffic:

- alone% still ≥ 50% **and**
- friend_calls + call_rings stay **0**

→ stop product polish; change **acquisition** (one channel, fixed live windows) or the friend loop UX.

## How to read admin

1. **Alone pool %** — red ≥ 60%
2. **Friend calls** — should leave 0 once people return
3. **North star strip** — sessions = matches + friend_calls today
4. Client funnel (analytics / YM if configured): share → land → request → connected

## Operator checklist (you)

- [ ] Pick 2–3 fixed evening slots (local) and be online with 1–2 real people
- [ ] Run full Path A in [`LIQUIDITY_TEST.md`](LIQUIDITY_TEST.md) (share → land → Accept → Call)
- [ ] Confirm admin `/health` → `metrics_today.friend_calls` ≥ 1 and `call_rings` ≥ 1
- [ ] After each deploy: hard refresh once (or SW **Reload**); confirm `live.js?v=` in Network matches deploy

**Hub snapshot tip:** `curl -sS https://ruletka.vip/health | jq .metrics_today`

## Week 2 (return path) — shipped

| Work | Behavior |
|------|----------|
| Post-match Add friend | **Always** toast (not SOFT_POPUPS-gated), ≥8s chat, primary **Add friend** |
| After Add | “Request sent → Accept → Call” step + open Friends |
| Friend online toast | Only if **Call** is possible; whole toast rings |
| Friend accept toast | Call button when partner already online |
| History | Online = big Call back; offline = Offline hint |

## Next (only if rings/calls still 0 after real tests)

- One fixed live window with 2–3 people; measure admin friend_calls
- Optional: browser notif opt-in after first Accept
- Still no Lottie / multi-hub until alone% or friend funnel moves

## Week 3 (missed-call defense) — shipped

| Work | Behavior |
|------|----------|
| Notif opt-in | After first friend Accept → “Enable alerts” (one-shot) |
| Pref | Same toggle: **calls + friends online** |
| Background ring | OS notif + re-notify while ringing; vibrate; title flash; focus Answer on return |
| Admin | North star notes rings-without-answers |

## Still parked

Lottie, multi-hub stars, more admin charts until peak_online regularly > 10 **and** friend_calls > 0.

## Week 4 (close the Call loop) — shipped

| Work | Behavior |
|------|----------|
| Outbound call toast | “Calling…” + **Cancel** (`call_cancel` on hub) |
| No answer / declined | Toast + **Call back** if still online |
| Missed call banner | In-app Call back when free (24h) |
| Report certainty | Extra “won’t match again” after Report |


## Week 5 (measure + missed-call priority) — shipped

| Work | Behavior |
|------|----------|
| Admin 7-day trends | Alone % / matches / friend calls / rings bar strip |
| Operator checklist | Fixed on glance (liquidity test steps) |
| Missed peer online | Priority “Call back now” toast + OS notif |

**Stop building features** until a real two-person session moves `friend_calls` or alone %.

## Engineering wrap (2026-08) — shipped, not more product

| Track | Status |
|-------|--------|
| Stars A–D, gift FX | Live |
| Hide IP + relay A/V | Live |
| No-account export/import + Web Share + QR | Live |
| Deploy never wipes `data/` / `backups/` | Live (`push.sh`) |
| TURNS/443 | Deferred (coturn 3478 only) |
| Lottie / multi-hub / IAP | Still parked |

**Operator (you):** fixed evening slots + one full friend invite → Accept → Call. That is the remaining “finish,” not more UI.

