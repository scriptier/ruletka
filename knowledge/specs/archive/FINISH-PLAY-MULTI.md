# Spec: Finish multi 3/4-way + Friends/Settings + Play-ready

**Status:** active · **Loop:** max 5 Grok agents + Claude continuous  
**Date:** 2026-08-12  
**Progress stamp:** 2026-08-12 (Grok L18-stamp-566) — ship tip APK **0.1.367-vc375** + disk web **live.js?v=566** + **live-stage.css?v=388** + brand **12** + webrtc **315**; W-BM2 **blur match-apply** + **veil z-order** + **multi harness** remain **code-shipped** · **human-smoke-open** (see `BLUR-MULTI-FINISH-PLAN.md`); multi A1–A5 / full Play still **human-smoke-open**; **no invent GOAL_MET**. Spin SFX `sounds/match.mp3` **deployed** on prod (HTTP 200). L13 re-curl historical: prod live.js **564** / brand **11** matched then-disk; stage prod **386** vs then-disk **387**. L16 tip was **565** / stage **387** / brand **12**. Disk tip now **566** / stage **388** / brand **12** (no prod re-curl this hop).

## Legend

| Marker | Meaning |
|--------|---------|
| **code-shipped** | Present on disk / verified by agent RESULT; **not** product GOAL_MET |
| **agent-ui-alive** | Agent adb UI dump / device-smoke ALIVE or MATCHED on device — **not** human PASS / GOAL_MET |
| **human-smoke-open** | Needs human device paste; agents **must not** invent PASS |
| **partial** | Path/docs/assets exist but release binary or Console step missing |
| **blocked-human** | Requires human Console / upload / secrets policy — agents stop |

Ship tip (disk, 2026-08-12 L18-stamp-566 re-read):

| Surface | Stamp | Notes |
|---------|-------|--------|
| APK | **0.1.367-vc375** | `mobile/app.json` (`0.1.367` / versionCode **375**) + `mobile/artifacts/ruletka-0.1.367-vc375.apk` / `ruletka-latest.apk` (aapt: versionName **0.1.367** versionCode **375**). Built after BM2 blur source mtime — **still human-smoke-open** for blur / multi product PASS (no invent). Historical 1v1 MATCHED used **0.1.366-vc374** |
| Web live.js | **`?v=566`** in `ui/live.html` | Disk tip (L18 re-read; L16 was **565**). L13 prod re-curl historical VIP **564** — no re-curl this hop |
| webrtc.js | **`?v=315`** | hop9 budgets + pool=0 + clone release recheck OK · L13 prod matched |
| live-stage.css | **`?v=388`** in `ui/live.html` | Disk tip (L18; L16 was **387**). L13 prod re-curl: VIP still **386** (lag) — stage deploy residual (not re-checked L18) |
| live-brand.css | **`?v=12`** | Disk tip held (BRAND-multi-trio-place 11→12). L13 prod was **11** matching then-disk — no re-curl this hop |
| Match SFX | **`sounds/match.mp3?v=1`** | **Deployed** prod HTTP 200 · disk md5 `b858bc2e…` (BRAND/SFX RESULTs) — not multi PASS |
| AAB tip | **MISSING** for 0.1.367 | Script + upload keystore present; only ancient AABs ≤0.1.3 in `mobile/artifacts/` |
| Smoke | [`SMOKE-NEXT.md`](SMOKE-NEXT.md) | Multi / Friends / Settings / blur human boxes still open — agent notes ≠ human PASS |
| Blur (Android) | **code-shipped** · **human-smoke-open** | BM2 match-apply (`blurWantAutoRef` / `applyMatchBlurVeil`) + veil z-order (`blurCoverElevated`) on disk; tip APK **0.1.367-vc375** available for human sideload — see `BLUR-MULTI-FINISH-PLAN.md` |
| Multi harness | **code-shipped** (scaffold) · **human-smoke-open** | `scripts/multi-pair.mjs` + `multi-smoke.mjs` SCAFFOLD_DONE only — not multi GOAL_MET |

### Agent device notes (2026-08-12 — not human PASS)

