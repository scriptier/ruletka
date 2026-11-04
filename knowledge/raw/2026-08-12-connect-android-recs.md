# Raw: CONNECT-ANDROID recs (CONN-L3) — 2026-08-12

Source: Grok CONNECT-ANDROID recommender. Full RESULT: `tasks/grok-loop/done/CONN-L3-android-RESULT.md`.

## Scorecard snapshot
- stamp `20260812T044852Z` · verdict WARN · product **one-way** · android fin/fout **0/0**
- web only av_path · app_vc=null · bind_v=null · answers 2 &lt; offers 3
- contrast L19e product.ok app_vc=375 android 254/26

## Top 7 (titles only)
1. Detect missing android av_path vs true one-way (triage before encode thrash)
2. Answer serial wait cuts with product.ok gate (keep pre-createAnswer bind; pure cap 280)
3. force_relay policy=all → relay under hub pure (hasTurn + ensureRelayPolicyPc)
4. Earliest answer kick live.tsx (answerer-fast already on disk — verify app_vc)
5. av_path beacon reliability (no android interval; arm early for presence)
6. APK app_vc lag — disk **0.1.370-vc378** vs null beacon / wiki tips
7. Human smoke: install current APK · ≥20s link · av-verify product.ok · GOAL_MET=no

## Code anchors
- MediaSession answer serial: bind pre-createAnswer ~5267; pure relay budget min(1200,280) ~5368–5391
- armAvPathBeacons waves only [2,5,8,12]s ~3664
- live.tsx EARLY startCall answerer-fast ~2254–2312
- setForceRelay / desiredRelayPolicy / ensureRelayPolicyPc ~1832–1912, 1779–1825

## GOAL_MET
no
