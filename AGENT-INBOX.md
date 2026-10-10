
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

