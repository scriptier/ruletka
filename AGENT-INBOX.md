
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

---

## 2026-10-10 — Grok Build / site

Local only on `polish/2026-10-10`. No push, no deploy, no APK. Did not edit `mobile/`. `polish/ml-native` is still `b09aeb3`.

Commits:
- `d6866ea` 301 `/privacy.html` and `/terms.html` to `/legal/privacy.html` and `/legal/terms.html`. Slashless and trailing-slash forms do the same. The real `/legal/` pages are not redirected. Aliases for the four English twins and `/blog/luchshie-videochaty-2026`.
- `68dd0aa` English pages and the Russian comparison. Sitemap lastmod 2026-10-10.

What changed:
- A store link to `https://ruletka.me/privacy.html` now 301s to `/legal/privacy.html`. `/terms.html` does the same. Canonical stays the `/legal/` URL. Other legal short paths were not added.
- English twins, hreflang both ways, x-default on the Russian URL: `/videozvonok-bez-registracii` ↔ `/en/free-video-call`, `/anonimnyj-videochat` ↔ `/en/anonymous-video-chat`, `/bezopasnost` ↔ `/en/safety`, `/pomosh/kamera-i-mikrofon` ↔ `/en/help/camera-microphone`. `/en/safety` is `ui/seo/en-safety.html`. Russian `ui/safety.html` is unchanged except the English alternate. `/videochat-bez-registracii` and `/download/android` stay Russian only.
- P10 article `/blog/luchshie-videochaty-2026`. Title, description, and H1 match the SEO report. It says it is not a ranking. Omegle is closed (November 2023) and is not in the live table. Nekto moderation, age, and apps are blank. Chatroulette and OmeTV store listings were not rechecked. Azar’s 0.006s is labeled as their claim. Ruletka.me is in the same table, including no 24/7 moderators, no Android model, no gender filter, and no iOS app. No English blog page.

Tests:
- `cargo test brand_tests`: 5 passed (`legal_shortcuts_point_at_the_real_pages`, `seo_aliases_skip_redirect_stubs`, and the three brand tests).
- `SKIP_L2=1 mobile/scripts/verify-before-apk.sh` in this worktree: L0 28 ok, 0 fail. L1 ok, including `npm test`. Pins in this tree are still `live.js?v=965` and `live-stage.css?v=633`. The check matches them. No pin edit.
- No browser click-through. The 301 and aliases are the cargo tests, not a loaded page.

Needs Anton:
- The RuStore listing itself was not edited. The 301 is what makes the existing `/privacy.html` link land on the policy. Say if the listing should be changed to `/legal/privacy.html` instead.
- `/privacy` and `/terms` without `.html` also 301. That is wider than the one broken listing URL.
- English `/en/blog/...` was not built. P9 (`/videochat-s-inostrancami`, `/golosovoj-chat`) was not built.
- The comparison repeats “Google Play” for package `me.ruletka.app`. The earlier note that the Play URL may 404 still stands. Not rechecked.
- Not deployed.

Signed Grok Build / site. Stopping here.

---

## 2026-10-10 — Grok Build / mobile

Local only on `polish/ml-native` in `~/freenet-roulette-ml`. Did not switch this worktree off `polish/2026-10-10`. Did not edit `~/freenet-roulette`. No push, no deploy, no prebuild, no APK.

Commits on `polish/ml-native` (was `b09aeb3`):
- `f02ffae` Bundle the official NSFW MobileNetV2 model and record the desktop check.
- `ef08f1e` Add a JVM-tested I420 to RGB helper.

What changed:
- NSFW weights are the official 1.2.0 file `https://github.com/GantMan/nsfw_model/releases/download/1.2.0/mobilenet_v2_140_224.1.zip` (zip sha256 `22c0892695929639c16ea302996b8f64df9c52e7a6c1d874c1de1047bfe109f7`), member `mobilenet_v2_140_224/saved_model.tflite`. 17355548 bytes, sha256 `380f98f7685f9d8a386f8cc595b6dfcb972989aae3d1b8b270d3a4a5b96fab40`, MIT. Recorded in `mobile/assets/models/README.md`. The h5, pb, and TFJS shards were not committed.
- Desktop interpreter is `ai-edge-litert` 2.3.0 in `~/rustore-ru-work/venv-ml`. Python 3.12 has no `tflite-runtime` wheel. System Python was not changed. Script `mobile/scripts/model-desktop/verify_models.py` exited 0.
- Face input is float32 `[1,128,128,3]`. Scores are logits in `classificators` `[1,896,1]` (sigmoid, then 0.5). Boxes are `regressors` `[1,896,16]`. On divide-by-255 the clothed portrait is present (sigmoid max 0.880) and the black frame is absent (0.054). `[-1, 1]` also separates them (0.939 / 0.008). Raw 0..255 does not see the face.
- NSFW input is float32 `[1,224,224,3]`. Output `Identity` `[1,5]` already sums to 1, order drawings, hentai, neutral, porn, sexy, matching `nsfw_detector/predict.py` which divides by 255. Portrait: neutral 0.9995, porn 0.0005, hentai 0, sexy 0. Black frame: porn 0.015, sexy 0.006, hentai 0.201, which stays under the 0.78 explicit gate. Fixtures are a generated clothed adult portrait and a blank frame. No explicit image was stored.
- `classify` still does not run the NSFW file, so a phone would still report nsfw unknown. The require is there so Metro can bundle it. `createSafetyDetector("tflite")` stays the stub until `react-native-fast-tflite` is installed. `HUB_ACCEPTS_SAFETY_LOG` is still false on this branch.
- `I420Rgb.sampleSquare` is the I420 → RGB and rotation math. `I420RgbTest.kt` compiled with kotlinc-jvm 2.3.10 and printed `0 failed` (0/90/180/270, stride padding, BT.601, clamp). No Android SDK. The WebRTC plane copy has not been checked on a device. `patch-android-native.sh` would copy `I420Rgb.kt`. That script was not run.

Tests in the ml worktree: `verify_models.py` exit 0. JVM jar `0 failed`. `SKIP_L2=1 ./scripts/verify-before-apk.sh`: L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. The `node_modules` symlink was removed before the commits. `SKIP_APK_HOOK=1`. No APK process.

Needs Anton:
- When to install `react-native-fast-tflite`, prebuild, and build. The NSFW file is in the tree and not executed.
- The app helper still divides by 255, which passed both models on these images. MediaPipe's usual face norm is `[-1, 1]`, and that scored a bit higher on the portrait. Say if the face model should use its own norm.
- Merging this branch should keep `HUB_ACCEPTS_SAFETY_LOG` true from `978317e`. This branch does not have that send path.
- Shirtless is still not its own class.
- Not deployed. No phone smoke.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-10 13:40 — Ruletka Developer
Next assignments (prompts in ~/rustore-ru-work/prompts/site4.txt mobile4.txt ios3.txt store3.txt): site — P9 /videochat-s-inostrancami, BreadcrumbList + Org/SoftwareApplication audit (skip golosovoj unless camera-off is clearly intentional). mobile — pre-queue face self-check (stub must not hard-block) + Russian i18n gap pass on polish/2026-10-10 only. ios — A/B/C decision matrix docs. store — screenshot captions + short-desc A/B in LISTING-RU-2026-10.md. All local; no push/deploy/build/upload.

---

## 2026-10-10 — Grok Build / ios

Local only on `polish/2026-10-10`. No push, no deploy, no EAS build, no App Store Connect, no Submit for Review. Did not edit `mobile/`, `ui/`, or `eas.json`.

Commits:
- `1618f19` docs: add the iOS A/B/C decision matrix.

What changed:
- Extended `knowledge/specs/ios-readiness-2026-10.md` with §3.1. For A (friends-by-code TestFlight), B (Safari only), and C (stranger-match): App Store exposure, engineering scope on this branch, moderation/reporting, and the commands that wait for an explicit OK (`eas build`, `eas submit`, Submit for Review, plus deploy / ml-native for C).
- Corrected the earlier safety-log line: `HUB_ACCEPTS_SAFETY_LOG` is true on this branch. The stub still never confirms, so a phone sends nothing. Hub commit `77a811c` is in the tree and is not deployed by this tab.
- Candidate id note only: uncommitted `eas.json` on the connect tree has `6804910924`. This branch stays `REPLACE_ASC_APP_ID`.

Tests:
- `node mobile/src/safety/logic.test.mjs`: OK (`HUB_ACCEPTS_SAFETY_LOG` true). Typeless-package warning. Did not change `mobile/package.json`.
- Did not run `verify-before-apk.sh` or `npm test`. This hop is the spec only. Those scripts read `mobile/`, which the mobile tab owns.

Needs Anton:
- Pick A, B, or C in chat.
- Confirm whether `6804910924` is the real App Store Connect id before anyone edits `eas.json`.
- Say yes before any `eas build`, `eas submit`, or Submit for Review. Option C also needs him to accept the Guideline 1.2 removal risk.

Signed Grok Build / ios. Stopping here.

---

## 2026-10-10 — Grok Build / store

Local only on `polish/2026-10-10`. No push, no deploy, no APK/AAB, no Play Console, no RuStore console. Did not edit `ui/`, `bridge/`, or `mobile/` outside `mobile/assets/store/`.

Commits:
- `c3fdaf2` Add store caption drafts and two short-description variants.

What changed:
- Extended `mobile/assets/store/LISTING-RU-2026-10.md`. Screenshot captions in RU and EN for phone 01–09. Tablet 7" and 10" 01–06 share the first six captions. Shots are layout mocks: no real faces; codes, names, and queue counts are samples. Captions say so. 01–06 are the upload set. 07–09 stay out until Anton accepts the sample numbers.
- Short A 74/80: «Чат рулетка: видеочат без регистрации. Случайный собеседник и друзья. 18+.»
- Short B 73/80: «Видеочат без регистрации — чат рулетка. Случайный собеседник и друг. 18+.»
- One line: final title waits on Anton (`Ruletka.me — чат рулетка` vs plain `Ruletka.me` vs live lowercase `ruletka.me`).

Tests:
- `SKIP_L2=1 ./scripts/verify-before-apk.sh` with `NODE_PATH` on the main checkout’s `mobile/node_modules`. L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- Title: the 24-character line, plain `Ruletka.me`, or live `ruletka.me`.
- Short A or short B.
- Whether phone 07–09 may be uploaded with sample queue counts, and whether the home mock’s `ruletka.vip` / `v0.1.27` art should be redrawn before any upload.
- Confirm the camera-deny path still opens Friends and Settings. Shot 2’s caption repeats that mock sentence.

Signed Grok Build / store. Stopping here.

---

## 2026-10-10 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK. Did not install `react-native-fast-tflite`. Did not edit the site tab’s `ui/` or `bridge/` files.

Commits:
- `b6a06ec` Hold the stranger queue when a ready face model sees no face.
- `0bdf959` Say the remaining connection lines in plain Russian.

What changed:
- Pre-queue face path is `preQueueFaceGate`. A stub (`ready: false`) does not hint and does not gate, so Start still searches. A ready model that reports no face for 3 seconds shows «Лица не видно — подвиньтесь в кадр» and sets `softGate`. Start stays tappable. Pressing it while the gate is on shows that hint and does not send the queue. A face, or `unknown`, clears it. Friend calls skip the watch and the gate. `hardBlock` is always false.
- The detector on this branch is still the stub, so a phone does not gate today. The path is what a real model will hit.
- Russian user strings that still named the protocol: `conn.stunOnly`, `sec.pathUnknownTitle`, `settings.preferDirectOn`, and `status.webrtc` («вебртк»). They now say прямой поиск, соединение, напрямую, and связь. `page.*` and `log.*` still use TURN and WebRTC. `https://ruletka.vip` in the terms line stayed. `pinHome` stayed «Ярлык на главный экран». Visible name stays Ruletka.me.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commits). L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK process.

Needs Anton:
- The soft gate holds the stranger queue only after a ready model has seen no face for 3 seconds. Say if Start should be disabled as well, or if the queue should still go out and only the hint should show.
- No phone smoke. The stub cannot show the new hint.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-10 — Grok Build / site

Local only on `polish/2026-10-10`. No push, no deploy, no APK. Did not edit `mobile/`. Did not move `polish/ml-native`.

Commits:
- `03daaaf` Alias `/videochat-s-inostrancami` and `/en/video-chat-with-foreigners`, with trailing slashes. `/golosovoj-chat` is not an alias.
- `749ae5f` The Russian page, a thin English twin, sitemap, footer link, BreadcrumbList, and the app schema audit.

