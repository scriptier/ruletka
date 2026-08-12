# Android match UX (location · stars · blur)

Spec: `knowledge/specs/current-mobile-ux.md`

## Location
- Matched + `partner_geo` merge non-empty fields only (no empty wipe).
- Flag-only shows ISO/localized country (not infinite “Looking up…”).
- hide_ip → Location hidden.

## Stars
- Partner ★ always on PartnerChrome (0 dimmed).
- Self ★ always on home + gift bar balance pill.

## Blur
- PartnerBlurVeil mosaic over RTCView zOrder 0 (not black hole).
- Unblur bumps streamEpoch + zOrder ≥1.
- Prefs race: optimistic intro until prefs ready.
- **Partner self-hide** (web Hide / black canvas track): P2P `self_hide` → Android `partnerCamHidden` mosaic on partner tile only (not local eye blur).

## Stars
- Partner ★ from `peers[].stars` with samePartner merge (unknown fields do not wipe).
- Trust chip when trust>0; SurfaceView elevation on chrome.

## Location
- `partner_geo` loose peer_id + buffer before matched; never empty-wipe real geo.
- hide_ip → empty formatLocLine → "Location hidden".

## Autostart (Start chatting)

- Home CTA / quiet-online / pool-busy → `/live?autostart=1`.
- **Bug fixed 0.1.307:** effect must schedule `start()` **before** `setParams({ autostart: undefined })`. Clearing params first re-ran the effect, cancelled the 80ms timer → idle forever (flake).
- friendsOnly: home routes to Friends; live autostart no-ops.
- Stop: param cleared only after arm → no re-spin.

## zOrder (Android SurfaceView)

- Partner remote **always zOrder 0** so PartnerChrome (RN elevation) paints above.
- Privacy / partner-hide / bars → covered tiles stay 0 under opaque mosaic.
- Self PiP may use 2 when uncovered; never put partner at ≥1 under chrome.
- Unblur: streamEpoch bump after 0→1 flip.

## Identity dock (2026-08-11)

- **One identity surface:** `PartnerIdentityDock` only for mid-match name · ★ · loc. Do not also mount `PartnerChrome` / `stagePartnerHud` for the same fields.
- **One flag:** stage `partnerFlagChip` on video only; `formatLocLine({ omitFlag: true })` so loc is "Canada · Calgary" without a second 🇨🇦 (dual-flag screenshot fail).
- **Transparent stage:** partner RTCView zOrder 0; stage/rootMatched parents stay transparent so RN chrome can paint above SurfaceView (opaque header panels bury identity).
- **Primary strip:** top absolute under status bar (default) and/or flex under stage — not solely Modal-over-RTCView.
- **Stars:** `displayPartnerStars` = max(stars, trust); cache name/geo/stars by `user_id` across rematch (no empty wipe).
- **Skill:** `.grok/skills/mobile-match-identity/SKILL.md` (2026-08-11 thrash).

## Blur (hard rules after thrash)

| Do | Don't |
|----|--------|
| Keep RTCView mounted when veiled | Unmount RTC for “nuclear” blur (crash risk on match) |
| Android opaque Modal **only while** `showPrivacyBlur` | Always-on Modal racing WebRTC on every match |
| PartnerBlurVeil mosaic mid-tone | Pure black hole as privacy |

## Stars

- Display: `displayPartnerStars` = **max(stars, trust)** so trust-only partners are not stuck at ★0.
- **★0 mid-match (0.1.341+):** Often **correct empty ledger** — hub always sends `peers[].stars`/`trust` (serde u64). Stranger with no gifts → ★0 dimmed on top strip. Self gift-bar balance (e.g. ★42) is **yours**, not the partner’s. Real bug only if hub/log shows stars or trust **>0** but dock paints 0 — check logcat `[match] dock` / `[match] paint` (`display★`, `known=`).

## Gift FX (Android)

- Path: `mobile/src/stars/GiftFxOverlay.tsx` (RN `Animated` only; no Lottie).
- **0.1.330-vc338:** heart / flowers / fireworks are **animated layers** (not static emoji); soft edge tint; elevation above zOrder-0 RTCView.
- Hold times: `GIFT_FX_HOLD_MS` aligned to web `STAR_GIFT_SECS` spirit (heart 2.2s, flowers 2.8s, fireworks 4s, bars 15.5s, …).
- **Still not CSS-parity** with web `live-stage.css` / `live.js` particle FX — closer, not identical. Further fireworks polish may land on disk; do not claim visual PASS without human smoke.
- a11y: polite live region + gift label.
- **Human smoke pending** — do not claim visual PASS from code review alone.

## Brand watermark + loading loop (Android)

Skill: `brand-stage`. PC seam contract: [live-chrome-ux](live-chrome-ux.md).

