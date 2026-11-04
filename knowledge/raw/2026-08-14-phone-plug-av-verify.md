# Raw: phone desk av-verify — 2026-08-14T02:51:00Z

**Not** linking GOAL_MET. Single 8-min window. WEB_PAIR = headless Chrome fake media + Pixel 9 Pro **0.1.376/vc384**.

| Field | Value |
|-------|--------|
| stamp | `20260814T025100Z` · `at=2026-08-14T02:51:00Z` |
| device-smoke | **MATCHED** `20260814T024804Z` serial `45141FDAP0004F` SKIP_INSTALL WEB_PAIR |
| verdict | PASS · product **ok** |
| mto / mta | **1097 / 2153** (beat 1498/2685) |
| frames | web 2827/3071 · android 3050/2827 |
| force_relay | hub/web/android aligned · fr_mismatch false · policy=relay |
| app_vc / bind_v | **384 / 1** |
| TURN | HOT max_rb 519390 · err_437=0 · last answer relay_candidates **0** |
| stretch | mto &lt;800 warm still open · mta &lt;2500 **this sample** under |

Source: `artifacts/av-verify/latest.md` after `./scripts/av-verify.sh --min 8`.