What changed:
- `/videochat-s-inostrancami` is about 660 words. Title and H1 match the SEO report. The description does not promise a foreign partner: the queue is whoever is free, the 14 languages are button labels, and a friend code calls one person. No country hubs. CTA is «Начать чат» to `/live.html`. 18+. Link to `/bezopasnost`.
- English twin `/en/video-chat-with-foreigners`. Hreflang both ways. x-default is the Russian URL.
- `/golosovoj-chat` was not published. A laptop with zero video tracks can send audio, and Hide blurs your picture. Neither is a voice-roulette mode worth ranking.
- BreadcrumbList JSON-LD, plus a visible crumb, on the SEO sub-pages, safety, camera help, Android, the comparison, and the English twins. Home pages stay without a breadcrumb.
- Index `SoftwareApplication` has `@id` `https://ruletka.me/#app`, logo and `downloadUrl` on ruletka.me, `operatingSystem` `Web, Android`. Android page `@id` is `https://ruletka.me/download/android#app`, `operatingSystem` `Android`, `downloadUrl` is the .me Android page. RuStore is `installUrl`. Play is `sameAs`. No `.vip` in those JSON-LD blocks. No iOS in `operatingSystem`.
- Footer label «Видеочат с иностранцами» is on the Russian cluster, including `/`.

Tests:
- `cargo test brand_tests`: 5 passed.
- JSON-LD on the touched pages parses. No `ruletka.vip` inside those scripts.
- `SKIP_L2=1 mobile/scripts/verify-before-apk.sh` in this worktree: L0 28 ok, L1 ok, including `npm test`. Passed 12, failed 0. No script files changed, so `node --check` had nothing new. Pins were not edited.
- No browser click-through. Aliases are the cargo test.

Needs Anton:
- Say if `/golosovoj-chat` should exist anyway. This hop treats camera-off as a missing-camera fallback, not a product mode.
- Country or language hubs (`/uk/`, `/pl/`, and the rest) were not built.
- `downloadUrl` is the Android page on ruletka.me. The APK file is not in this worktree, so the schema does not point at a binary. Say if it should point at RuStore instead.
- Play listing may still 404. Not rechecked.
- Not deployed.

Signed Grok Build / site. Stopping here.



---

## 2026-10-10 14:42 MDT — Ruletka Developer
Next assignments (prompts in ~/rustore-ru-work/prompts/site5.txt mobile5.txt ios4.txt store4.txt): site — remaining SEO tech (live H1/T5, hreflang/T4, robots Clean-param/T8, commit knowledge/research/). mobile — during-call sender face toast + outgoing self-blur path (stub-safe) + leftover i18n. ios — privacy/ToS checklist per A/B/C + TestFlight runbook (docs only). store — optional full-desc blocks, release-notes draft, RuStore tag notes. Connect left alone. All local; no push/deploy/build/upload. Review emails sent for site P9/schema, mobile face soft-gate, ios A/B/C matrix, store captions+short A/B.

---

## 2026-10-10 — Grok Build / site

Local only on `polish/2026-10-10`. No push, no deploy, no APK. Did not edit `mobile/`. Left the other tabs' dirty `knowledge/specs/ios-readiness-2026-10.md` and `mobile/assets/store/LISTING-RU-2026-10.md` unstaged.

Commits:
- `4365845` Chat-page hreflang now points at `https://ruletka.me/live.html` (ru and x-default). Sitemap matches.
- `c442959` Research notes committed as written: `knowledge/research/seo-2026-10-08.md` and `knowledge/research/moderation-ui-2026-10-08.md`.

What changed:
- T5 was already in the tree. The age gate is `<h2 id="age-gate-title">` inside `role="dialog"`. `#btn-age-yes` is still the one Start. The only H1 is visually hidden: «Чат рулетка — видеочат со случайными людьми», the same line as the Russian home. Not rewritten.
- T4: every landing pair is reciprocal and path-based. No `/?lang=` hreflang. x-default is `/` for the home pair and the Russian URL for each other pair. `/videochat-bez-registracii`, `/download/android`, and the 2026 comparison stay Russian only, so they have ru + x-default and no en. The chat page was the gap: it claimed `/` and `/en/`, and those pages do not point back. It no longer does.
- T8: `Clean-param: lang /` is already under `User-agent: Yandex`. Left it. `?lang` is still written onto live links by the home script and `site-i18n.js` so a chosen language reaches the chat. It is not an hreflang target.
- og:url and Organization JSON-LD on the home, English home, chat, Android page, and SEO landings are ruletka.me. Legal, donate, updates, and admin source files still say ruletka.vip. The .me host rewrites those on the way out. Not edited this hop.

Tests:
- `cargo test brand_tests`: 5 passed.
- No script file changed, so `node --check` had nothing new.
- `SKIP_L2=1 mobile/scripts/verify-before-apk.sh`: L0 28 ok, L1 ok, including `npm test`. Passed 12, failed 0. Pins were not edited.
- No browser click-through.

Needs Anton:
- DNS, Yandex Webmaster, Search Console, and http on port 80 were not touched.
- Country hubs and `/golosovoj-chat` were not built.
- Not deployed.

Signed Grok Build / site. Stopping here.

---

## 2026-10-10 — Grok Build / ios

Local only on `polish/2026-10-10`. No push, no deploy, no EAS build, no App Store Connect, no Submit for Review. Did not edit `mobile/`, `ui/`, or `eas.json`.

Commits:
- `7c60f42` docs: privacy checklist and internal TestFlight runbook.

What changed:
- Extended `knowledge/specs/ios-readiness-2026-10.md` with §5 and §6. A and C: camera string overclaims “not uploaded” because a report can send a still; privacy `media1` says browsers only; `reports` should say `safety_log` is log-only and the stub does not send. A also needs the legal page to match the friends-only binary. B is Safari notes only (no iOS schema, no “filter is on” for Safari, EULA stays conditional).
- Runbook: `production-friends` (A) or `production` (C), then `eas submit --profile production`. `preview-friends` is ad hoc, not TestFlight. Certificates and the App Store Connect id wait for his Apple login and 2FA. This Linux box has no `xcodebuild`.
- `eas.json` stays `REPLACE_ASC_APP_ID`. Candidate `6804910924` is notes-only.

Tests:
- `node mobile/src/safety/logic.test.mjs`: exit 0. Typeless-package warning. Did not change `mobile/package.json`.
- Did not run `verify-before-apk.sh` or `npm test`. This hop is the spec only.

Needs Anton:
- Pick A, B, or C.
- Confirm `6804910924` before anyone edits `eas.json`.
- Say yes before `eas build`, `eas submit`, or Submit for Review. Option C also needs the Guideline 1.2 acceptance.

Signed Grok Build / ios. Stopping here.

---

## 2026-10-10 — Grok Build / store

Local only on `polish/2026-10-10`. No push, no deploy, no APK/AAB, no Play Console, no RuStore console. Did not edit `ui/`, `bridge/`, or `mobile/` outside `mobile/assets/store/`. Title and short A/B are still open. Nothing uploaded.

Commits:
- `b97f5ba` Add optional listing blocks, release notes, and tag notes.

What changed:
- Extended `mobile/assets/store/LISTING-RU-2026-10.md` with §6–§8.
- §6 optional paragraphs, RU and EN, for debate, gifts, and a 3–4 person stage. Not in the base paste. Base stays 1863/4000 RU and 1721/4000 EN. All three together: 2548 RU and 2429 EN, still under 4000. Every Russian add-on crosses the ~2000 fold (137 characters left). English debate, gifts, and the 3–4 block each still fit under 2000 with the English base.
- §7 what’s-new draft, no version number. RU 211/500, EN 189/500 (Play’s cap). Does not claim on-device blur. `app.json` stays 0.1.471 / versionCode 479.
- §8 tag note only: keep Общение, Социальные, Видеозвонки, and Обмен сообщениями. Recommend dropping Знакомства. Console not touched.

Tests:
- `SKIP_L2=1 ./scripts/verify-before-apk.sh` with `NODE_PATH` on the main checkout’s `mobile/node_modules`. L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- Title and short A vs B, still open.
- Paste or skip each optional block. Pasting the gifts block should drop the shorter stars sentence so it is not said twice.
- Whether to drop the Знакомства tag when he next opens RuStore.
- Release notes stay off the live 0.1.479 card until a new binary exists.

Signed Grok Build / store. Stopping here.

---

## 2026-10-10 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` (`ef08f1e`, clean) or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK/AAB. Did not install `react-native-fast-tflite`. Did not enable NudeNet. Did not change hub ban behaviour or resend `safety_log`.

Commits:
- `f7ffcb2` Cover the local preview when a ready face model sees no face.

What changed:
- `duringCallSelfCheck` sits next to the existing pre-queue gate. It reuses `faceForSelfCheck` and `pushFaceSample` (3 seconds). A stub (`ready: false`) does not toast, does not blur, and does not end the call. A ready model that reports no face for 3 seconds sets `selfBlur` and `toast` once. The next second keeps the blur and does not toast again. A face clears it. Friend calls reset the watch and do none of this. `hardBlock` stays false.
- On a matched stranger call, `live.tsx` runs that check once a second. The toast is the existing line «Держите лицо в кадре» (`mobile.live.faceInFrame`). The flag covers the local tile, the self PiP, or the swapped self stage with the existing `PartnerBlurVeil`. The camera view stays mounted. This path does not call `setCamEnabled` and does not send `self_hide`.
- The cover is local only. The partner still receives the real camera until a native frame tap exists. Anton decides when the sent track should be replaced.
- The detector on this branch is still the stub, so a phone does not toast or cover today.
- Russian packs: no remaining user-facing TURN, WebRTC, or pin strings outside `page.*` and `log.*`. «Спин» is the spin button. Visible name stays Ruletka.me. No pack edit this hop.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commit). L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK process.

Needs Anton:
- The outgoing path is a local cover, not a replaced track. Say when the sent frames should actually be blurred.
- No phone smoke. The stub cannot show the toast or the cover.

Signed Grok Build / mobile. Stopping here.



---

## 2026-10-10 15:42 MDT — Ruletka Developer
Next assignments (prompts in ~/rustore-ru-work/prompts/site6.txt mobile6.txt ios5.txt store5.txt): site — T6 leftover .vip cleanup in static UI + trust strip on home/EN + honest report-still privacy line. mobile — log-only face_ok/safety_log when ready model sees no face (stub-safe) + optional AI-safety chip. ios — ASC metadata drafts per A/B/C, screenshot shot list, Privacy Nutrition Labels checklist (docs only). store — listing QA checklist, screenshot order/captions map, feature-graphic/promo drafts. Connect left alone. All local; no push/deploy/build/upload. Review emails sent for site SEO tech T5/T4/T8, mobile during-call face toast/self-blur, ios privacy+TestFlight runbook, store optional blocks+release notes+tags.

---

## 2026-10-10 — Grok Build / store

Local only on `polish/2026-10-10`. No push, no deploy, no APK/AAB, no Play Console, no RuStore console. Did not edit `ui/`, `bridge/`, or `mobile/` outside `mobile/assets/store/`. Title and short A vs B stay open. Nothing uploaded.

Commits:
- `dc0eec2` Add a pre-paste listing checklist and promo lines.

What changed:
- Extended `mobile/assets/store/LISTING-RU-2026-10.md` with §9–§11.
- §9 QA: legal URLs on ruletka.me returned 200 (`/legal/privacy.html`, terms, delete, child-safety, `/safety.html`, `/`). `https://ruletka.me/privacy.html` is still 404. Paste fences have no `ruletka.vip`. Package `me.ruletka.app`. Contacts `support@ruletka.me` and `privacy@ruletka.me`. Age stays 18+.
- Art fail: `phone-03-home.png` and both tablet twins still show `ruletka.vip` and `v0.1.27`. Hold those three. Feature graphic is 1024×500 brand art (`ruletka` / `peer-to-peer video · 18+`), not a screenshot.
- §10 order is the same for Play and RuStore: age gate, permissions, home, preview, friends, safety. Captions are the §5 lines. Phone 07–09 stay out.
- §11 overlay lines, not the title and not short A/B: RU-1 17, RU-2 30, EN-1 23, EN-2 16. Play has no separate promo-text field.

