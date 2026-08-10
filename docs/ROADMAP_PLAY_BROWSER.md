# Roadmap: Play app ↔ PC browser (compatibility + polish)

**Date:** 2026-08-07  
**Lead:** Grok Build · **Scoped implementer:** Claude Code · **You:** smoke + Play installs  

## Where we are

| Layer | State |
|-------|--------|
| Match + SDP | Works when not thrashing (1 offer + 1 answer) |
| Same-WiFi media | Works after TURN lock-in + no force_relay |
| Speed | Still uneven (`match_to_offer_ms` often >> 1s) |
| Parity | Friends / stars / safety mostly present; polish incomplete |
| i18n | RU UI default; geo now localizes (Канада/Калгари) |
| Play store | Internal/local APKs only; no bulk APK on website |

**North star:** Open app + open browser → both cameras + audio in **&lt;5s** on same Wi‑Fi, **&lt;15s** cross-NAT; friends/stars feel identical on both clients.

---

## Principles

1. **Connectivity first** — never ship feature work that regresses Play↔browser A/V.  
2. **Browser is reference UX**; mobile reimplements protocol (`docs/MOBILE.md`).  
3. **One offer per match**; web is preferred offerer vs Android (`platform` on Hello).  
4. **Local APKs only** — no bulk APKs on the public site.  
5. **Dual-agent:** Grok = hub/TURN/deploy/APK/merge; Claude = scoped diffs + tests.

---

## Workstreams (prioritized)

### P0 — Connect reliability & speed (this week)

| ID | Work | Owner | Exit |
|----|------|--------|------|
| C1 | Prove `match_to_offer_ms` &lt; 2000 on same-WiFi (hub log) | Grok + you smoke | 5 green runs in a row |
| C2 | Browser `kickSoloWebRtc` hardened; no joinPeers teardown of live offer | Grok | Hub 1 offer from **web** |
| C3 | Phone answer path: PC ready before offer; promote ≤300ms if web silent | Grok / Claude | No 12s silence |
| C4 | Automated pair smoke (headless browser + emulator or two webs) | Claude | Script in `scripts/` green |
| C5 | CONNECTIVITY_LOCK regression checklist in DEVICE_SMOKE | Claude | Doc + one CI-ish script |

### P1 — Cross-platform parity (Play + browser)

| ID | Work | Owner | Exit |
|----|------|--------|------|
| X1 | Shared protocol matrix: feature × web × android (table) | Claude | `docs/PARITY_MATRIX.md` |
| X2 | Identity continuity: same `user_id` / friend code / stars on both | Grok verify | Export/import works both ways |
| X3 | Friend call: ring UI parity, miss handling, both clients | Claude | Friend call A/V &lt;10s |
| X4 | Chat + typing + gifts: one shared event list | Claude | No “works only on web” gifts |
| X5 | Geo/i18n: country/city RU (done); expand city map | Claude | Screenshot-level polish |
| X6 | Deep links: `ruletka.vip` open app live / friend invite | Grok | App Links verified |

### P2 — Play store polish

| ID | Work | Owner | Exit |
|----|------|--------|------|
| S1 | Store listing copy EN/RU, screenshots (Play) | You + Claude assets | Ready for internal testing track |
| S2 | Privacy / data safety form alignment | Grok review | Forms match actual behavior |
| S3 | Crash-free live session 15 min (Android vitals) | You smoke | No ANR / cam crash |
| S4 | Background: keep call alive + reconnect banner | Claude | Leave app 30s, media recovers |

### P3 — Platform features (after P0 green)

| ID | Work | Notes |
|----|------|--------|
| F1 | “Open on PC” QR from phone when matched/searching | Same hub, friend-code or one-shot room |
| F2 | Picture-in-picture Android during call | System PiP |
| F3 | Desktop notification when friend calls | Web + optional FCM later |
| F4 | Quality presets shared (low/mid/high) labels | Same ladder both clients |
| F5 | Federation later | Not blocking Play↔browser |

---

## Dual-agent operating model

```
You (smoke) ←→ Grok (lead: plan, hub, deploy, APK, merge)
                    ↓ task.md
               Claude (scoped: code + unit tests + docs)
                    ↓ RESULT.md
               Grok reviews + deploys
```

### Overnight admin agent (automation loop)

See `scripts/admin-agent/README.md` (v4) and `docs/AGENT_FACTORY.md`.

```
cron nightly.sh
  → hub forensics → auto-enqueue RED/YELLOW tasks
  → Claude (≤N tasks) → report
morning: ./scripts/admin-agent/morning.sh → human smoke → Grok deploy
```

Never auto-deploys unless `ALLOW_DEPLOY=1` (keep off).

**Claude rules**
- One task file under `tasks/`
- No hub deploy, no bulk APK upload
- Stay out of branding/classic UI redesign
- Prefer: `mobile/src/media/*`, `mobile/app/live.tsx`, `ui/webrtc.js`, `ui/live.js`, shared i18n/geo
- Write `tasks/<name>-RESULT.md` when done

**Grok rules**
- Own coturn, `push`/rsync, `match_to_offer_ms` forensics
- Build APKs to `mobile/artifacts/`
- Merge Claude diffs after smoke

---

## Immediate sprint (start now)

### Track A — Grok (connectivity)
1. Keep hub logging `match_to_offer_ms` + `platform_a/b`
2. Harden `kickSoloWebRtc` (already live); watch next user smokes
3. Ship APK when media path changes (`0.1.123+`)

### Track B — Claude (parallel, non-blocking)
1. **Parity matrix** `docs/PARITY_MATRIX.md` from code audit  
2. **Pair smoke script** that asserts 1 offer + 1 answer within 5s (two headless browsers or bot+web)  
3. Expand geo city map / tests if capacity  

### Track C — You
1. Install latest APK from `mobile/artifacts/ruletka-latest.apk`  
2. Hard-refresh browser after each UI deploy  
3. Report: connect time feel + both cams yes/no  

---

## Success metrics

| Metric | Good | Great |
|--------|------|--------|
| match → offer | &lt;2s | &lt;500ms |
| offer → answer | &lt;1s | &lt;300ms |
| both remote video | &lt;10s | &lt;5s |
| double-offer rate | 0 | 0 |
| Play crash-free sessions | &gt;99% | &gt;99.5% |

---

## Explicit non-goals (for now)

- Redesign classic UI / brand overhaul  
- Public APK download page  
- Full federation mesh as launch blocker  
- iOS App Store until Android↔browser is “yesterday fast”