| Lane | Verdict | Source | Explicit non-claim |
|------|---------|--------|--------------------|
| **1v1 live** | **MATCHED** (agent) ×2 | T1 `20260812T021127Z` + **T4 recheck** `20260812T022114Z` · Pixel 9 Pro `45141FDAP0004F` · APK **0.1.366-vc374** · `SKIP_INSTALL=1 WEB_PAIR=1` · exit 0 · `last-verdict.txt` **MATCHED** | **Does not close multi** (A1–A5). 1v1 only; tip APK now **0.1.367-vc375** (no agent re-MATCHED claimed this hop) |
| **Friends** | **ALIVE** empty+history | T2 `ruletka://friends` · no crash · online strip 0·0 + recent matches populated | Full Friends Play CTAs / a11y still **human-smoke-open** |
| **Settings** | **ALIVE** version chip | T3 `ruletka://settings` · chip **`ruletka 0.1.366 (374)`** · no FATAL · pid ALIVE | Prefs persist / leave+reopen / destructive confirms still **human-smoke-open**; tip chip should read **0.1.367 (375)** after sideload |
| **Trio / blur on phone** | tip APK **0.1.367-vc375** built | W8 trio + BM2 blur on source; artifact mtime after source — human sideload + paste still required | **Not** multi / blur PASS — **human-smoke-open** |

---

## Product DONE WHEN

### A. Multi-party (cross-compatible)

| # | Criterion | Verify | Progress |
|---|-----------|--------|----------|
| A1 | 3-way PC↔Android (app + Chrome Android): faces both ways ≥60s | Human smoke + optional av-verify | **code-shipped** · **human-smoke-open** — web clones + Android multi tiles / MediaSession multi ownership on disk; agent 1v1 MATCHED ×2 (T1+T4) **does not** close multi; no human 3-way paste |
| A2 | Find-3rd hunt: first partner video stays live; looking pane separate | Human | **code-shipped** · **human-smoke-open** — web softKeepPartnerPaint + trio hunt CSS; Android hunt top/bottom without RTC remount; **W8 trio overlay keys** on source; tip APK **0.1.367-vc375** built after source — human sideload + paste still required (not multi PASS) |
| A3 | PC shows real name (e.g. Courtier) not sticky Partner | Human | **code-shipped** · **human-smoke-open** — `lastGoodPartnerName` latch + find-3rd mate-prefer / `stealMainLatch` in `ui/live.js`; live.html cache **live.js?v=566** (disk tip L18) |
| A4 | Chrome Android multi cam no freeze (track.clone) | Human 3-way ≥60s | **code-shipped** · **human-smoke-open** — secondary always `track.clone()`; primary keeps real preview; audio push no shared `setLocalStream(preview)` |
| A5 | 4-way stretch: up to you+3 remotes, no permanent black orphan | Human or n/a | **code-shipped** · **human-smoke-open** — CSS `stage-count-4` + remote2 `:not([hidden])` orphan fix; Android `remoteStream3` / media3 / `MAX_REMOTE_TILES=3` |
| A6 | Cap 5th peer: partyCap log, no slot steal | Code + optional smoke | **code-shipped** (verify-only) · optional **human-smoke-open** — `joinPeers` max 3 opponents, `strangerCount >= 3` gate, partyCap logs; no silent drop |

### B. Android Friends

| # | Criterion | Progress |
|---|-----------|----------|
| B1 | Open Friends: list/empty/error no crash | **code-shipped** · **agent-ui-alive** · **human-smoke-open** — T2 Pixel: Friends opened, empty graph (0·0) + history, no crash; full Play smoke still human |
| B2 | Avatars + history thumbs when data exists | **code-shipped** · **agent-ui-alive** (partial) · **human-smoke-open** — T2 recent-match rows present; avatar onError → letter on disk; human thumbs/a11y open |
| B3 | Add friend / requests / call CTAs work or honest disabled | **code-shipped** · **human-smoke-open** — Share/Copy/Chat/Call toast when not connected; agent dump did not exercise CTA PASS |
| B4 | No blank white screen / infinite spinner without recovery | **code-shipped** · **agent-ui-alive** · **human-smoke-open** — T2 not blank white; hist strip + Retry on disk; no invent PASS |

### C. Android Settings