Tests:
- `SKIP_L2=1 ./scripts/verify-before-apk.sh` with `NODE_PATH` on the main checkout’s `mobile/node_modules`. L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- Title and short A vs B, still open.
- Whether UI mockups are acceptable, or only device captures.
- Redraw home shot 03 (and tablet twins) before any upload of that scene.
- Which feature-graphic line, if any, replaces the current `peer-to-peer video · 18+`.

Signed Grok Build / store. Stopping here.

---

## 2026-10-10 — Grok Build / ios

Local only on `polish/2026-10-10`. No push, no deploy, no EAS build, no App Store Connect, no Submit for Review. Did not edit `mobile/`, `ui/`, or `eas.json`.

Commits:
- `1e11ed6` docs: App Store drafts, screenshot list, and privacy labels.

What changed:
- Extended `knowledge/specs/ios-readiness-2026-10.md` with §7. A: subtitle `Friend video calls. 18+.` (24), friends keywords, no roulette/random. C: subtitle `P2P video chat. 18+.` (20), review notes include the Guideline 1.2 stub-detector sentence. B: do not create a listing.
- Screenshots: Dynamic Island medium 1179×2556 or 1206×2622 required; iPad 13-inch required while `supportsTablet` is true. Shot list is real screens only, 4+ frames, no composited faces.
- Privacy labels: camera, mic, report still, app user id (stranger mode has an id and no email account), coarse location only because the hub city is shown, funnel event with no user id. No tracking. Do not declare `safety_log` on the stub build. Do not copy the Play draft’s location “No”.
- `eas.json` stays `REPLACE_ASC_APP_ID`. Candidate `6804910924` is notes-only.

Tests:
- `node mobile/src/safety/logic.test.mjs`: exit 0.
- Did not run `verify-before-apk.sh` or `npm test`. This hop is the spec only.

Needs Anton:
- Pick A, B, or C before anyone pastes §7.
- Confirm `6804910924` before any `eas.json` edit.
- Say yes before `eas build`, `eas submit`, or Submit for Review. Option C also needs the Guideline 1.2 acceptance.
- If the iOS build should not show city/country, say so. The label draft declares Coarse Location while that line is on screen.

Signed Grok Build / ios. Stopping here.

---

## 2026-10-10 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` (`ef08f1e`, clean) or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK/AAB. Did not install `react-native-fast-tflite`. Did not enable NudeNet. Did not merge ml-native. Did not install a frame tap. Did not upload frames. Did not open bans or appeals. Did not edit `bridge/`.

Commits:
- `877dadb` Send a log-only face_ok flag when a ready face watch fires.

What changed:
- `faceWatchSafetyLog` sends one `safety_log` when a ready pre-queue or during-call watch fires. `log_only: true`, `reason: "face_absent"`, `face: "absent"`, `face_ok: false`. Target is empty, so it is not a note about the partner. No skip, no hard block, no `report_user`, no `explicit_ai`.
- A stub (`ready: false`) returns no record. A ready model inside the 3-second window does not send. The next second of the same absence does not send again. Friend calls do not send.
- `sendSafetyLog` keeps `explicit_shadow` for the existing NSFW shadow line and passes `face_absent` plus `face_ok: false` for this one. It still refuses `explicit_ai` and `report_user`.
- The hub parser has no `face_ok` field, so that key is dropped on the way in. The stored line still has `reason` and `face`, which is the equivalent that lands today. Ban behaviour was not changed.
- On a stranger call, while the filter pref is on, a small line uses the existing string «Фильтр включён» (`mobile.settings.safetyOnToast`). Friend calls hide it. It does not say AI. The detector is still the stub, so the line means the setting is on.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commit). L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK process.

Needs Anton:
- Say if the site tab should persist `face_ok` on the stored line. Today the hub keeps `reason: "face_absent"` and `face: "absent"`.
- No phone smoke. The stub sends nothing and does not show a model result.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-10 — Grok Build / site

Local only on `polish/2026-10-10`. No push, no deploy, no APK/AAB, no DNS change. Did not edit `mobile/` or `bridge/`. Did not publish `/golosovoj-chat` or country hubs. Soft-gate (disable Start vs hint-only) left as it is.

Commits:
- `b305f8e` fix(site): use ruletka.me as the canonical host on static pages
- `683b403` feat(site): add the start-screen trust strip
- `80abba7` fix(site): say a report can include one still

What changed:
- Static pages you own (legal, donate, contribute, updates, offline, sim, admin, security.txt) now use `ruletka.me` in canonical, og:url, and the visible product name. EULA `og:image` points at `/brand/logo-mark.png`. Legal i18n leads with ruletka.me and still names ruletka.vip as the same product, including “a hub that is not either host.” The August changelog line that says opening ruletka.vip went straight to chat is unchanged.
- Russian home and `/en/` have three lines under Start: be kind, keep it appropriate, AI and reports help keep the chat safe. No matched “AI safety on” chip. The existing matched chip sits in the hidden stage header, so a new line would be new chrome. No new protocol.
- Home, the English twin, the SEO pages that said video is never recorded or uploaded, the privacy “reports” paragraph, and the live camera hint now say a report can include one still. Safety and anonymous pages already said that. This does not say the hub stores sampled frames from the call.

Tests:
- `cargo test --manifest-path bridge/Cargo.toml brand_tests`: 5 passed, 0 failed. Pre-existing warnings in simple.rs, config, and federation were left.
- `node --check` on `ui/site-i18n.js` and `ui/i18n.js`: ok.
- `SKIP_L2=1 mobile/scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commit). L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK.
- No browser tools in this session, so the trust strip and the new sentences were not clicked through.

Needs Anton:
- `security@ruletka.vip` is still the security.txt mailbox. Public URLs in that file are now ruletka.me.
- Helper download notes still point at `https://ruletka.vip` (`ui/download/START-WINDOWS.txt`, `ui/download/ANDROID-LATEST.txt`). `hubs.json` and `source.json` still use the vip seed URL.
- On ruletka.me, `brand_html` still rewrites every `ruletka.vip` token in HTML, including the August changelog, when the page is served. The source keeps the history.
- Soft-gate: disable Start, or hint only, still open.
- No deploy.

Signed Grok Build / site. Stopping here.


---

## 2026-10-10 16:40 MDT — Ruletka Developer
Next assignments (prompts in ~/rustore-ru-work/prompts/mobile7.txt ios6.txt store6.txt): mobile — stub-safe receiver/partner blur+shadow log path (no NudeNet/APK). ios — age rating + export compliance + review demo notes (docs). store — Play Data safety + rating questionnaire drafts + paste-order checklist. site left on release/2026-10-10 conflict merge in ~/freenet-roulette-release (site-release.txt); connect left alone. Review emails sent for site .vip+trust+report-still, mobile face_ok/safety_log, ios ASC metadata+shots+labels, store listing QA+shot order+feature-graphic. All local; no push/deploy/build/upload.

---

## 2026-10-10 — Grok Build / store

Local only on `polish/2026-10-10`. No push, no deploy, no APK/AAB, no Play Console, no RuStore console. Did not edit `ui/`, `bridge/`, or `mobile/` outside `mobile/assets/store/`. Title and short A vs B stay open. Nothing uploaded.

Commits:
- `8fdab48` Draft Data safety answers and the upload paste order.

What changed:
- Extended `mobile/assets/store/LISTING-RU-2026-10.md` with §12–§14.
- §12 Data safety from this branch: camera and mic to the peer, city from the connection IP (no GPS), friend-chat history on the hub, one report JPEG, funnel `{event}` only, Expo push token for friend-call alerts. Not sold. No ads SDK in `mobile/package.json`. Do not mark tracking.
- §13 rating: 18+ because strangers are on camera. Declare block, report, and the still. Do not claim the Android detector blurs anything. It is still a stub.
- §14 paste order for the day he says upload. Title and short are blank steps, not a choice. Hold home shot 03 and phone 07–09.

Tests:
- `SKIP_L2=1 ./scripts/verify-before-apk.sh` with `NODE_PATH` on the main checkout’s `mobile/node_modules`. L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- Title and short A vs B, still open.
- Confirm the Data safety draft before anyone saves the form. Hub storage of the report still is from the 2026-10-08 research. This hop did not re-open `bridge/`.
- Say upload before any of §14 is used.

Signed Grok Build / store. Stopping here.

---

## 2026-10-10 — Grok Build / ios

Local only on `polish/2026-10-10`. No push, no deploy, no EAS build, no App Store Connect, no Submit for Review. Did not edit `mobile/`, `ui/`, or `eas.json`.

Commits:
- `e099494` docs: age rating, export compliance, and review contact.

What changed:
- Extended `knowledge/specs/ios-readiness-2026-10.md` with §8.
- Age rating: messaging and user-generated content Yes; unrestricted web, social-media feed, ads, and graphic sexual content No. Override to 18+ for both A and C, because the rules screen is 18+ and those capability rows alone sit in Apple’s 4+ examples. C calls out that strangers can show mature video. Graphic sexual content would mark the app Unrated.
- Export: plist already has `ITSAppUsesNonExemptEncryption` false. Wording if the form asks is HTTPS plus WebRTC DTLS-SRTP, standard exemption, no custom cipher. No CCATS or other certificate number exists here.
- Review contact: support@ruletka.me, no demo password. A uses a friend code created at install and a second device. C adds the Guideline 1.2 acceptance bullet.
- `eas.json` stays `REPLACE_ASC_APP_ID`. Candidate `6804910924` is notes-only.

Tests:
- `node mobile/src/safety/logic.test.mjs`: exit 0.
- Did not run `verify-before-apk.sh` or `npm test`. This hop is the spec only.

Needs Anton:
- Pick A, B, or C before anyone submits these answers.
- Confirm `6804910924` before any `eas.json` edit.
- Type his own phone on the review contact form. The repo does not have one.
- Say yes before `eas build`, `eas submit`, or Submit for Review. Option C also needs the Guideline 1.2 acceptance.
- Declared Age Range API is not in the app. Some regions require it even at 18+.

Signed Grok Build / ios. Stopping here.

---

## 2026-10-10 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` (`ef08f1e`, clean) or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK/AAB. Did not install `react-native-fast-tflite`. Did not enable NudeNet. Did not merge ml-native. Did not install a frame tap. Did not change hub ban behaviour. Did not open appeals. Did not edit `bridge/`.

Commits:
- `377ebd7` Blur the partner locally when a ready model flags the stream.
- `9045a16` Say the leftover connection words in plain Russian.

What changed:
- `receiverPartnerCheck` sits next to the sender self-check. It reuses `pushVerdict` (sexy, explicit, or 2 of the last 3). A stub (`ready: false`) does not blur, toast, or send. A friend call does not either. A ready hit sets a local partner blur through the existing veil, toasts «Видео может быть откровенным» once, and may send one `safety_log` with `log_only: true` and `reason: "partner_flag_shadow"`. `hardBlock` and `skip` stay false. It does not call skip, `report_user`, or `explicit_ai`. A clean window clears the blur flag. The live veil is not peeled automatically, so an intro veil the user already has stays until they show video.
- `sendSafetyLog` passes `partner_flag_shadow` through and still refuses `explicit_ai` and `report_user`. The hub stores `reason` as text and does not ban on it.
- The detector on this branch is still the stub, so a phone does not blur or send today.
- Connection and live lines that still said Direct, P2P, Connection, Prefer Direct, A/V, HTTPS, firewall, reconnect, or Block now use plain Russian. VPN stayed, because that is the word users already know. `page.*` and `log.*` were left. Visible name stays Ruletka.me.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commits). L0 28 ok, L1 ok, `npm test` ok. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK process.

Needs Anton:
- The automatic skip/report alert on a confirmed partner hit is off in this prep path. Say if it should come back later, still without a ban.
- No phone smoke. The stub cannot show the blur or the toast.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-10 — Grok Build / site

Release prep only, in `~/freenet-roulette-release` on `release/2026-10-10`. Did not deploy. Did not push. Did not edit `~/freenet-roulette`. Did not edit mobile app source.

Commit:
- `547bf44` release: layer site polish on the live ui/bridge snapshot (parent `5059ed5`).

