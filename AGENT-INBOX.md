
---

## 2026-10-10 — Ruletka Developer
Anton: do all six improvements today on branch polish/2026-10-10 (worktree ~/freenet-roulette-polish). site tab: items 1, 2, 4, 5 (web), 6. mobile tab: items 3 (phase 1), 5 (app), 6. Local commits only; no push, deploy, or build.

---

## 2026-10-10 — Grok Build / site

Local only. No push, no deploy, no APK. Did not edit `mobile/` (that tree is the mobile tab’s dirty work).

Commits on `polish/2026-10-10`:
- `9eb38a6` fix(bridge): one Ruletka.me after the vip→me replace; 301 `/download` → `/download/android`; aliases for `/en/`, `/videochat-bez-registracii`, `/analog-chat-ruletki`, `/en/omegle-alternative`, `/operators`.
- `a83aadd` feat(site): `/` is server-rendered Russian (exact title, description, H1). Primary CTA «Начать чат», invite secondary. `/en/` is the English twin. Sitemap is ruletka.me only, lastmod 2026-10-10, no .vip and no redirect URLs. FAQ JSON-LD on the new pages. Operator links (hubs.json, directory, source.json, helper) are on `/operators.html` (noindex, not in the sitemap). `brand.js` no longer rewrites title, description, canonical, or og:url. Visible name is Ruletka.me. Hero/OG use `logo-mark.png`.
- `fe68b60` feat(live): one 18+ screen, `#btn-age-yes` is Start and begins the search (friend/room/invite links do not auto-spin). No `#btn-rules-accept`, so pair scripts cannot double-start. First visit does not show “Update available”. Online &lt; 5 shows «Ищем собеседника по всему миру… пригласите друга» on the home and in Settings → Lobby. Side labels are sentence case. No-cam backgrounds use the mark, not `logo-hero.jpg`.

Tests:
- `cargo test brand_tests` in `bridge/`: 4 passed.
- `node --check` on `brand.js`, `live.js`, `pwa-install.js`, `i18n.js`, `site-i18n.js`, and the home inline script: ok.
- `SKIP_L2=1 ./scripts/verify-before-apk.sh`: L0 26 ok, 2 fail (`partnerFlagChip`, Android privacy Modal). L1 `stageStreams.test.mjs` fail (`MAX_EXTRA_PEERS`). These read `mobile/`, which this tab did not change.
- `npm test`: friend-invite passed; `test-geo-localize.mjs` stopped because `typescript` is not installed in this worktree’s `mobile/node_modules`.

Needs Anton:
- Google Play URL is on the Android page (`id=me.ruletka.app`). The SEO note said that listing 404’d. RuStore `https://www.rustore.ru/catalog/app/me.ruletka.app` matches package `me.ruletka.app`.
- No public iOS app is claimed. The Android page says Safari on iPhone.
- `logo-hero.jpg`, `og-share.jpg`, and `homepage-hero.mp4` are still in `ui/brand/` and still the .vip lockup. Consumer hero, OG, and no-cam tiles point at `logo-mark.png` instead. `loading-screen.mp4` was not re-encoded (no “vip” string in the file). If the frames still show .vip, that needs a new asset.
- Analog copy does not say “without VPN”. The exact meta line “работает в России в браузере и на Android” is kept. The body says availability depends on the ISP.
- `/` stays Russian. Choosing English, or a stored `en`, goes to `/en/`. Browser language does not swap `/`. A stored other language (uk, pl, …) still translates the page after JS.
- Low-pool threshold is online &lt; 5.
- Not built: P5–P10 from the SEO report.
- Not deployed. Say when to ship.

---

## 2026-10-10 — Grok Build / mobile

Local only on `polish/2026-10-10`. No push, no deploy, no APK, no store upload. Version stays 0.1.471 (versionCode 479). Did not edit `ui/` or `bridge/`.

Commits:
- `f4d1934` Safety policy stub, default-on filter, two-step off, on-device log, duration helpers, tests.
- `d925476` Live watch (blur on suspicion; 2-of-3 explicit asks skip/report and logs locally), face-in-frame hint, localized timers, public-hub share links use ruletka.me. Restored `MAX_EXTRA_PEERS = 2` (live already imported it; the cap was missing, so the stage test was red).
- `a296d97` Overlay copy: Russian leftovers, time units, clearer stars, sentence-case debate badges, visible name Ruletka.me.
- `ae621e7` Home header Start + full language sheet, settings filter control, watermark and permission strings. Match-UX check now accepts in-stage soft blur and the stage flag chip staying off (both were already red at HEAD).

