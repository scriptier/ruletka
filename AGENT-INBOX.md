
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