What landed:
- Conflicts resolved with the live snapshot as connect behavior and polish layered on top. `simple.rs` keeps both `ws_hold_tests` and `safety_log_hub_tests`. `safety_log` stays log-only.
- `live.js` / `live-stage.css` clean apply kept after review: one 18+ Start (`#btn-age-yes` calls `acceptRulesAndEnter`, friend/room/invite skips auto-start), low-pool line when online &lt; 5, sentence-case side labels, no-cam mark, `Ruletka.me` fallback. No ICE, TURN, or match edits in those hunks. `main.rs` / `protocol.rs` are SEO aliases, 301s, brand collapse, and `SafetyLog` parse only.
- `/` is the Russian home. `/en/` is the English twin. Browser language does not swap `/`.
- Pins above the live snapshot: `live.js?v=986`, `live-stage.css?v=656`, `i18n.js?v=268`, language packs `?v=147`, `brand.js?v=3`, `home.css?v=102`, `site-i18n.js?v=145` with `PACK_V` 147. `webrtc.js` 356, `hubs.js` 157, `identity.js` 156, `live-brand.css` 24 unchanged. `meta.json` fetch stays `?v=137` (file not in the diff). Session pack key `ruletka-i18n-pack-v98-` → `v99`. `pwa-install.js` pin is 13 (snapshot live.html was 12); first visit skips the update banner.

Tests:
- `cargo test --manifest-path bridge/Cargo.toml`: 37 passed, 0 failed. Includes brand, `safety_log` parse, `safety_log` hub, and both ws-hold tests.
- `cargo build -p freenet-roulette-bridge --release`: finished, exit 0.
- `node --check`: `brand.js`, `i18n.js`, `live.js`, `pwa-install.js`, `site-i18n.js`, and inline scripts in the 33 changed HTML files. 0 failures.
- `SKIP_L2=1 mobile/scripts/verify-before-apk.sh` with `NODE_PATH=~/freenet-roulette/mobile/node_modules`: pin asserts passed (`live.js` 986, `live-stage.css` 656, Russian home). L0 overall 136 ok, 4 fail, script exit 1. The four fails are AndroidManifest orientation, TapPressable, call avatar, and StarGiftPopup. This worktree’s `mobile/` app source does not contain the live dirty tree’s files, and I did not edit it. L1 ok. `npm test` ok (friend-invite, geo, live-units 11).
- `verify-before-apk.sh` has no hardcoded 985/655. It reads `live.html` and runs `verify-match-ux.mjs`. Those expected numbers are now 986/656. The index check now requires canonical `https://ruletka.me/` plus a link to `/live.html`, because `/` is no longer a redirect stub.
- Local bridge `127.0.0.1:18790` with `Host: ruletka.me` (redirects not followed): 200 `/` «Чат рулетка — бесплатный видеочат без регистрации | Ruletka.me»; 200 `/en/` «Ruletka.me — Free Random Video Chat Roulette, No Sign-Up (18+)»; 200 `/live.html` «Чат рулетка — живой видеочат | Ruletka.me»; 200 `/bezopasnost` «Безопасность в чат рулетке — правила, блок и жалобы | Ruletka.me»; 301 `/privacy.html` → `/legal/privacy.html`; 301 `/terms.html` → `/legal/terms.html`; 301 `/download` and `/download/android.html` → `/download/android`; 200 `/operators` «Операторам — Ruletka.me»; 200 `/sitemap.xml` first loc `https://ruletka.me/`. No browser click-through.

Unsure hunks:
- `contribute.html` consumer card no longer links `/hubs.json` directly. It points at `/operators`, which still links `/hubs.json`.
- Sitemap is the polish `.me` file. It does not list `/home.html`, `/safety.html`, `/contribute.html`, `/updates.html`, `/donate.html`, or `/download/android.html`. No `.vip` URLs put back. `/safety.html` still returns 200; the SEO URL is `/bezopasnost`. `/download/android.html` 301s to the URL that is in the sitemap. `robots.txt` still `Disallow: /operators` (page is 200, noindex), same as polish.
- Android page APK link kept `?v=475` and the snapshot line 0.1.475 / vc483. Session card says the disk APK is 0.1.480-vc488. I did not write 480 onto the page.
- On the `.me` host, `brand_html` still rewrites `ruletka.vip` tokens in served HTML, including a changelog line that names the old opening of ruletka.vip.
- Play URL is still on the Android page and may 404.

Not deployed. You run the deploy.

Signed Grok Build / site. Stopping here.


---

## 2026-10-10 17:00 — Ruletka Developer
DEPLOYED to production (Anton: "go ahead and make it live"): release/2026-10-10 @ 547bf44 (live working-tree snapshot + site polish), local tag deployed-2026-10-10. Server backup: /opt/ruletka/backups/predeploy-20261010T225600Z (bin/ui/deploy). install-on-server.sh stopped at apt-get update (Caddy cloudsmith repo 402); bridge restarted manually; service file/Caddyfile only differ by comments so not reinstalled. Site APK and download files kept byte-identical from prod. App, store, and polish/ml-native NOT shipped. Not pushed to git. ~/freenet-roulette main tree untouched — connect: base future web work on release/2026-10-10 or merge it, or the next deploy from main will roll these back.

---

## 2026-10-11 13:40 MDT — Ruletka Developer
Next assignments (prompts in ~/rustore-ru-work/prompts/site7.txt mobile8.txt): site — live idle self-preview + face/lighting hint on release/2026-10-10 in ~/freenet-roulette-release (P8 already present; skip rebuild). mobile — Start self-preview large + face hint on polish/2026-10-10 (stub-safe). ios/store left idle (Anton-blocked: A/B/C, ASC id, listing title/short, Data safety paste). Connect left alone. All local; no push/deploy/build/upload. No new review email this run (no fresh finished hops since prior batch).

---

## 2026-10-10 — Grok Build / site

Local only on `release/2026-10-10` in `~/freenet-roulette-release`. Did not deploy. Did not push. Did not edit `~/freenet-roulette`. Did not rebuild `/pomosh/kamera-i-mikrofon`. Did not edit mobile app source.

Commit:
- `e634efd` feat(live): show your camera large on the idle start screen (parent of this hop is the deployed `547bf44`).

What changed:
- On the live idle screen, after the local camera is actually painting (`has-local-feed`, live track, decoded frames, and not the no-cam portrait), the existing `#tile-local` / `#local` fills the stage. The brand loop hides behind it. Start stays on top.
- One hint, sentence case, via `idle.faceHint`: EN “Keep your face visible and well lit”; RU «Держите лицо в кадре и при хорошем свете». The line stays invisible until the camera is painting. No face circle. Start is not disabled and this path does not call match, ICE, or TURN.
- No camera keeps the existing no-cam mark and the brand idle. `pendingInviteSkipsAutoStart` and `rulesGateEntered` are unchanged, so friend, room, and invite flows are not given a stranger-queue gate.
- Pins: `live.js?v=987`, `live-stage.css?v=657`, `i18n.js?v=269`. `webrtc.js` 356, `hubs.js` 157, `identity.js` 156 unchanged. `verify-match-ux.mjs` and the comment in `verify-before-apk.sh` match 987/657.

Tests:
- `cargo test --manifest-path bridge/Cargo.toml`: 37 passed, 0 failed. Bridge source was not edited.
- `node --check` on `live.js`, `i18n.js`, and `verify-match-ux.mjs`: ok.
- `SKIP_L2=1 mobile/scripts/verify-before-apk.sh` with `NODE_PATH=~/freenet-roulette/mobile/node_modules`: pin asserts and the idle-preview assert passed. L0 137 ok, 4 fail, script exit 1. The four fails are the same pre-existing mobile checks (AndroidManifest orientation, TapPressable, call avatar, StarGiftPopup). L1 ok. `npm test` ok.
- No browser click-through. A camera-permission layout needs a real grant; I did not verify the large preview visually.

Needs Anton:
- This commit is not on the server. Production is still `547bf44`. Say when to deploy `e634efd`.
- The hint is text only. It does not check that a face is in frame.

Signed Grok Build / site. Stopping here.

---

## 2026-10-11 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` (`ef08f1e`, clean) or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK/AAB. Did not install `react-native-fast-tflite`. Did not enable NudeNet. Did not merge ml-native. Did not install a frame tap. Did not change hub ban behaviour. Did not open appeals. Did not change skip or report.

Commit:
- `ecf47f3` Show the local camera large on the idle Start screen.

What changed:
- On the idle Start screen, once the local camera is on, `LiveStageVideo` paints `localStream` large instead of the brand loop. Search still uses the brand loop, with self in the small preview. No camera, or the camera off, keeps the brand loop. The idle root is transparent while that preview is up so the surface is not buried. The surface stays at zOrder 0 so Start stays above it.
- One hint, sentence case, text only, no face circle: `mobile.live.facePreviewHint`. EN “Make sure your face is visible and well lit”. RU «Лицо должно быть видно и хорошо освещено». It sits above Start on idle, and not on a friend call. `mobile.live.faceInFrame` is unchanged and still used on search and during a call.
- Start stays tappable. The stub (`ready: false`) does not hard-block and does not invent a no-face toast. Friend calls stay out of the existing soft-gate hold. The preview does not wait on a face model.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commit). L0 28 ok, L1 ok, `npm test` ok, including `logic.test.mjs`. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- No phone smoke. This checkout cannot show the large preview.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-11 14:41 MDT — Ruletka Developer
site7 finished: e634efd idle self-preview + face/lighting hint on release/2026-10-10 (tests in prior AGENT-INBOX). mobile8 finished: ecf47f3 + f32ff7a Start self-preview large + facePreviewHint on polish/2026-10-10. Next assigns (prompts in ~/rustore-ru-work/prompts/site8.txt mobile9.txt): site — restore home.html primary Start chatting hero CTA + trust strip (align with index; moderation rec #1/#8) on release/2026-10-10 in ~/freenet-roulette-release. mobile — idle Start trust strip (Be kind · Keep it appropriate · AI + reports; RU/EN) on polish/2026-10-10. ios/store left idle (Anton-blocked: A/B/C, ASC id, listing title/short, Data safety paste). Connect left alone. All local; no push/deploy/build/upload. Finished hops ready for review batch: site7 e634efd; mobile8 ecf47f3 (f32ff7a record). [Ruletka Herdr foreman]

---

## 2026-10-11 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` (`ef08f1e`, clean) or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK/AAB. Did not install `react-native-fast-tflite`. Did not enable NudeNet. Did not merge ml-native. Did not install a frame tap. Did not change hub ban behaviour. Did not open appeals. Did not change skip or report. No store or docs paperwork.

Commit:
- `101a8c4` Show three trust lines on the idle Start screen.

What changed:
- On the idle Start screen, under the face hint and above Start, one quiet line: Be kind · Keep it appropriate · AI + reports keep it safe. RU: «Будьте добры · Соблюдайте приличия · ИИ и жалобы берегут безопасность». Keys `mobile.live.trustKind`, `trustFit`, `trustSafe`. Sentence case. Text only. It does not cover Start or the face hint. Other languages fall back to English.
- Idle only, and not on a friend call. Matched and friend-call screens are unchanged. No checkbox, no modal, no hard gate.
- Skipped the matched «AI safety on» chip. A stranger call already shows «Фильтр включён», and a second chip would move the call chrome. The detector is still the stub.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commit). L0 28 ok, L1 ok, `npm test` ok, including `logic.test.mjs`. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- No phone smoke. This checkout cannot show the strip on a device.
- The third line names AI. The on-device detector is still the stub, so this is a trust line, not a live model light.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-11 — Grok Build / site

Local only on `release/2026-10-10` in `~/freenet-roulette-release`. Did not deploy. Did not push. Did not edit `~/freenet-roulette`. Did not rebuild P1–P8 or `/pomosh/kamera-i-mikrofon`. Did not edit `live.js`, ICE/TURN/match, nsfwjs, bans, `safety_log`, or the idle self-preview.

Commit:
- `affc1f8` feat(home): restore the hero Start chatting button and trust strip (parent `e634efd`).

What changed:
- `ui/home.html` hero again leads with a large «Start chatting» / «Начать чат» link to `/live.html` (`.home-cta`, existing `home.cta`). «Invite friends» stays beside it as the secondary action. Header and footer Start links are unchanged.
- Under that row, `ul.home-trust` (existing CSS, `home.css?v=102` not bumped): Be kind · Keep it appropriate · AI + reports keep it safe. RU: «Будьте вежливы» · «Оставляйте разговор уместным» · «ИИ и жалобы помогают держать чат безопасным». Aria: “Before you start” / «Перед стартом». Sentence case. No face circle. Start is not blocked.
- Strings live in the page’s inline en/ru packs. `applyDict` now copies `data-i18n-aria`. Other languages fall back to the English lines. JSON packs do not define these keys, so the fetch overlay does not drop them.

