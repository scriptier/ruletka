# Connect debug kit (Play ↔ browser)

**Goal:** Know in **&lt;15 minutes** if a change broke matching, ICE, or first video.  
**Lock:** [`CONNECTIVITY_LOCK.md`](./CONNECTIVITY_LOCK.md) — do not “fix” thrash with dual-offer.

---

## What “good” looks like

| Check | Good |
|-------|------|
| Hub offers / match | **1 offer + 1 answer** (web usually offers vs Android) |
| `match_to_offer_ms` (warm) | **&lt; 400 ms** target; investigate if p95 &gt; 2s |
| Dual-offer / android SLOW | **0** on healthy same-WiFi path |
| First usable video | **&lt; 3 s** same Wi‑Fi; &lt; 15 s hard NAT |
| After first paint | **0** timed RTCView remount spam |

---

## Commands (from repo root)

```bash
# 1) Before any media APK / connect PR
./scripts/dev-smoke.sh              # unit + pair-smoke if chrome+bridge present
./scripts/dev-smoke.sh --unit       # units only (seconds)
./scripts/dev-smoke.sh --pair       # pair-smoke only (web↔web + rematch budgets)
./scripts/dev-smoke.sh --hub        # also hub-match-speed last 20m
# or direct: node scripts/pair-smoke.mjs

# 2) After you do one real Play↔PC match
./scripts/smoke-connect.sh --hub-only
./scripts/connect-scorecard.sh 60    # one-liner + JSONL append
# or: MIN=30 ./scripts/hub-match-speed.sh 30

# 3) Live window while matching
./scripts/connect-monitor.sh
# Browser: https://ruletka.vip/admin-connect.html

# 4) Install latest local APK (optional)
./scripts/smoke-connect.sh --install
# or: adb install -r mobile/artifacts/ruletka-android-latest.apk
```

Web-only UI: `UI_ONLY=1 ./scripts/deploy/push.sh` then hard-refresh `live.html`.

---

## Human smoke packages

| Package | Steps | When |
|---------|-------|------|
| **Connect 3** | Start → both cams → Next → Stop | Every media APK |
| **Privacy 3** | Eye blur → Show video → they-mute banner | Blur/mute APKs |
| **Resume 1** | Leave app 30s → return → video | Bg changes |
| **PC 5** | [`PC_BROWSER_SMOKE.md`](./PC_BROWSER_SMOKE.md) core | Web deploy |

Always note **app badge** (e.g. `0.1.227 · 235`) + approximate time for hub logs.

---

## Symptom → first look

| Symptom | Check |
|---------|--------|
| Black partner forever | force_relay / TURN ALLOCATE; hub `relay_candidates`; Hide IP |
| Slow then works on Next | Warm path / second offer thrash — hub dual-offer |
| Flicker / remount loop | streamEpoch / forceRepaint after first frame |
| Phone never answers | Web offerer silence; promote only after long silence |
| Dual cams then freeze | ICE connected without frames; earlyBlack restart |

---

## Metrics (mobile funnel names)

`connect_offer_ms` · `connect_answer_ms` · `connect_first_frame_ms` · `connect_warm_reuse` · `connect_video_ms`

Hub: `match_to_offer_ms`, platform_a/b, force_relay flags (see `hub-match-speed.sh`).

---

## Overnight

```bash
./scripts/admin-agent/run-once.sh --forensics-only   # preferred default
./scripts/admin-agent/morning.sh
```

Do **not** auto-deploy (`ALLOW_DEPLOY=0`). Snapshot before long agent nights: `snapshot-pre-sleep.sh`.