| # | Criterion | Progress |
|---|-----------|----------|
| C1 | Open/close Settings no crash | **code-shipped** · **agent-ui-alive** · **human-smoke-open** — T3 Pixel: Settings opened ALIVE, no FATAL; close/leave still human |
| C2 | Hide IP, blur, lang, devices, theme prefs persist | **code-shipped** · **human-smoke-open** — hide_ip / blur / looking via `saveMatchPrefs`; lang via i18n pref; human must confirm leave+reopen |
| C3 | No dead rows that crash on tap | **code-shipped** · **human-smoke-open** — static section toggles + soft toasts; agent open-only, no row-tap PASS |
| C4 | Account/backup/delete paths safe (no wipe without confirm) | **code-shipped** · **human-smoke-open** — destructive via `Alert.alert` confirms retained |
| — | Version chip on device | **agent-ui-alive** (historical) — T3 scrolled **О приложении**: **`ruletka 0.1.366 (374)`**; ship tip now **0.1.367 / vc375** — re-check chip after human sideload |

### D. Google Play ready

| # | Criterion | Progress |
|---|-----------|----------|
| D1 | Release AAB builds (`build-aab-local.sh`) with upload keystore | **partial** — script **exists** + `secrets/ruletka-upload.jks` **present**; **AAB for tip 0.1.367-vc375 MISSING** (artifacts only ≤0.1.3 AABs). Build not run this restamp |
| D2 | versionName/versionCode bumped per upload | **code-shipped** (tree) — **0.1.367 / vc375** in `app.json` + sideload APK artifact present (aapt OK). Play upload version rise still **human** |
| D3 | Store assets present (icon 1024, feature graphic) | **code-shipped** (on disk) — `mobile/assets/store/app-icon-1024.png`, `play-feature-1024x500.png`, phone screenshots. Console **upload open** |
| D4 | Data safety / privacy policy URLs current (`docs/PLAY_*`) | **partial** — `ui/legal/privacy.html` + `docs/PLAY_DATA_SAFETY.md` on disk; PLAY_* docs may still say **0.1.366 / vc374** (W4) while app tip is **0.1.367 / vc375** — doc realign optional; Console Data safety form **not verified** |
| D5 | Internal testing track checklist complete (human in Play Console) | **blocked-human** · **human-smoke-open** — checklist exists but unchecked; no Console PASS invented |
| D6 | No debug keys / secrets in APK | **partial / intent** — release `signingConfigs.release` when keystore present; **no** APK secret audit this pass. Do not ship debug-signed as Play release |

## Non-goals (this finish)

- SFU, redesign gifts
- iOS App Store
- Auto Play upload without human

## Agent loop

| Loop | Cap | Queue |
|------|-----|-------|
| Grok subagents | **5** concurrent | `tasks/grok-loop/` |
| Claude continuous | **1** sequential | `tasks/admin-queue/` |
| Director tick | every **15m** | durable scheduler |

## Ship stamps (update as you go)

- Web: see `ui/live.html` `?v=` → **live.js?v=566**, **webrtc.js?v=315**, **live-stage.css?v=388**, **live-brand.css?v=12** (disk re-read 2026-08-12 L18-stamp-566)
- APK: see `mobile/app.json` → **0.1.367 / versionCode 375** · artifact `mobile/artifacts/ruletka-0.1.367-vc375.apk` / `ruletka-latest.apk` (aapt OK) · trio + BM2 blur source preceded this build mtime — **human-smoke-open** for product blur / multi (no invent PASS)
- Match SFX: `ui/sounds/match.mp3` + prod **deployed** (HTTP 200)
- AAB tip: **not built** for 0.1.367 — `./scripts/build-aab-local.sh` when human wants Internal track
- Smoke: `knowledge/specs/SMOKE-NEXT.md` (multi / Friends / Settings / blur human boxes open; agent 1v1 MATCHED ×2 on **0.1.366-vc374** noted separately — **not** multi PASS)
- Blur W-BM2: match-apply + veil z-order **code-shipped** · **human-smoke-open** (`BLUR-MULTI-FINISH-PLAN.md`)
- Multi harness B1: **code-shipped** scaffold · **human-smoke-open** product

## Evidence (agent RESULTs — code + device notes, no invent PASS)