Tests:
- Inline script extracted and `node --check`: ok. No separate JS file changed.
- Pin/home asserts: none in `mobile/scripts` (`home.html` / `home.css` / `home-trust` not referenced). Did not run `verify-before-apk.sh`. Did not run cargo. Bridge not touched.
- Headless Chrome `file://` `?lang=ru` and `?lang=en`: the hero link is `/live.html` (RU adds `?lang=ru`) with «Начать чат» / “Start chatting”, Invite friends second, and the three trust lines plus aria-label. Not a click-through on the live host.

Needs Anton:
- Not on the server. Production is still `547bf44`. Local commits since then: `e634efd` (idle self-preview) and `affc1f8` (this hero). Say when to deploy.
- The trust line names AI and reports. It does not add a gate.

Signed Grok Build / site. Stopping here.

---

## 2026-10-11 20:40 MDT — Ruletka Developer
Drakosik back online. site8 finished: affc1f8 home.html Start CTA + trust strip on release/2026-10-10. mobile9 finished: 101a8c4 + 5d6fcce idle Start trust strip on polish/2026-10-10. Review batch self-email sent (subject [RuletkaDev↔GrokBuild] review batch 8:40 PM MT Oct 11, id 1a12dfba8dd3a8ef). Next assigns (prompts in ~/rustore-ru-work/prompts/site9.txt mobile10.txt): site — move Run a helper / hubs.json off consumer path (moderation rec #7) on release/2026-10-10 in ~/freenet-roulette-release. mobile — plain-language leftover P2P/TURN/hub overlay RU+EN on polish/2026-10-10. ios/store left idle (Anton-blocked: A/B/C, ASC id, listing title/short, Data safety paste). Connect left alone. All local; no push/deploy/build/upload. [Ruletka Herdr foreman]

---

## 2026-10-11 — Grok Build / site

Local only on `release/2026-10-10` in `~/freenet-roulette-release`. Did not deploy. Did not push. Did not edit `~/freenet-roulette`. Did not rebuild P1–P8, the idle self-preview, the low-pool line, or the first-visit update gate. Did not edit `live.js`, ICE/TURN/match, nsfwjs, bans, `safety_log`, or the home hero CTA and trust strip. Did not touch the Stars sheet on `live.html`.

Commit:
- `f95ec33` feat(home): move operator chips off the consumer page (parent `affc1f8`).

What changed:
- `ui/home.html` open section no longer shows «Run a helper», the hub directory, `hubs.json`, or `source.json`. The section stays a plain peer-to-peer line (`home.openPlain`), so the JSON pack cannot put the helper sentence back.
- Footer has one quiet «For operators» / “For operators” link to `/operators`. `contribute.html` stays linked from that page, not beside Start.
- The gifts card is one sentence: “Stars are gifts in chat, not money. You can’t buy or cash them out.” RU: «Звёзды — это подарки в чате, не деньги. Купить и вывести нельзя.» The old wallet / reputation line is gone from the card and from the “how we’re different” blurb.
- `ui/index.html` already leads with Start and the trust strip, already uses that gifts sentence, and has no helper or hubs chips. Left it as it is. No pin bump. `home.css?v=102` unchanged.

Tests:
- Inline script extracted and `node --check`: ok.
- No pin/home assert applies. Did not run `verify-before-apk.sh`. Did not run cargo.
- Headless Chrome against a local static server, `home.html?lang=ru` and `?lang=en`, after the i18n pack loaded: hero is still «Начать чат» / “Start chatting” then Invite friends, then the three trust lines. The only operator link in the page is footer `/operators`. No `contribute.html`, `hubs.json`, `source.json`, or `/v1/directory` in the rendered body. `index.html?lang=ru` still leads with Start and the trust strip and has no operator chips. Not a click-through on the live host.

Needs Anton:
- Not on the server. Production is still `547bf44`. Local commits since then include `e634efd`, `affc1f8`, and `f95ec33`. Say when to deploy.

Signed Grok Build / site. Stopping here.

---

## 2026-10-11 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` (`ef08f1e`, clean) or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK/AAB. Did not install `react-native-fast-tflite`. Did not enable NudeNet. Did not merge ml-native. Did not install a frame tap. Did not change hub ban behaviour. Did not open appeals. Did not change skip or report. No store or docs paperwork. Did not add a matched «AI safety on» chip. Did not edit `page.*` or `log.*`.

Commit:
- `dff2812` Say server and direct video in the mobile overlay.

What changed:
- The phone reads `mobile/src/i18n/overlay/{en,ru}.json` only. Those consumer lines no longer say P2P, TURN, hub, or WebRTC. Home tag is “Direct video · 18+ · no account” / «Видео напрямую · 18+ · без аккаунта». Hide-IP chips are Off / On and Выкл / Вкл. The hint says video goes through our server. Safety tip 4, the camera permission line, the reconnect banner, and the live “trying the server” line use the same plain words.
- Short labels that changed stay sentence case. Live chrome layout is unchanged. `{hub}` in a couple of templates is still the server address placeholder, not the word hub.
- Web packs were left. `page.*` and `log.*` still keep the technical words.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commit). L0 28 ok, L1 ok, `npm test` ok, including `logic.test.mjs`. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- No phone smoke. This checkout cannot show the new lines on a device.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-12 11:46 MDT — Ruletka Developer
Drakosik back online after unreachable streak (9:34 PM Oct 11 – 10:55 AM Oct 12). site9 finished: f95ec33 move operator chips off consumer home on release/2026-10-10. mobile10 finished: dff2812 + 192f689 plain overlay wording on polish/2026-10-10. Review batch self-email sent (subject [RuletkaDev↔GrokBuild] review batch 11:46 AM MT Oct 12, id 1a1313b66a162e08). Next assigns (prompts in ~/rustore-ru-work/prompts/site10.txt mobile11.txt): site — live arch/coach/brand plain-language P2P/TURN/hub pass (moderation rec #7 leftover) on release/2026-10-10 in ~/freenet-roulette-release. mobile — low-liquidity Searching worldwide + invite friend on Start (moderation rec #4) on polish/2026-10-10. ios/store left idle (Anton-blocked: A/B/C, ASC id, listing title/short, Data safety paste). Connect left alone. All local; no push/deploy/build/upload. [Ruletka Herdr foreman]

---

## 2026-10-12 — Grok Build / site

Local only on `release/2026-10-10` in `~/freenet-roulette-release`. Did not deploy. Did not push. Did not edit `~/freenet-roulette`. Did not rebuild home CTA, trust strip, idle preview, low-pool line, first-visit update gate, or P1–P10. Did not edit `live.js`, ICE/TURN/match, nsfwjs, bans, `safety_log`, or the Stars sheet.

Commit:
- `15a9afd` feat(live): say direct video and our server in the chrome (parent `f95ec33`).

What changed:
- English and Russian packs, plus the same keys in `ui/i18n.js`, for the live chrome: `arch.*`, `brand.badgeTitle`, coach tips that named TURN / Prefer Direct / WebRTC, the ice-path titles (`sec.path*`), and the fed-chip title. Visible words are “direct video”, “our server”, “video call”. RU: «прямое видео», «наш сервер», «видеозвонок».
- The Prefer Direct switch name stays (“Prefer Direct only” / «Только Direct»). The hint beside it, the Hide my IP hint, and the Connection intro are plain. Connection detail labels that still say TURN stay for that settings page.
- The failure log line `log.webrtcFail` no longer says WebRTC. Other languages were not rewritten.
- Pins: `i18n.js?v=270`, pack fetch `?v=148`, session pack key `v100`. `live.js?v=987` and `live-stage.css?v=657` unchanged. Verify does not assert the i18n pin.

Tests:
- `node --check ui/i18n.js`: ok. `en.json` and `ru.json` parse.
- Pin asserts do not cover `i18n.js?v=`. Did not run `verify-before-apk.sh`. Did not run cargo.
- Headless Chrome on a local static server, `live.html?lang=en` and `?lang=ru`: Start is present, the idle face hint is present, the arch pill and badge and coach tip use the plain lines, and the Prefer Direct name is unchanged. `home.html?lang=en` still leads with Start chatting and the trust strip. Not a click-through on the live host.

Needs Anton:
- Not on the server. Production is still `547bf44`. Local commits since then include `e634efd`, `affc1f8`, `f95ec33`, and `15a9afd`. Say when to deploy.
- Ukrainian and the other packs still use the old TURN / P2P lines. This pass is English and Russian.

Signed Grok Build / site. Stopping here.

---

## 2026-10-12 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` (`ef08f1e`, clean) or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK/AAB. Did not install `react-native-fast-tflite`. Did not enable NudeNet. Did not merge ml-native. Did not install a frame tap. Did not change hub ban behaviour. Did not open appeals. Did not change skip or report. No store or docs paperwork. Live chrome layout is unchanged.

Commit:
- `b0b5d92` Hide tiny pool counts and invite a friend.

What changed:
- Same gate as the website: fewer than 5 people online hides the raw online and waiting numbers on home Start and on live search. The line is `mobile.home.lowPool`: “Searching worldwide… invite a friend” / «Ищем собеседника по всему миру… пригласите друга». Other languages fall back to English.
- Home opens the existing Friends screen. Live Start and search share the existing friend invite. Friend calls and friends-only home stay on their own copy. A disconnected home does not claim a worldwide search.
- Numbers that still show are the hub counts. The home line no longer prints a fake minimum of 1 online. The queue reducer floors were left so the lobby tests still pass, and those floors are not painted while the pool is quiet.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commit). L0 28 ok, L1 ok, `hubLobby.test.mjs` ok, `npm test` ok, including `logic.test.mjs`. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- No phone smoke. This checkout cannot show the quiet-pool line or the invite tap on a device.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-12 12:43 PM MT — Ruletka Developer (Herdr foreman)

site10 finished: 15a9afd plain-language live chrome (arch/coach/badge/ice-path) on release/2026-10-10. mobile11 finished: b0b5d92 + 13a478f quiet-pool "Searching worldwide… invite a friend" on polish/2026-10-10. Review batch self-email sent (subject [RuletkaDev↔GrokBuild] review batch 12:43 PM MT Oct 12, id 1a1316e5b55d5380). Next assigns (prompts in ~/rustore-ru-work/prompts/site11.txt mobile12.txt): site — honest "AI safety on" chip while matched only when nsfwjs is running (moderation rec #8) + check Start→18+ sheet tap count (rec #2) on release/2026-10-10 in ~/freenet-roulette-release. mobile — sentence-case in-call control labels, a11y labels, Report one tap (rec #6) on polish/2026-10-10. ios/store left idle (Anton-blocked: A/B/C, ASC id, listing title/short, Data safety paste). Connect left alone. All local; no push/deploy/build/upload. [Ruletka Herdr foreman]

---

## 2026-10-12 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` (`ef08f1e`, clean) or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK/AAB. Did not install `react-native-fast-tflite`. Did not enable NudeNet. Did not merge ml-native. Did not install a frame tap. Did not change hub ban behaviour. Did not open appeals. Did not change skip, report, or ban behaviour. No store or docs paperwork. The live chrome was not moved.

Commit:
- `52663a0` Say blur partner and hide me on the call bar.

What changed:
- Icon controls on the call bar now speak short sentence-case actions. EN: “Blur partner”, “Hide me” / “Show me”, “Mute partner”, “Flip camera”, “Mic on” / “Mic off”. RU: «Размыть», «Скрыть меня» / «Показать меня», «Заглушить собеседника», «Перевернуть», «Микрофон вкл» / «Микрофон выкл». Each icon button has an `accessibilityHint`. Other languages fall back to English. The blur-veil hint key was left as it was.
- Next stays in the same slot. Its touch target is larger (`minWidth` 96, a bit more of the row, bigger `hitSlop`). Swipe-to-skip is unchanged. The Next hint is the real swipe sentence, not the raw `swipe.hint` key.
- Report stays the middle button during a stranger call and still opens the existing sheet. The one-tap Explicit choice is still the first action in that sheet. RU label: «Откровенное · заблокировать · дальше».

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commit). L0 28 ok, L1 ok, `npm test` ok, including `logic.test.mjs`. Passed 12, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- No phone smoke. This checkout cannot show the spoken labels, the larger Next target, or the Report tap on a device.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-12 — Grok Build / site

Local only on `release/2026-10-10` in `~/freenet-roulette-release`. Did not deploy. Did not push. Did not edit `~/freenet-roulette`. Did not rebuild home Start, the trust strip, idle preview, the low-pool line, the first-visit update gate, operator chips, the plain arch/coach lines, or P1–P10. Did not change ICE/TURN/match, nsfwjs thresholds, bans, `safety_log`, reports, or Stars logic.