Tests (`SKIP_L2=1 ./scripts/verify-before-apk.sh`, using the main checkout's `mobile/node_modules` because this worktree has none): L0 28 ok, L1 ok, including `logic.test.mjs` and `duration.test.mjs`. `npm test` green the same way. The post-commit APK hook started and stopped in verify (no `typescript` in this worktree). No APK file was produced.

Moderation phase 1 is the stub, not a model. `EXPO_PUBLIC_SAFETY_DETECTOR=tflite|onnx` still returns the stub (`ready: false`, face/nsfw `unknown`), so a match is not false-blurred. Friend calls are excluded. Filter is on unless stored `false`. Off is two actions: the Off chip, then confirm. Cancel leaves it on.

Native ML plan (not built; needs a prebuild and an APK):
- Bundle under `mobile/assets/models/`, no CDN. BlazeFace short-range `.tflite` (Apache-2.0, ~230 KB) for face presence. NSFW: MobileNetV2 TFLite from GantMan/nsfw_model (MIT), same gates as web: explicit if porn≥0.72 or hentai≥0.78 or (porn≥0.55 and sexy≥0.5); sexy≥0.62 is suspicion only. Do not ship NudeNet (AGPL).
- Frames: a Kotlin `VideoSink` on the remote WebRTC track, 224 px every 2 s. Do not use `captureRef` (Android SurfaceView is often black).
- Then `createSafetyDetector("tflite")` via `react-native-fast-tflite`.

Hub must not get `report_user` for these hits (`explicit_ai` counts toward the existing ban). `HUB_ACCEPTS_SAFETY_LOG` stays false. When the site tab adds a log-only message, the body is `{ "type": "safety_log", "log_only": true, "reason": "explicit_shadow", "target_user_id", "model", "model_ready", "face", "nsfw", "window", "scores", "ts" }`. It must append a line and must not touch `report_reporters` or `match_bans`. An unknown type currently surfaces as "bad json".

Needs Anton:
- When to land the native model and build an APK.
- Site tab: add `safety_log` as above. Mobile will not send it until that exists.
- Shirtless is not its own class. Sexy only blurs; explicit is what asks skip/report.
- Hub picker rows for both ruletka.vip and ruletka.me display "Ruletka.me". The app still connects to `https://ruletka.vip` (app.json extra, eas, config default, builtin list).
- `mobile/src/i18n/packs/` still say ruletka.vip. The running app does not load them. Store listing files under `mobile/assets/store/` were left for the store tab.
- A few Russian technical hints still say TURN, WebRTC, or pin.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-10 12:40 — Ruletka Developer
Next assignments (prompts in ~/rustore-ru-work/prompts/*2.txt): site — re-verify, hub safety_log (log-only), SEO pages P5–P8, lighter landing. mobile — i18n packs + plain Russian hints, face-presence UX, native model code on local branch polish/ml-native (no build), safety_log send once hub has it. store — Russian/English Play listing + RuStore text drafts. ios — iOS readiness + guideline 1.2 doc. All local; no push/deploy/build/upload.

---

## 2026-10-10 — Grok Build / ios

Local only on `polish/2026-10-10`. No push, no deploy, no EAS build, no App Store Connect, no Submit for Review. Did not edit `mobile/` or `ui/`.

Commits:
- `9a4b471` docs: iOS readiness, Guideline 1.2, and the TestFlight path.

What changed:
- Added `knowledge/specs/ios-readiness-2026-10.md`. Parity vs the Android Expo app on this branch (shared `live.tsx`; safety filter default-on with a two-step off; report + block). Guideline 1.2 quoted from the page fetched 2026-10-10, including the random/anonymous chat removal sentence. Options: friends-by-code profiles, iPhone Safari, or a stranger-match app. Minimum internal TestFlight sequence. This branch's `eas.json` still has `ascAppId` `REPLACE_ASC_APP_ID`.

Tests:
- `node mobile/src/safety/logic.test.mjs`: OK (policy claims in the spec). Node printed a typeless-package warning. Did not change `mobile/package.json`.
- Did not run `verify-before-apk.sh` or `npm test`. This hop is one markdown file. Those scripts read `mobile/`, which the mobile tab owns, and the APK hook can start from a mobile commit.

Needs Anton:
- Pick A (friends-by-code TestFlight), B (iPhone Safari only), or C (stranger-match app, accepts Guideline 1.2 removal risk).
- Confirm the real App Store Connect id. This branch has the placeholder. The live connect checkout has uncommitted `6804910924`.
- Say yes in chat before any `eas build`, `eas submit`, or Submit for Review.
- Internal TestFlight still needs his Apple Developer login and 2FA. This machine has no Xcode.

Signed Grok Build / ios. Stopping here.

---

## 2026-10-10 — Grok Build / store

Local only on `polish/2026-10-10`. No push, no deploy, no APK/AAB, no Play or RuStore upload, no mail. Did not edit `ui/`, `bridge/`, or `mobile/` outside `mobile/assets/store/`. Left other dirty files in this worktree alone (`mobile/app/live.tsx`, `mobile/src/safety/*`).

Commits:
- `51676c5` Draft Play and RuStore listing text with character counts.

What changed:
- Added `mobile/assets/store/LISTING-RU-2026-10.md`. Paste drafts with code-point counts. Play ru-RU title 24/30 (`Ruletka.me — чат рулетка`), short 74/80, full 1863/4000. Same Russian paste is the RuStore variant against the live short (65/80) and the public catalog text fetched 2026-10-10. Play en-US title 23/30, short 72/80, full 1721/4000. Both full texts are under 2000, so they survive RuStore’s collapse. Queries «чат рулетка», «видеочат без регистрации», and «видео чат рулетка» are in the Russian title, short, and first sentence. No gender promise, no voice-roulette claim, no “without VPN”, no on-device AI claim. Relay and one report screenshot are stated. Live privacy URL `https://ruletka.me/privacy.html` is a 404; the draft uses `/legal/privacy.html` (200).

Tests:
- `NODE_PATH` pointed at the main checkout’s `mobile/node_modules` (this worktree has none). `SKIP_L2=1 ./scripts/verify-before-apk.sh`: L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1` on the commit. No APK.

Needs Anton:
- Before any upload: store name `Ruletka.me — чат рулетка` (24) or the exact launcher string `Ruletka.me` (10). Live RuStore name is lowercase `ruletka.me`. ФЗ-168 prefers a Russian name unless the Latin name is a registered trademark. This draft does not claim a registration. «Чат рулетка» alone is not unique (another app uses it).
- RuStore tags include «Знакомства». The paste does not promise dates. Changing tags is a console action.
- Live RuStore build on the page was 0.1.479. This draft does not touch version or release notes.
- Say if debate, gifts, or 3–4 person layout should be added to the paste before upload.
- Upload still needs an explicit go.

Signed Grok Build / store. Stopping here.

---

## 2026-10-10 — Grok Build / site

Local only on `polish/2026-10-10`. No push, no deploy, no APK. Did not edit `mobile/`. Did not set `HUB_ACCEPTS_SAFETY_LOG`.

Commits:
- `77a811c` feat(bridge): log safety_log without banning
- `4a2392d` feat(site): call, anonymity, safety, and camera pages, plus a lighter landing

The worktree had been moved to `polish/ml-native` (same tip as this branch, `b87d77a`). These two commits were fast-forwarded onto `polish/2026-10-10`. `polish/ml-native` was put back at `b87d77a` so the model branch does not carry the site files.

What changed:
- Hub accepts `{type:"safety_log", log_only:true, reason, target_user_id, model, model_ready, face, nsfw, window, scores or omitted, ts}`. One JSON line goes to `safety-logs.jsonl` next to the friends store. 30 lines per hour per connection. `log_only` must be true or the line is dropped. `report_reporters` and `match_bans` are not touched. Told the mobile tab via `herdr agent prompt` (commit `77a811c`).
- Pages: `/videozvonok-bez-registracii`, `/anonimnyj-videochat`, `/bezopasnost` (file `ui/safety.html`, Russian, about 770 words before the FAQ), `/pomosh/kamera-i-mikrofon`. FAQ JSON-LD, sitemap, footer links, bridge aliases and trailing slashes. `/safety.html` still serves the same file. Canonical is `https://ruletka.me/bezopasnost`. No `/en/safety`, no P9, no P10.
- Landing: `analytics.js`, `pwa-install.js`, and `live-window.js` load after idle. Hero video has `poster=/brand/logo-mark.png` and `preload=none`; `loading-screen.mp4` is set only when the hero is on screen. First-load HTML + referenced JS: 76,391 bytes before, 53,426 after (HTML file itself 47,064 → 49,754). The mp4 is 246,162 bytes and is not in that first set.

Tests:
- `SKIP_L2=1 mobile/scripts/verify-before-apk.sh` with the main checkout’s `mobile/node_modules` (this worktree has none): L0 28 ok, 0 fail. Wrapper passed 12, failed 0. Exit 0.
- `npm test`: exit 0 (friend invite, geo, live units, safety logic, duration).
- `cargo test` filter `safety_log` and `brand_tests`: 9 passed. A safety line does not change ban maps; a later `report_user` still can.
- `node --check` on the home inline script: ok.
- No browser click-through. Aliases are covered by the cargo test, not by a loaded page.

Needs Anton:
- `/bezopasnost` is the canonical safety URL. `/safety.html` is the same Russian page, not a 301, so old links keep working. English `/en/safety` was not built.
- The safety meta line still says «ИИ на устройстве», as in the SEO report. The body says the browser check is local and the Android model is not on yet.
- Anonymity copy states the WebRTC IP caveat and does not say the site works without a VPN.
- Play listing may still 404. Not rechecked this hop.
- Say if the hero should stay a still logo instead of starting `loading-screen.mp4` after idle.

Signed Grok Build / site. Stopping here.

---

## 2026-10-10 — Grok Build / mobile

Local only. App commits are on `polish/2026-10-10`. Native model code is on `polish/ml-native` (`b09aeb3`, parent `b87d77a`) and does not include the site commits or the send below. No push, no deploy, no APK. Hub URL is still `https://ruletka.vip`. Version was not bumped.

Commits on `polish/2026-10-10`:
- `ecbc215` Say Ruletka.me in language packs and plain Russian for connection hints.
- `b87d77a` Hint when a real face model sees no face, and keep safety_log unsent.
- `978317e` Send safety_log now that the hub stores it without banning.

On `polish/ml-native`:
- `b09aeb3` Add the unbuilt native face-model path on this branch only.

What changed:
- Packs: visible `ruletka.vip` is Ruletka.me. Lines that are `https://ruletka.vip` stayed. Russian user hints no longer say TURN, WebRTC, or pin. Legal `page.*` and operator `log.*` still use those words. The Russian overlay matches the user hints. `pinHome` ("Ярлык на главный экран") stayed the home-screen shortcut.
- Self-preview still shows "Держите лицо в кадре" before a match. A second line, "Лица не видно — подвиньтесь в кадр", appears only after a ready detector reports no face for 3 seconds. The stub returns unknown, so that line stays hidden and Start is not blocked. Tests cover that.
- `polish/ml-native`: BlazeFace short-range `.tflite` (229746 bytes) and the Apache-2.0 license. The NSFW `.tflite` binary is absent; `GantMan/nsfw_model` `LICENSE.md` is included. Kotlin `VideoSink` tap is in `mobile/android-patches/` and `patch-android-native.sh` would copy it after prebuild. That script was not run. `react-native-fast-tflite` is not installed. In Node the detector stays the stub. Untested list is `mobile/assets/models/README.md` on that branch.
- Untested there: no prebuild, no Gradle, no APK, no device frames, I420 to RGB and rotation not checked, the TFLite interpreter was not run, the score layout was not confirmed, the NSFW file is missing, the package is not installed. Cherry-picking that commit started the APK hook; verify failed because this worktree has no `node_modules`. No APK was written.
- Send is on after the site inbox note for `77a811c`. `HUB_ACCEPTS_SAFETY_LOG` is true. A confirmed hit is stored on the phone and sent as `safety_log` with `log_only: true` and reason `explicit_shadow`. `sendSafetyLog` refuses `explicit_ai` and anything that is not `safety_log`. It does not call `reportUser`. The stub never confirms, so a phone sends nothing until a model is ready. The flag is still false on `polish/ml-native`.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with the main checkout's `mobile/node_modules` (symlink removed before each commit). L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1` on these commits.

Needs Anton:
- When to install `react-native-fast-tflite`, prebuild, and build. Merging `polish/ml-native` should keep `HUB_ACCEPTS_SAFETY_LOG` true from `978317e`.
- Shirtless is not its own class. Sexy only blurs. Explicit asks skip or report.
- Both hub rows still display Ruletka.me. The app still connects to `https://ruletka.vip`.
- Store listing files were not edited.
- `safety_log` reaches a running hub only after `77a811c` is deployed. This commit does not deploy.

Signed Grok Build / mobile. Stopping here.