| Area | Source RESULT / path |
|------|----------------------|
| Multi web clones + hunt keep + Courtier base | `tasks/grok-loop/done/P0-multi-web-verify-RESULT.md` |
| Courtier find-3rd mate latch fix | `tasks/grok-loop/done/P1-identity-pc-recheck-RESULT.md` |
| webrtc hop9 / pool=0 / clone release | `tasks/grok-loop/done/P0-webrtc-multi-recheck-RESULT.md` |
| CSS 4-way + orphan black | `tasks/grok-loop/done/P0-multi-css-4way-RESULT.md` |
| Stage CSS dense mute/vol floors | `tasks/grok-loop/done/W3-stage-css-dense-chrome-RESULT.md` |
| live.html live.js cache 560→561 | `tasks/grok-loop/done/W4-live-html-cache-bump-RESULT.md` |
| live.html live.js cache 561→**562** | `tasks/grok-loop/done/T6-livejs-cache-bump-partyCap-RESULT.md` |
| Stage CSS tip **386** on disk | `ui/live.html` (`live-stage.css?v=386`) + hunt floor in `ui/live-stage.css` |
| FINISH tip restamp **live.js?v=562** | `tasks/grok-loop/done/T7-finish-stamp-562-RESULT.md` |
| joinPeers cap 3 | `tasks/grok-loop/done/P0-multi-joinPeers-cap-audit-RESULT.md` |
| Android 4-way tiles + hunt split | `tasks/grok-loop/done/P0-android-4way-tiles-RESULT.md` |
| MediaSession multi ownership | `tasks/grok-loop/done/P1-mediasession-multi-RESULT.md` |
| Friends Play polish | `tasks/grok-loop/done/P1-friends-play-RESULT.md` |
| Settings Play polish | `tasks/grok-loop/done/P1-settings-play-RESULT.md` |
| Play AAB path / checklist honesty | `tasks/grok-loop/done/P2-play-aab-doc-RESULT.md`, `P2-play-store-checklist-RESULT.md` |
| PLAY_* tip restamp 0.1.366 | `tasks/grok-loop/done/W4-play-docs-tip-RESULT.md` |
| PLAY tip residual honesty clear | `tasks/grok-loop/done/W5-finish-play-honest-after-docs-RESULT.md` |
| **Agent 1v1 phone MATCHED** (non-multi) | `tasks/grok-loop/done/T1-phone-device-smoke-web-pair-RESULT.md` · `20260812T021127Z` |
| **Agent 1v1 phone recheck MATCHED** (non-multi) | `tasks/grok-loop/done/T4-phone-device-smoke-recheck-RESULT.md` · `20260812T022114Z` · SKIP_INSTALL=1 |
| **Trio overlay needs APK rebuild** | `tasks/grok-loop/done/T4-apk-rebuild-note-trio-overlay-RESULT.md` · W8 source only |
| **Agent Friends UI ALIVE** | `tasks/grok-loop/done/T2-phone-friends-ui-RESULT.md` |
| **Agent Settings UI ALIVE + version chip** | `tasks/grok-loop/done/T3-phone-settings-RESULT.md` |
| SMOKE agent-note stamp (not human PASS) | `tasks/grok-loop/done/T3-stamp-smoke-from-t1-RESULT.md` |
| Agent smoke progress restamp | `tasks/grok-loop/done/T4-finish-spec-agent-smokes-RESULT.md` |
| This residual restamp | `tasks/grok-loop/done/T5-finish-play-residual-RESULT.md` |
| FINISH ship tip live.js **562** (stage 386) | `tasks/grok-loop/done/T7-finish-stamp-562-RESULT.md` |
| Prod live.js **561** vs disk **562** curl | `tasks/grok-loop/done/T8-prod-livejs-check-RESULT.md` |
| Prod lag residual restamp (561/384 vs 562/386) | `tasks/grok-loop/done/T9-finish-prod-lag-RESULT.md` |
| partyCap disk **4** / prod **0** (T11 grep + T12 re-curl) | `tasks/grok-loop/done/T11-partyCap-grep-RESULT.md`, `T12-finish-partyCap-prod-RESULT.md` |
| **BM2 blur match-apply** (code-shipped · human-smoke-open) | `tasks/grok-loop/done/BM2-blur-match-apply-fix-RESULT.md` |
| **BM2 veil z-order** (code-shipped · human-smoke-open) | `tasks/grok-loop/done/BM2-veil-zorder-RESULT.md` |
| **BM2 multi harness scaffold** (code-shipped · human-smoke-open) | `tasks/grok-loop/done/BM2-multi-harness-scaffold-RESULT.md` |
| BM3 blur+multi residual stamp | `tasks/grok-loop/done/BM3-finish-blur-multi-RESULT.md` |
| Brand + spin SFX prod deploy | `tasks/grok-loop/done/BRAND-skill-restamp-RESULT.md`, `SFX-match-spin-mp3-RESULT.md` |
| **L13 ship tip APK 0.1.367-vc375** | `tasks/grok-loop/done/L13-stamp-apk-367-RESULT.md` |
| **L16 disk tip pins live.js 565 / brand 12** (historical) | `tasks/grok-loop/done/L16-stamp-pins-565-brand12-RESULT.md` |
| **L18 disk tip pins live.js 566 / stage 388 / brand 12** (this hop) | `tasks/grok-loop/done/L18-stamp-566-RESULT.md` |
| Blur+multi plan stamp | `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` |
| Wiki multi stamps | `knowledge/wiki/multi-party.md` |