Commit:
- `8b1b4df` feat(live): show AI safety only while the filter is running (parent `15a9afd`).

What changed:
- While matched with a stranger, a small chip sits with the partner name (not on Next or Report). It says “AI safety on” / «AI-защита включена» only when the existing nsfwjs filter is loaded and the scan interval is running for that call. While the model is still loading, the chip says “Safety filter loading” / «Фильтр загружается». If the filter is off, failed to load, skipped (lite GPU or a friend call), or the call has ended, the chip is hidden. A late model load cannot turn it on after the watch has stopped.
- The tooltip says the check runs on this device, the live video is not uploaded, and a report can include one still. That matches the existing camera and privacy lines.
- Rec #2: already one sheet and one confirm. First visit shows the 18+ sheet. One tap on «Начать» / Start accepts the rules and asks for the camera on that same tap. Terms, privacy, and EULA stay one tap away. The underage path still leaves to home. The gate was not changed.
- Pins: `live.js?v=988`, `live-stage.css?v=658`, `i18n.js?v=271`, pack fetch `?v=149`, session pack key `v101`. Other languages fall back to English for the new keys.

Tests:
- `node --check` on `ui/live.js`, `ui/i18n.js`, and `verify-match-ux.mjs`. `en.json` and `ru.json` parse. A small state check of `syncAiSafetyChip` hid the chip for unmatched, friend, off, lite, failed load, and “model loaded but interval not started”; it showed the loading line only while the load promise was in flight, and “AI safety on” only with the model and the timer.
- `SKIP_L2=1 mobile/scripts/verify-before-apk.sh` with `NODE_PATH` pointed at the connect checkout’s `mobile/node_modules`. Pin asserts passed (`live.js?v=988`, `live-stage.css?v=658`). Idle self-preview assert passed. L1 unit tests passed. The script still exits 1 on four pre-existing mobile asserts (AndroidManifest orientation, TapPressable, call avatar, StarGiftPopup). Mobile app source was not edited.
- Headless Chrome on a local static server, `live.html?lang=en` and `?lang=ru`: Start, the 18+ sheet, and the idle face hint still lead. `#ai-safety-chip` is in the page and hidden, with no “on” or “loading” text. Not a click-through on the live host, and not a matched call, so the “on” state was not shown in the browser.

Needs Anton:
- Not on the server. Production is still `547bf44`. Local commits since then include `e634efd`, `affc1f8`, `f95ec33`, `15a9afd`, and `8b1b4df`. Say when to deploy.
- A real stranger match is the only way to see the chip turn on. If the model fails to load from the CDN, the chip stays hidden on purpose.

Signed Grok Build / site. Stopping here.

---

## 2026-10-12 — Grok Build / site

Local only on `release/2026-10-10` in `~/freenet-roulette-release`. Did not deploy. Did not push. Did not edit `~/freenet-roulette`. Did not rebuild the hero, the trust strip, idle preview, the low-pool line, the AI chip, operator chips, or P1–P10. Did not change ICE/TURN/match, nsfwjs, bans, `safety_log`, reports, Stars, the bridge host rewrite, or sitemap/robots. Legal and live pages were not rewritten; they only picked up `home.css?v=103` where they already linked that stylesheet.

Commit:
- `f3d1e08` feat(home): show Start in the phone header and name Ruletka.me (parent `8b1b4df`).

What changed:
- `home.css` no longer hides `.nav-live-link` below 640px. At phone width the header shows a compact “Start chatting” / «Начать чат» pill. Under 420px the brand word is clipped to the logo (the link still says Ruletka.me) and Share becomes a share icon so the language name stays fully visible. Desktop keeps the wordmark, the “Share site” / «Поделиться» label, and the same pill. SEO pages and `index.html` that share this stylesheet get the same header rule.
- `home.html` head now matches the `.me` pages: one name, Ruletka.me. Title: «Чат рулетка — случайный видеочат без регистрации | Ruletka.me». Description does not name both domains. Canonical stays `https://ruletka.me/home.html`. `og:*` and `twitter:*` use that URL and `https://ruletka.me/brand/logo-mark.png`. The `/?lang=` hreflang set is gone. There is no hreflang pointing at `/` or `/en/`, because this page’s canonical is `/home.html`.
- What ruletka.me would serve: `brand_html` replaces `ruletka.vip` then collapses “ruletka.me / ruletka.me”. The old title would have been served as `ruletka.me — чат рулетка | random video chat (ruletka.me)`, and the old description as `Ruletka.me — чат-рулетка…`. The new file contains no `ruletka.vip`, so the `.me` rewrite leaves it unchanged. The `.vip` host serves the same file without a rewrite, so both hosts show one name.
- Visible fallbacks in the body and the Share title now say Ruletka.me. The hero JPEG still paints “.vip” inside the picture. `brand.js` already swaps that art for the mark on the ruletka.me host. These local screenshots are 127.0.0.1, which `brand.js` treats as the vip host, so the picture stays.

Tests:
- `node --check` on the inline script in `home.html`. Head grep: no `ruletka.vip`, no hreflang, canonical `https://ruletka.me/home.html`. JSON-LD parses. A copy of the bridge rewrite left the new file unchanged.
- No verify pin asserts `home.css?v=`. Did not run `verify-before-apk.sh`.
- Headless Chrome, local static server. Layout checks passed (no overlap, language name not clipped, Start text correct) and screenshots:
  - `artifacts/shots/2026-10-12-home-header/home-en-360x740.png`
  - `artifacts/shots/2026-10-12-home-header/home-ru-360x740.png`
  - `artifacts/shots/2026-10-12-home-header/home-en-390x844.png`
  - `artifacts/shots/2026-10-12-home-header/home-ru-390x844.png`
  - `artifacts/shots/2026-10-12-home-header/home-en-1366x768.png`
  - `artifacts/shots/2026-10-12-home-header/home-ru-1366x768.png`
- `seo/en.html` at 360px also shows “Start chatting” inside the viewport. Not a click-through on the live host. Hero and trust strip still lead under the header.

Needs Anton:
- Not on the server. Production is still `547bf44`. Local commits since then include `e634efd`, `affc1f8`, `f95ec33`, `15a9afd`, `8b1b4df`, and `f3d1e08`. Say when to deploy.
- The hero picture still says .vip until a request hits the ruletka.me host, where `brand.js` swaps the art.

Signed Grok Build / site. Stopping here.

---

## 2026-10-12 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` (`ef08f1e`, clean) or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK/AAB. Did not install `react-native-fast-tflite`. Did not enable NudeNet. Did not merge ml-native. Did not install a frame tap. Did not change hub ban behaviour. Did not open appeals. Did not change skip, report, or ban. No store or docs paperwork. Live chrome was not redesigned.

Commit:
- `96f369c` Skip the first-run What's new card and merge age with camera.

Tap count, first open to the first stranger search (camera allowed, Start uses autostart so live does not ask again):
- Before: 6. Age yes, then the camera explanation Continue, then one Android allow on the combined camera/mic sheet, then the home-pin system dialog, then What's new “Got it”, then home Start. A phone that splits camera and mic into two system sheets would add one more allow.
- After: 3. “I'm 18+ · Continue” / «Мне 18+ · Продолжить» accepts the rules and opens that same system sheet. Then one allow. Then home Start. What's new does not show. The pin dialog does not show.

What changed:
- An empty What's new seen-key is a fresh install. The app records the current version and shows nothing. The card appears only after a stored version differs. It is not painted over the age screen or over Start on that first session. `whatsNew.test.mjs` covers fresh, same version, and upgrade.
- Age and the camera reason are one screen. Full rules are the terms link. “Not now” still enters without the camera prompt and still records acceptance, because it is a continue on the 18+ screen. Under 18 still exits on Android and still opens the child-safety page elsewhere. The 18+ gate still blocks home until one of those continue actions.
- The home-pin request is a system dialog, not silent. It is off the first open. Home may ask on the second app open. Settings can still ask on purpose. Someone who already accepted the rules but still lacks camera and mic sees the old camera card only, not the age step again.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commit). L0 28 ok, L1 ok, `whatsNew.test.mjs` ok, `npm test` ok, including `logic.test.mjs`. Passed 13, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- No phone smoke. This checkout cannot walk a fresh install through the merged screen, the system allow sheet, or the second-open pin dialog.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-12 3:48 PM MT — Ruletka Developer (Herdr foreman)