| Surface | Path / rule |
|---------|-------------|
| Mid-match mark | `mobile/src/live/BrandWatermark.tsx` — **bottom-middle** of partner video; soft **360° every 15s** (~1.3s spin + 15s hold upright); settles from center → bottom |
| Idle / search | `mobile/src/live/BrandLoadingLoop.tsx` + HQ `assets/brand/loading-screen.mp4` full stage (local PiP stays) |
| Mount | `LiveStageVideo.tsx` mounts watermark when matched + remote unveiled; loading loop while search/idle |
| Wordmark | Full **`ruletka.me`** never clip |
| MUST NOT | Mid-torso fixed TY=160; MediaSession thrash for brand-only; dual with PC tile-bottom mark |

## CONNECT toast ban (release)

- Mid-match: **no** stopwatch toast for CONNECT / Link offer timing.
- `MediaSession` still emits `CONNECT offer=… answer=… frame=…ms` on first frame (log path).
- `live.tsx` handles `s.startsWith("CONNECT ")` → **log + `lastConnectStats.saveLastConnectStats`** only — Settings → **Last connect** keeps the stats.
- Gotcha: [gotchas](gotchas.md) §18 · skill `mobile-match-identity`.

## Build badge (release)

- Match live stage version chip is **`__DEV__` only** (`live.tsx` — no version chip on release APK mid-match/search).
- Home / Settings may still show build for copy-to-clipboard smoke; do **not** re-add a permanent match-overlay build badge on release.

## Pre-APK gate

- `npm run verify` (L0 match-ux static + L1 units + L2 soft) before `build-apk-local`.
- Wiki: [pre-apk-verify](pre-apk-verify.md).

## Friends avatars (code landed)

- `friends.tsx` `FriendRow`: hub `avatar` URI → `Image` (letter fallback); dedicated `last_msg` snippet line; match/call history thumbs with Image onError → letter.
- **APK 0.1.358 pending** — source on disk under **0.1.357**/vc365; do not claim shipped Friends polish APK until 0.1.358 artifact exists.

## Ship target (smoke pending)

| Artifact | Version |
|----------|---------|
| APK | **0.1.357-vc365** denser gift FX on disk (`mobile/artifacts/`); Friends polish → **0.1.358** pending; confirm device `app_vc` before claiming |
| Web | **`live.js?v=552`** + **`live-stage.css?v=380`** (fw-v6 fireworks) + **`live-brand.css?v=10`** |
| Checklist | [`../specs/SMOKE-NEXT.md`](../specs/SMOKE-NEXT.md) |
| PC chrome / brand | [live-chrome-ux](live-chrome-ux.md) |
| Device tools | `mobile/scripts/device-smoke.sh`, `scripts/phone-web-pair.mjs` |

### Log
- 2026-08-10: three agents shipped; APK bump after product.ok video path.
- 2026-08-10: self_hide mosaic + stars merge + geo buffer (smoke pending).
- 2026-08-10 hop2: partner RTCView **zOrder 0** (chrome above SurfaceView); geo 1v1 buffer always flush; mosaic pixel+force **#45536c**. APK **0.1.304/vc312**. **Smoke pending — MUST product.ok.** Raw: `raw/2026-08-10-ux-hop2-zorder-geo-blur.md`.
- 2026-08-10 walk-loop: autostart race fixed → APK **0.1.307-vc315**; hop4 MediaSession pure-SDP latch → **0.1.308+**; latest symlink **0.1.309-vc317**. Device install pending (no adb in walk).
- 2026-08-11: thrash 0.1.317→**0.1.329-vc337**; identity dock under stage; blur keep-RTC+Modal; stars max(stars,trust); L0–L2 pre-APK; brand ruletka.me. **Human smoke still required.** Raw: `raw/2026-08-11-ux-thrash-method-gap.md`.
- 2026-08-11: GiftFx upgrade **0.1.330-vc338** — animated heart/flowers/fireworks + soft tint + elevation; still not CSS-parity. **Human smoke pending.**
- 2026-08-11 overnight Pixel: A/V match PASS; infinite Looking up FAIL→**0.1.332** (omit empty loc); name short-id not “Partner”; autostart retry. Raw: `raw/2026-08-11-overnight-device-loop.md`.
- 2026-08-11: match-identity skill — transparent dock + **single flag** rule; no MediaSession thrash for identity. Path: `.grok/skills/mobile-match-identity/SKILL.md`.
- 2026-08-11 walk polish: denser fireworks **0.1.357-vc365**; Friends avatars code landed, APK **0.1.358** pending; web **live.js?v=552** / stage **v=380** fw-v6 / brand **v=10**.
- 2026-08-11 session: BrandWatermark bottom-middle 360°/15s + BrandLoadingLoop; CONNECT toast → Settings Last connect; release no match build chip; web stamp **live.js?v=551**.