## Residual honesty (do not paper over)

1. **No multi / Friends / Settings / blur GOAL_MET** without human paste in `SMOKE-NEXT.md`. Multi A1–A5 remain **code-shipped · human-smoke-open**. Blur W-BM2 match-apply + veil z-order **code-shipped · human-smoke-open** (not product PASS).
2. **Agent 1v1 MATCHED ≠ multi PASS.** T1 + **T4 recheck** Pixel device-smoke + WEB_PAIR are **1v1 only** on APK **0.1.366-vc374** (stop/next/report/timer chrome; not 3-way / 4-way / find-3rd). Re-MATCHED does **not** close multi. Multi harness SCAFFOLD_DONE **≠** multi GOAL_MET. Tip APK **0.1.367-vc375** has **no** agent multi / blur PASS this hop.
3. **Agent Friends/Settings ALIVE ≠ full Play GOAL_MET.** T2/T3 prove open + no crash + version chip on **374**; CTA exercise, prefs persist, destructive confirms, a11y still **human-smoke-open**.
4. **Prod web residual:** L13 re-curl (2026-08-12T03:14Z UTC) had prod VIP **live.js 564** · brand **11** · webrtc **315** matching **then-disk**; stage prod **386** vs then-disk **387**. L16 tip was **565** / **387** / brand **12**. **Disk tip now (L18):** **`live.js?v=566`** + **`live-stage.css?v=388`** + **`live-brand.css?v=12`** + `webrtc.js?v=315` — **no prod re-curl this hop** (prod may lag 566/388/12). **match.mp3** prod HTTP 200 **deployed**. Prior T12 partyCap prod **0** vs disk **4** not re-grepped — treat partyCap deploy as residual unless re-proven. **No invent browser multi PASS.**
5. **Trio overlay + BM2 blur:** tip APK **0.1.367-vc375** built after source mtime — available for human sideload; device blur / hunt caption / multi still **human-smoke-open**. BM1 forensics (veil never showed) ran pre-fix **0.1.366-vc374**. **Not multi / blur PASS.**
6. **AAB for current tip missing** — sideload APK only (`0.1.367-vc375`). Artifacts AABs stop at **≤0.1.3**.
7. **`docs/PLAY_*` may lag** app.json tip **0.1.367 / versionCode 375** (W4 stamped **0.1.366 / vc374**). **Still not store PASS:** tip AAB **MISSING**; Play Console Internal / Data safety checklist **human open** (D5 blocked-human). Spec tip restamp ≠ upload / Console complete.
8. Grok loop P0–P2 + W* + T* + BM1–BM3 + L13 + L16 + L18 pin stamp filed COMPLETE as **code/docs/agent-device-notes**; human multi + blur + full Friends/Settings Play gates remain open.
9. **No invent PASS** on L13 APK tip restamp, L16 pin restamp, or L18 pin restamp — honesty only; no multi / blur / Friends / Settings / Play Console GOAL_MET.