site12 finished: f3d1e08 phone header Start pill + home.html head on Ruletka.me (release/2026-10-10). mobile13 finished: 96f369c + 1270788 shorter first run (no What's new on fresh install, age + camera merged, 6 taps to 3) on polish/2026-10-10. Review batch self-email sent (subject [RuletkaDev↔GrokBuild] review batch 3:48 PM MT Oct 12, id 1a132180cb601f24). Next assigns (prompts in ~/rustore-ru-work/prompts/site13.txt mobile14.txt): site — plain-language stars sheet labels + closed "How stars work" section (moderation rec #7) and last ruletka.vip fallbacks in live.html (rec #9 / SEO T6) on release/2026-10-10 in ~/freenet-roulette-release. mobile — plain words for hub/P2P/TURN in consumer-visible app toasts and friend messages, EN + RU (rec #7) on polish/2026-10-10. ios/store left idle (Anton-blocked). Connect left alone. All local; no push/deploy/build/upload. [Ruletka Herdr foreman]

---

## 2026-10-12 — Grok Build / mobile

Local only on `polish/2026-10-10`. Did not touch `polish/ml-native` (`ef08f1e`, clean) or `~/freenet-roulette`. No push, no deploy, no prebuild, no APK/AAB. Did not install `react-native-fast-tflite`. Did not enable NudeNet. Did not change hub ban behaviour. Did not open appeals. Did not change skip, report, or ban. No ICE, TURN, match, or Prefer Direct default change. No store or docs paperwork. Live chrome was not redesigned.

Commit:
- `5e8e6de` Say server in exported profile notes.

What the app actually shows:
- The phone reads `mobile/src/i18n/overlay/` only. A missing key falls back to the English overlay, then the raw key. It does not load `mobile/src/i18n/packs/`.
- These example keys are in the web packs and are not passed to `t()` from `mobile/app` or `mobile/src`, so an app user never sees them. Left unchanged: `conn.backOnlineBody` (“Hub reconnected — you can search or call again.”), `conn.hubBlipKeepCall` (“Call continues (P2P) · hub reconnecting”), `friends.blockNeedConn` (“Not connected to hub…”), `friends.persistHint` (“Friends are saved on this hub…”), `chat.hubRelay`, `chat.p2pLive`, `conn.preferDirectAutoOff` / `conn.preferDirectAutoOffBody`, and the `coach.*` TURN lines. Same keys exist in the Russian pack and were left too.
- English and Russian overlay values already say server, direct, or connection (from `dff2812`). This hop did not rewrite them again. Settings → Connection is already titled “Server connection” / «Подключение к серверу», with the hint “Tap a working server to switch.” There is no Prefer Direct control on the app screen, so nothing there gained a new subtitle and no default moved.
- Grep of overlay `en.json` and `ru.json` values: no hub, P2P, TURN, Prefer Direct, helper, or WebRTC. `{hub}` remains only as the server-address placeholder (home meta and the server section). 740 keys each, no duplicate keys. Both files parse. Pack `en.json` and `ru.json` parse and were not edited.

Keys / strings changed (the only app text an ordinary user could still read that said hub):
- Encrypted backup `note`: “Stars are hub-only.” → “Stars stay on the server.”
- Plain backup `note`: “Stars are NOT in this file — hub-only for user_id.” → “Stars are not in this file — they stay on the server for this account.”
- The file note is English in both languages. The on-screen export toast was already `settings.exportStarsNote`: “Stars are not in this file (server-only).” / the Russian overlay equivalent. Import does not read the note.

Locales that still carry the old wording (the phone loads these overlays and does not fall back to English while the key exists). Not rewritten this hop:
- ar, bg, cs, de, es, fr, pl, pt, sr, tr, uk, zh.
- Examples a user of that language still sees: home “Hub offline”, “Reconnecting to hub…”, “Switched hub”, safety tip “TURN relay”, Hide IP chips “Off (P2P OK)” / “On (TURN only)”, uk `mobile.home.tag` “P2P-відео”, es/pl/fr permission lines that still say P2P. Settings connection titles in de/cs/pt still say Hub. English and Russian for those same keys already say server / off / on.

Code that still contains the words, and is not a consumer toast: the settings section id `"hub"`, debug-log lines in `live.tsx` (log panel is dev-only), the hub directory storage key, and `connectRetry` log “hard retry force TURN relay”. Left as-is.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout’s `mobile/node_modules` (removed before the commit). L0 28 ok, L1 ok, `npm test` ok, including `logic.test.mjs`. Passed 13, failed 0. `SKIP_APK_HOOK=1`. No APK.

Needs Anton:
- No phone smoke. English and Russian consumer strings were already plain; this hop only aligns the backup file note.
- If a non-English, non-Russian language should also drop hub / P2P / TURN, that is a separate pass. Those overlays still show the old wording.
- The browser packs still say hub, P2P, and TURN. The site tab owns that surface.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-12 — Grok Build / site

Local only on `release/2026-10-10` in `~/freenet-roulette-release`. Did not deploy. Did not push. Did not edit `~/freenet-roulette`. Did not rebuild the home Start CTA, trust strip, idle preview, low-pool line, first-visit Update gate, operator chips, plain arch/coach lines, the AI chip, the phone header pill, or P1–P10. Did not change ICE/TURN/match, nsfwjs, bans, `safety_log`, reports, Stars balances or earning rules, the bridge host rewrite, sitemap/robots, the hero, or the AI chip.

Commit:
- `6bbd003` feat(live): plain stars labels and one Ruletka.me name (parent `f3d1e08`).

What changed:
- Stars sheet labels in `ui/live.html` plus `en.json` and `ru.json` are sentence case. “Wallet” / «Кошелёк» is “Stars you can spend” / «Звёзды, которые можно потратить». “Talk to a senior” is “Talk to an experienced member” / «Поговорите с опытным участником». “Bars stigma” and “Match soft-rank” are “Behind bars” and “Easier matching”. The existing `<details id="stars-about-details">` stays closed. Its summary is “How stars work” / «Как работают звёзды». The hour bonus, gift floors, 45-day fade, and 5-person / 12-person counts sit in that section. No new script. The native details control is the only open/close. Short video chips still say Senior / Trusted.
- `brand.name` is `Ruletka.me` in `i18n.js` and every language pack. Both live.html fallbacks (header and about) say Ruletka.me. A copy of `brand_html` leaves the single token `Ruletka.me` unchanged on both hosts. Headless Chrome showed two elements, each exactly `Ruletka.me`, and the tab title `Ruletka.me — …`. No “Ruletka.me / Ruletka.me”.
- Pins: `i18n.js?v=272`, pack fetch `?v=150`, session `ruletka-i18n-pack-v102-`. `live.js?v=988` and `live-stage.css?v=658` were not bumped. `live.js` was not edited.

Tests:
- `node --check ui/i18n.js`. `en.json` and `ru.json` parse.
- Consumer `ui/*.html` grep for `ruletka.vip`: live, home, index, safety, and SEO landings are clean. Left as non-trivial: `ui/legal/delete.html` (both hosts as links) and `ui/updates.html` changelog lines 95 and 154 (`page.updates.uAug241` / `uAug212`, and the same keys in JSON). Also still in packs, not rewritten: `rules.age`, `friends.incomingNotifTitle`, `settings.exportShareTitle`, and the legal bodies that name both hosts. Other languages still have the old stars jargon; only en and ru were rewritten.
- Headless Chrome on a local static server, stars sheet opened, explanation closed and opened. `127.0.0.1` still paints `.vip` inside the hero JPEG; `brand.js` swaps that art only on the ruletka.me host.
  - `artifacts/shots/2026-10-12-stars-plain/stars-en-390x844-closed.png`
  - `artifacts/shots/2026-10-12-stars-plain/stars-en-390x844-open.png`
  - `artifacts/shots/2026-10-12-stars-plain/stars-en-1366x768-closed.png`
  - `artifacts/shots/2026-10-12-stars-plain/stars-en-1366x768-open.png`
  - `artifacts/shots/2026-10-12-stars-plain/stars-ru-390x844-closed.png`
  - `artifacts/shots/2026-10-12-stars-plain/stars-ru-390x844-open.png`
  - `artifacts/shots/2026-10-12-stars-plain/stars-ru-1366x768-closed.png`
  - `artifacts/shots/2026-10-12-stars-plain/stars-ru-1366x768-open.png`
- `SKIP_L2=1 mobile/scripts/verify-before-apk.sh` with `NODE_PATH=~/freenet-roulette/mobile/node_modules`. Exit 1. Pin asserts passed (`live.js?v=988`, stage 658, webrtc 356, hubs 157). The only failures are the four pre-existing L0 items: AndroidManifest `screenOrientation=fullUser`, TapPressable `pressDelay` 0 + `hapticLight`, CallPeerAvatar, StarGiftPopup. L1 unit tests passed. L2 skipped.

Needs Anton:
- Not on the server. Production is still `547bf44`. Local commits since then include `e634efd`, `affc1f8`, `f95ec33`, `15a9afd`, `8b1b4df`, `f3d1e08`, and `6bbd003`. Say when to deploy.
- Changelog and legal pages still name ruletka.vip. Say if those should become Ruletka.me too.

Signed Grok Build / site. Stopping here.

---

## 2026-10-13 11:50 AM MT — Ruletka Developer (Herdr foreman)

Drakosik reachable again. No new finished hops since the 9:40 PM MT Oct 12 review batch (site13 6bbd003 and mobile14 5e8e6de + 302c21b were already emailed, id 1a1335a4ad272532), so no review email this run. Next assigns (prompts in ~/rustore-ru-work/prompts/site14.txt mobile15.txt): site — plain words for hub/P2P/TURN/Prefer Direct in consumer-visible live.html toasts, chat status and friend messages, EN + RU (moderation rec #7 web leftover) on release/2026-10-10 in ~/freenet-roulette-release. mobile — bring the 12 other app overlay locales (uk, bg, sr, pl, cs first) in line with the plain EN/RU wording and replace leftover English, key sets unchanged (rec #7 app side) on polish/2026-10-10. ios/store left idle (Anton-blocked). Connect left alone. All local; no push/deploy/build/upload. [Ruletka Herdr foreman]

---

## 2026-10-13 — Grok Build / site

Local only on `release/2026-10-10` in `~/freenet-roulette-release`. No push, no deploy. Did not edit `~/freenet-roulette` or mobile app source. `live.js` behaviour is unchanged (no ICE/TURN/match, Prefer Direct defaults, skip/report/ban, nsfwjs, safety_log, Stars, bridge, or sitemap).

Commit: `25a41f2` feat(live): plain words for connection toasts and chat status. Parent `6bbd003`.

Shown to people, rewritten in `en.json` and `ru.json` (and `i18n.js` / home / index fallbacks where that string paints before the pack loads): chat status (`chat.p2pLive`, `chat.hubRelay`, `chat.p2pReady`), connection toasts and banners (`conn.gaveUp`, `conn.hubBlipKeepCall`, `conn.preferDirectAutoOff`, `conn.preferDirectAutoOffBody`, `conn.weakTipDirect`, `conn.pathStatsTip`, `status.hubBlipKeepCall`, `status.hubBackKeepCall`, `update.deferredBody`), hub-switch toast (`hub.switched`, `hub.switchedTitle`, `hub.switchedBody`), friends (`friends.blockNeedConn`, `friends.persistHint`, `friends.emptyLost` EN), home offline line, invite share text, export toasts, age-gate kicker, and the “how we’re different” parenthetical. Prefer Direct stays the toggle name. “Server” / «сервер» or “connection” / «связь» replaces hub. “Direct video” / «прямое видео» replaces P2P. “Backup route” / «резервный маршрут» replaces TURN relay. Video still goes directly between people; the server only matches.

Before → after:
- `conn.hubBlipKeepCall` EN: “Call continues (P2P) · hub reconnecting” → “The call continues on direct video. Reconnecting.” RU: “Звонок идёт (P2P) · хаб reconnect” → “Звонок идёт по прямому видео. Связь восстанавливается.”
- `chat.p2pLive` / `chat.hubRelay` EN: “P2P · not via hub” / “via hub until P2P ready” → “Direct video” / “Through the server until direct video is ready.” RU: “P2P · не через хаб” / “через хаб, пока нет P2P” → “Прямое видео” / “Через сервер, пока не готово прямое видео.”
- `conn.preferDirectAutoOffBody` EN: “Direct-only mode couldn’t connect. TURN relay is on again…” → “Direct video could not connect. The backup route is on for the next match. You can turn Prefer Direct back on in Settings.”
- `hub.switchedTitle` EN: “Switched hub” → “Switched server.” RU: “Сменили хаб” → “Сервер сменён.”
- `friends.blockNeedConn` EN: “Not connected to hub — wait for reconnect, then Block again” → “Not connected. Wait for the connection, then block again.”
- `home.statsOffline` EN: “Hub offline” → “Server offline.” RU: “Хаб офлайн” → “Сервер недоступен.”
- `conn.gaveUp` RU: “Не удалось переподключиться — повторите или смените хаб” → “Не удалось подключиться.” EN was already “Couldn’t connect.”

Left as technical terms: Settings → Connection (`settings.connTurn`, `settings.connDirectStat`, `settings.connHub`, hide-IP / Prefer Direct detail). Prefer Direct already has a plain subtitle (`settings.preferDirectHintShort`). Hub directory stays, including the toast button `settings.secHub` (“Network hub” / «Сетевой хаб»). Unused and not rewritten: `conn.backOnlineBody` (the toast uses `conn.backOnline`), `conn.turnOn`, `conn.vpnRelayOnLog`. `hub.gaveUp` is only `log()`. Also left: `log.*`, `page.helper` / privacy / terms / eula / legal / community / safety / donate / updates, `seed.*`, `home.open*`, `nav.helper`, `flag.hint`.

Pins: `i18n.js?v=273`, pack `?v=151`, session `ruletka-i18n-pack-v103-`. `live.js?v=988` and `live-stage.css?v=658` unchanged. `site-i18n.js` PACK_V stays 147 (legal, donate, updates do not show these toasts).

Tests:
- `node --check ui/i18n.js`: ok.
- `en.json` 2101 keys, `ru.json` 2091 keys, no duplicate keys.
- Remaining hub / P2P / TURN / «хаб» / helper in en and ru values are only Settings/connection, the hub directory, `log.*`, `page.*`, `seed.*`, `home.open*`, `nav.helper`, `flag.hint`, the three unused `conn.*` strings, and log-only `hub.gaveUp`.
- Headless Chrome on a local static server, `live.html?lang=en` and `?lang=ru`, after hiding the age gate and calling `showHubSwitchedToast` plus `setConnStrip` for `conn.hubBlipKeepCall`. Not a real reconnect. Shots: `artifacts/shots/2026-10-13-plain-conn/conn-en-1366x768.png`, `conn-en-390x844.png`, `conn-ru-1366x768.png`, `conn-ru-390x844.png`. Toast bodies are the new sentences. The button still says Network hub / Сетевой хаб. The phone EN strip sometimes showed “Retry in 1s…” (reconnect countdown); the wide EN strip showed the new sentence.
- `SKIP_L2=1 mobile/scripts/verify-before-apk.sh` with `NODE_PATH=~/freenet-roulette/mobile/node_modules`: exit 1. L0 137 ok, 4 fail, all pre-existing and unrelated: AndroidManifest `screenOrientation=fullUser`, TapPressable `pressDelay 0` + `hapticLight`, CallPeerAvatar, StarGiftPopup. Pin asserts ok (`live.js?v=988`, stage 658, webrtc 356, hubs 157). L1 unit tests ok. L2 skipped.

Other locales do not fall back to English while the key exists. `uk`, `de`, `es`, `fr`, `pl`, `pt`, `cs`, `bg`, `tr`, `ar`, `zh`, `it`, and `id` still carry hub / P2P / TURN (or a translation of them) on these keys. `sr` uses чвориште / П2П / Хуб. Those packs were not edited.

Needs Anton:
- Production is still `547bf44`. This commit is local only.
- Legal, changelog, donate, safety, helper, and operator copy still say hub / P2P / TURN (`page.privacy`, `page.terms`, `page.eula`, `page.donate`, `page.updates`, `page.safety`, `page.helper`, `seed.*`, `home.open*`).
- Unused strings still jargon: `conn.backOnlineBody`, `conn.turnOn`, `conn.vpnRelayOnLog`. `hub.gaveUp` is log-only.
- Tab-title fallback in `home.html` (~786) and `index.html` (~866) is still “peer-to-peer chat roulette.” `home.html` keywords meta still lists peer-to-peer, p2p.
- `ui/legal/delete.html` and `ui/updates.html` still name ruletka.vip (same as the previous site note).
- The other 14 locales still use the old words.

Signed Grok Build / site. Stopping here.

---

## 2026-10-13 — Grok Build / mobile

Local only on `polish/2026-10-10` in `~/freenet-roulette-polish`. No push, no deploy, no prebuild, no APK. Did not edit `~/freenet-roulette`, `polish/ml-native`, or `~/freenet-roulette-ml` (still `ef08f1e`, clean). Did not edit `mobile/src/i18n/packs/`, `en.json`, or `ru.json`. No ICE, TURN, match, Prefer Direct default, skip, report, ban, NudeNet, or live-chrome change.

Commit: `15a0b0b` Say server, direct video, and backup route in the other app languages. Parent `302c21b`.

Locales: uk, bg, sr, pl, cs, de, es, fr, pt, tr, ar, zh. Each overlay parses, has 740 keys, the same set as `en.json`, and no duplicate keys. Twenty-one keys that existed in English and Russian and were missing here are now filled (call-bar hints, trust lines, low-pool line, 18+ continue, swipe hint, and the rest of that gap). `{placeholders}` stay. `{hub}` stays as the server-address placeholder in `mobile.home.meta` and `mobile.settings.userMeta`, with the words “User” and “hub” removed from those lines.

Before → after:
- uk `mobile.home.tag`: «P2P-відео · 18+ · без класичного акаунта» → «Пряме відео · 18+ · без акаунта»
- uk `mobile.home.hubOffline`: «Хаб офлайн» → «Сервер недоступний». `mobile.settings.hubSection`: «Підключення хаба» → «Підключення до сервера»
- uk Hide IP: «Вимк (P2P ОК)» / «Увімк (лише TURN)» → «Вимк» / «Увімк». `mobile.live.pathRelay`: «реле» → «сервер». `mobile.live.camOff`: «Кам викл» → «Сховати мене». `mobile.live.peer2`: «Одноліток 2» → «Людина 2»
- uk `mobile.safety.tip4`: ««Приховати IP» використовує TURN, якщо хаб його дає.» → ««Сховати IP» ховає вашу адресу, якщо сервер це може.»
- bg `mobile.home.tag`: “Peer-to-peer video…” → «Директно видео · 18+ · без акаунт». `mobile.home.hubOffline`: «Хъб офлайн» → «Сървърът е недостъпен». `mobile.settings.hubSection`: «Хъб връзка» → «Връзка със сървъра»
- pl `mobile.home.tag`: “Wideo P2P…” → “Wideo bezpośrednie · 18+ · bez konta”. `mobile.settings.hubSection`: “Połączenie koncentratora” → “Połączenie z serwerem”. `mobile.safety.tip4` and `mobile.safety.deleteBody` were English and are now Polish.
- de `mobile.settings.hubSection`: “Hub-Verbindung” → “Serververbindung”. es `mobile.settings.hubSection`: “Conexión del concentrador” → “Conexión al servidor”. Same plain meaning in fr, pt, cs, tr, ar, zh.

What a grep still finds, and why:
- `{hub}` only, as the address placeholder. No hub / P2P / TURN / WebRTC / хаб / хъб / реле / Relais word in these twelve value sets.
- Left in English on purpose: `mobile.live.hideLog` / `mobile.live.showLog` (debug log). Also OK, LTE, Ruletka.me, `{s}s`, `★ {n}`, `{name}: {body}`.
- Cognates left as the same word as English: pl Start / Stop; online / offline in pl, cs, de, pt; de Chat, Code, Live, System, Community, “Server offline”, “Person 2”; cs Chat and “Server online”; es Debate / Chat; fr Code, direct, Senior, Site, Photo, Message…, Actions; pt Debate / Site.

Left for a native speaker:
- Serbian had about 60 strings where `{placeholders}` had been saved as `__ПХ0__`. The tokens are restored in English placeholder order. Those sentences are still the old wording, not a new translation. `mobile.live.addFriendAfter` and `mobile.openOnPc.shareBody` also got their line breaks back.
- `debate.pass` was a road-turn mistranslation in bg («Преминете завой»), sr («Прођите скретање»), and cs («Průjezdová zatáчка»). They now say «Предайте хода», «Предајте потез», and «Předejte tah». `debate.turnLength` and `debate.incomingMeta` in those three were the same error and now say “move / turn” in the debate sense. Please confirm.
- Arabic and Chinese had large blocks that were still English. They are translated. A native read is the right check.
- `mobile.settings.reputationHint` still says “wallet” in uk, bg, sr, pl, cs, es, fr, pt, tr, ar, and zh (Гаманець, Портфейл, Новчаник, Portfel, Peněženka, Cartera, Portefeuille, Carteira, Cüzdan, المحفظة, 钱包). German was still the English word Wallet and now follows the current stars sentence. English and Russian already say stars for gifts (`a296d97`). This hop did not rewrite the native wallet lines.
- Older German strings still use Sie. New strings in this commit use du, like the newer debate lines.
- `stars.unlockEasterEgg` follows the English meaning (unlock timer, surprise, double-tap hides it). `mobile.whatsNew.b2` names a “let’s go” tap; there is no separate overlay key for that button.

Tests: `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout `mobile/node_modules`, removed before commit. L0 28 ok, 0 fail. L1 ok. `npm test` ok, including `logic.test.mjs`, `whatsNew.test.mjs`, and `duration.test.mjs`. Passed 13, failed 0. `SKIP_APK_HOOK=1`. No APK. Symlink is gone.

Needs Anton:
- No phone smoke. Switch the app to Ukrainian, then Bulgarian or Polish, and check home (server offline / direct video), Settings connection, Hide IP off/on, and the call-bar names.
- Native check of Arabic, Chinese, and the repaired Serbian placeholder lines before those languages are treated as done.

Signed Grok Build / mobile. Stopping here.

---

## 2026-10-13 12:52 PM MT — Ruletka Developer (Herdr foreman)

site14 finished: 25a41f2 plain words for connection toasts and chat status EN + RU on release/2026-10-10. mobile15 finished: 15a0b0b + 6655801 server / direct video / backup route in the 12 other app overlays on polish/2026-10-10. Review batch self-email sent (subject [RuletkaDev↔GrokBuild] review batch 12:52 PM MT Oct 13, id 1a1369d5aaa0910d). Next assigns (prompts in ~/rustore-ru-work/prompts/site15.txt mobile16.txt): site — same plain wording on the site14 keys in the other 14 web locales (uk, bg, sr, pl, cs first) + tab-title fallback / keywords meta peer-to-peer and ruletka.vip brand mentions in delete.html / updates.html on release/2026-10-10 in ~/freenet-roulette-release. mobile — plain stars wording for leftover wallet/status/trusted/senior jargon in app EN/RU, then reputationHint and those keys in the 12 overlays on polish/2026-10-10. ios/store left idle (Anton-blocked). Connect left alone. All local; no push/deploy/build/upload. [Ruletka Herdr foreman]

---

## 2026-10-13 — Grok Build / mobile

Local only on `polish/2026-10-10` in `~/freenet-roulette-polish`. No push, no deploy, no prebuild, no APK. `~/freenet-roulette` and `polish/ml-native` / `~/freenet-roulette-ml` stay at their previous tips (`ef08f1e`, clean). `mobile/src/i18n/packs/` was not edited. No Stars logic, gift prices, ICE, TURN, match, Prefer Direct default, skip, report, ban, NudeNet, native frame tap, model install, or live-chrome change.

Commit: `80eea5c` Say experienced member and stars from chats in the app. Parent `6655801`.

Fourteen overlay files. Each still parses, has 740 keys, the same set as `en.json`, and no duplicate keys. Placeholders `{stars}`, `{trust}`, `{tier}`, and `{n}` stay. Values only.

Home and Settings show these. `mobile.live.tierSenior` and `mobile.live.tierTrusted` are the chip. Settings uses `mobile.settings.tierNone` when the tier is new. `mobile.settings.reputation` is the section title. `mobile.settings.reputationHint` is the line under the chip.

Before → after:
- en `mobile.live.tierSenior` / `tierTrusted`: “Senior” / “Trusted” → “Experienced member” / “Trusted member”. `tierNone`: “new” → “New”.
- en `mobile.settings.reputationHint`: “★{stars} to spend on gifts. Reputation {trust} ({tier}). …” → “★{stars} to spend on gifts. Stars from chats: {trust} ({tier}). Stars are thanks after a long chat — not money.”
- ru `mobile.settings.reputation`: «Звёзды и репутация» → «Звёзды». `tierSenior`: «Старший» → «Опытный участник». `tierTrusted`: «Доверенный» → «Доверенный участник». `giftBars`: «За решёткой» → «За решётку» (same gift name as the site).
- uk `mobile.settings.reputationHint`: «Гаманець ★ {stars} · довіра {trust} · {tier}» → «★{stars} на подарунки. Зірки від розмов: {trust} ({tier}). Зірки — подяка після довгої розмови, не гроші.» `tierSenior`: «Старший» → «Досвідчений учасник». `reputation`: «Зірки та довіра» → «Зірки».
- The wallet line is now that same stars-from-chats sentence in bg (was Портфейл), sr (Новчаник), pl (Portfel), cs (Peněženka), es (Cartera), fr (Portefeuille), pt (Carteira), tr (Cüzdan), ar (المحفظة), and zh (钱包). de dropped “Ansehen” and now says “Sterne aus Gesprächen”. zh section title «明星与信任» → «星星».

`mobile.home.trustN` and `mobile.live.trustN` now say “Stars from chats {n}” (the same phrase in each language). No screen calls `t()` on those two keys. The overlay file no longer says reputation there.

What a grep still finds, and why:
- After `{placeholders}` are stripped, the only wallet / reputation / senior / trusted / soft-bars hits are the kept name “Trusted member”: en “Trusted member”, ru «Доверенный участник», uk «Довірений учасник», bg «Доверен участник». That is the site name for this step. The one-word labels “Trusted” and “Senior” are gone. No wallet, no “reputation”, no “soft bars”.
- `{status}` remains only inside `debate.incomingStatus` (a debate invite) and `mobile.settings.hubHint` (which server the app is on). Those lines are about the connection.
- `mobile.live.tierKnown` stays “Known” / «Знакомый» / «Відомий» and the same short word in the other languages. The site ladder title is still “New / Known”. sr «Познато» → «Познат» and «Ново» → «Нови» so the chip agrees in gender. uk `tierNew` «новий» → «Новий».
- Gift names stay: Fence / «Забор», and “Behind bars” in the other languages. Only the Russian bars name moved to «За решётку».
- `mobile.live.trustKind`, `trustFit`, and `trustSafe` are the idle kindness lines. Left as they were.
- `PartnerChrome.tsx` still has an English accessibility string with the words “status” and “spendable”. The matched stage does not mount that component. No overlay key was added. The file was not edited.

Left for a native speaker:
- Arabic and Chinese sentences for experienced member, trusted member, the Settings stars line, and “stars from chats”.
- Serbian «Искусан учесник», «Поуздан учесник», «Познат», «Нови», and «Звездице».
- Ukrainian «Досвідчений учасник» and the stars-from-chats sentence.
- German “Erfahrenes Mitglied” and “Vertrauenswürdiges Mitglied”. Older German strings still use Sie.

Tests: before `80eea5c`, `SKIP_L2=1 ./scripts/verify-before-apk.sh` with a symlink to the main checkout `mobile/node_modules`, then the symlink removed. L0 28 ok, 0 fail. L1 ok. `npm test` ok, including `logic.test.mjs`, `whatsNew.test.mjs`, and `duration.test.mjs`. Passed 13, failed 0. `SKIP_APK_HOOK=1`. No APK. Symlink is gone. Every overlay JSON parses, no duplicate keys, same key set as `en.json`.

Needs Anton:
- No phone smoke. Switch the app to Ukrainian, then one more language, and read the home star chip and the Settings stars row (stars to spend, stars from chats, experienced member or trusted member).
- A native read of Arabic, Chinese, and Serbian before those three are treated as done.
- “Trusted member” / «Доверенный участник» is the name kept from the site. Say if the app should use a different plain phrase.

Signed Grok Build / mobile. Stopping here.
