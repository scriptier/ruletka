# Android match UX (location · stars · blur)

Spec: `knowledge/specs/current-mobile-ux.md`

## 3-way stage + Stop (2026-08-14 · disk · no MULTI_PASS)

Spec: [`../specs/2026-08-14-android-browser-parity.md`](../specs/2026-08-14-android-browser-parity.md). Herd `20260814T083341Z`. See [multi-party](multi-party.md).

| Surface | On disk | Not claimed |
|---------|---------|-------------|
| 3-way layout | Portrait **top/bottom remotes**; PiP = you; hunt wrap (no remount first RTCView); **2×2 only at 4** | Human faces / MULTI_PASS |
| Extra chrome | Per-tile name (no hex) · loc · ★ · volume | Device paint PASS |
| Stop/Next labels | pair+3rd live → Next `btn.nextStranger` / Stop **Leave 3rd** (`btn.stopLeaveThird`); you are 3rd → Next / Stop **Leave call** (`btn.stopLeaveCall`); 1v1 → Next / Stop | APK on device (still **0.1.384 / vc392**) |

`LiveBottomBar` paints parent `labels.stop/next` as-is. Tip APK **0.1.384 / vc392** until director `--bump` — **do not invent vc**. SoftBlur / multi SoftBlur residuals below are unchanged. **No MULTI_PASS.**

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
- **Modes (Settings → Match & language → Stranger privacy veil):** **Off** / **Intro** (Brief ~2.5s then open) / **Hold** (**Until I tap** — veiled until mid-match **Show video**). Chip auto-saves (`setBlurMode` → prefs); no Save button. Friends never auto-veil.
- **Soft 1v1 matrix (agent evidence 2026-08-12 — closed; not human GOAL_MET):**
  | Mode | Hop | APK | Evidence (logcat) | Source |
  |------|-----|-----|-------------------|--------|
  | **Hold** | F11 | **0.1.371-vc379** | `mode=hold` · `softNative=1` · SoftBlur Sink · no intro peel | `BLUR-F11-apk-resmoke-RESULT` |
  | **Off** | F12 | **0.1.371-vc379** | `mode=off` · **0×** blur show / softNative / Sink | `BLUR-F12-off-intro-371-RESULT` |
  | **Intro** | F14 | **0.1.371-vc379** | `mode=intro` · `softNative=1` · Sink · `hide why=intro_auto` | `BLUR-F14-intro-371-RESULT` |
  | **Hold reconfirm** (post-MX) | F15 | **0.1.373-vc381** | still `softNative=1` + Sink + Hold stay | `BLUR-F15-hold-soft-reconfirm-RESULT` |
  | **Off + Intro reconfirm** (tip) | F16 | **0.1.374-vc382** | Off: `mode=off` + **0×** show; Intro: `softNative=1` + Sink + `intro_auto` | `BLUR-F16-off-intro-373-RESULT` · L31 docs |
  Full **Off · Intro · Hold** 1v1 matrix **closed at agent level** (tip-371 F11/F12/F14 + F15 Hold on 373 + F16 Off/Intro on 374). Sources: `L28`/`L31-smoke-softblur-docs-RESULT`. **Human blur GOAL_MET still open.**
- **Multi SoftBlur device:** **OPEN / NOT claimed — F17–F70 BLOCKED keyguard** (serial **43343** · tip **0.1.374-vc382**).
  | Hop | Result | Evidence |
  |-----|--------|----------|
  | **F17** | **BLOCKED / partial** | keyguard PIN · serial **43343** · package **0.1.374-vc382** · web2phone **SCAFFOLD_DONE** · phone **max_peers=0** · **0×** softNative multi / Sink · Hold setup blocked | `BLUR-F17-multi-soft-device-attempt-RESULT` |
  | **F18** | **BLOCKED (keyguard)** | reconfirm still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · multi SoftBlur **not attempted / not claimed** | `BLUR-F18-multi-soft-unlock-retry-RESULT` |
  | **F19** | **BLOCKED (keyguard)** | same unlock-gate fail · AlternateBouncer / fingerprint · no Hold / multi / softNative / Sink | `BLUR-F19-multi-soft-unlock-retry-RESULT` |
  | **F19s** | **static OK only** | product flag **ON** · per-tile SoftBlur map + zOrder0 still intact · hunt ≠ multi soft · verify-match-ux **30 ok** · **not** device PASS | `BLUR-F19s-multi-soft-static-reconfirm-RESULT` |
  | **F20** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · gate stop · no Hold / multi / softNative / Sink | `BLUR-F20-multi-soft-unlock-retry-RESULT` |
  | **F21** | **BLOCKED (keyguard)** | same unlock-gate · AlternateBouncer / fingerprint · face auth pending · multi SoftBlur **not attempted / not claimed** | `BLUR-F21-multi-soft-unlock-retry-RESULT` |
  | **F22** | **BLOCKED (keyguard)** | continuity in F23–F60 tables · still keyguard · multi SoftBlur **not claimed** | F23–F60 continuity |
  | **F23** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · gate stop · no Hold / multi / softNative / Sink | `BLUR-F23-multi-soft-unlock-retry-RESULT` |
  | **F24** | **BLOCKED (keyguard)** | same unlock-gate reconfirm · AlternateBouncer / fingerprint · multi SoftBlur **not attempted / not claimed** | `BLUR-F24-multi-soft-unlock-retry-RESULT` |
  | **F25** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | L40 SMOKE SoftBlur stamp · F28/F29 continuity |
  | **F26** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | L41 SMOKE SoftBlur stamp · F28/F29 continuity |
  | **F27** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | `BLUR-F27-multi-soft-unlock-retry-RESULT` · L42 |
  | **F28** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · gate stop · no Hold / multi / softNative / Sink | `BLUR-F28-multi-soft-unlock-retry-RESULT` |
  | **F29** | **BLOCKED (keyguard)** | same unlock-gate reconfirm (~09:06Z) · AlternateBouncer / fingerprint · multi SoftBlur **not attempted / not claimed** | `BLUR-F29-multi-soft-unlock-retry-RESULT` |
  | **F30** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F37–F60 continuity |
  | **F31** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F37–F60 continuity |
  | **F32** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F37–F60 continuity |
  | **F33** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F37–F60 continuity |
  | **F34** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F37–F60 continuity |
  | **F35** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F37–F60 continuity |
  | **F36** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F37–F60 continuity · `BLUR-F36-multi-soft-unlock-retry-RESULT` |
  | **F37** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · gate stop · no Hold / multi / softNative / Sink | `BLUR-F37-multi-soft-unlock-retry-RESULT` |
  | **F38** | **BLOCKED (keyguard)** | same unlock-gate reconfirm (~09:57Z) · AlternateBouncer / fingerprint · multi SoftBlur **not attempted / not claimed** | `BLUR-F38-multi-soft-unlock-retry-RESULT` |
  | **F39** | **BLOCKED (keyguard)** | same unlock-gate reconfirm (~10:06Z) · AlternateBouncer / fingerprint · multi SoftBlur **not attempted / not claimed** | `BLUR-F39-multi-soft-unlock-retry-RESULT` |
  | **F40** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F45–F60 continuity |
  | **F41** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F45–F60 continuity |
  | **F42** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F45–F60 continuity |
  | **F43** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F45–F60 continuity |
  | **F44** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F45–F60 continuity · `BLUR-F44-multi-soft-unlock-retry-RESULT` |
  | **F45** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · gate stop · no Hold / multi / softNative / Sink · UTC ~10:36Z | `BLUR-F45-multi-soft-unlock-retry-RESULT` |
  | **F46** | **BLOCKED (keyguard)** | same unlock-gate reconfirm (~10:47Z) · AlternateBouncer / fingerprint · trust `UNTRUSTED` · multi SoftBlur **not attempted / not claimed** | `BLUR-F46-multi-soft-unlock-retry-RESULT` |
  | **F47** | **BLOCKED (keyguard)** | same unlock-gate reconfirm (~10:49Z) · AlternateBouncer / fingerprint · trust `UNTRUSTED` · multi SoftBlur **not attempted / not claimed** | `BLUR-F47-multi-soft-unlock-retry-RESULT` |
  | **F48** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F54–F60 continuity · `BLUR-F48-multi-soft-unlock-retry-RESULT` |
  | **F49** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F54–F60 continuity · `BLUR-F49-multi-soft-unlock-retry-RESULT` |
  | **F50** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F54–F60 continuity · `BLUR-F50-multi-soft-unlock-retry-RESULT` |
  | **F51** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F54–F60 continuity · `BLUR-F51-multi-soft-unlock-retry-RESULT` |
  | **F52** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F54–F60 continuity · `BLUR-F52-multi-soft-unlock-retry-RESULT` |
  | **F53** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F54–F60 continuity · `BLUR-F53-multi-soft-unlock-retry-RESULT` |
  | **F54** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~11:47Z | `BLUR-F54-multi-soft-unlock-retry-RESULT` |
  | **F55** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F57–F60 continuity · `BLUR-F55-multi-soft-unlock-retry-RESULT` |
  | **F56** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · multi SoftBlur **not claimed** | F57–F60 continuity · `BLUR-F56-multi-soft-unlock-retry-RESULT` |
  | **F57** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~12:16–12:17Z | `BLUR-F57-multi-soft-unlock-retry-RESULT` |
  | **F58** | **BLOCKED (keyguard)** | continuity unlock-retry · still keyguard · AlternateBouncer / fingerprint · serial **43343** · tip **0.1.374/vc382** · multi SoftBlur **not attempted / not claimed** · ~12:26–12:27Z | `BLUR-F58-multi-soft-unlock-retry-RESULT` |
  | **F59** | **BLOCKED (keyguard)** | same unlock-gate reconfirm · AlternateBouncer / fingerprint · trust `UNTRUSTED` · multi SoftBlur **not attempted / not claimed** · ~12:36–12:37Z | `BLUR-F59-multi-soft-unlock-retry-RESULT` |
  | **F60** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · `AlternateBouncerView` · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~12:45–12:47Z | `BLUR-F60-multi-soft-unlock-retry-RESULT` |
  | **F61** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~12:56Z | `BLUR-F61-multi-soft-unlock-retry-RESULT` |
  | **F62** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~13:05–13:07Z | `BLUR-F62-multi-soft-unlock-retry-RESULT` |
  | **F63** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~13:16Z | `BLUR-F63-multi-soft-unlock-retry-RESULT` |
  | **F64** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~13:25–13:26Z | `BLUR-F64-multi-soft-unlock-retry-RESULT` |
  | **F65** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~13:36Z | `BLUR-F65-multi-soft-unlock-retry-RESULT` |
  | **F66** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~13:45–13:46Z | `BLUR-F66-multi-soft-unlock-retry-RESULT` |
  | **F67** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~13:55–13:56Z | `BLUR-F67-multi-soft-unlock-retry-RESULT` |
  | **F68** | **BLOCKED (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · power **Dozing/AOD** · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · focused app `com.brave.browser` Main · gate stop · no Hold / multi / softNative / Sink · multipoll + final ~14:06–14:07Z | `BLUR-F68-multi-soft-unlock-retry-RESULT` |
  | **F69** | **BLOCKED COMPLETE (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · initial **Dozing** then after KEYCODE_WAKEUP Awake (keyguard still true · no PIN) · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · focused app `com.brave.browser` Main · gate stop ~**09:16 MDT** (`20260812T151610Z`) · multipoll 151650–151652Z · no Hold / multi / softNative / Sink · F70 ≥ ~**10:14 MDT** | `BLUR-F69-multi-soft-unlock-retry-RESULT` |
  | **F70** | **BLOCKED COMPLETE (keyguard)** | still `isKeyguardShowing=true` · `mDreamingLockscreen=true` · focus `NotificationShade` · initial **Dozing** then after KEYCODE_WAKEUP Awake (keyguard still true · no PIN) · serial **43343** · tip **0.1.374/vc382** · trust `UNTRUSTED` · deviceLocked=1 · focused app `com.brave.browser` Main · gate stop ~**10:16 MDT** (`20260812T161616Z`) · multipoll 161622–161624Z · no Hold / multi / softNative / Sink · F71 ≥ ~**11:14 MDT** | `BLUR-F70-multi-soft-unlock-retry-RESULT` |
  F9/F16/F19s static only; 1v1 Sink ≠ multi-tile soft. Residual: **human unlock** (PIN/fingerprint) → Settings Hold → `peers≥2` → softNative/Sink per remote. **SCAFFOLD_DONE ≠ MULTI_PASS.** **Do not invent human blur / multi SoftBlur PASS.**
- **L13 residual (historical, APK 0.1.367-vc375):** earlier MATCHED with **`prefs_load mode=intro`** before Hold how-to — superseded by F11+ matrix above for agent evidence; human paste-back still open.

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
| Assert Hold via logcat `prefs_load mode=hold` after human sets chip | Claim Hold PASS from intro smoke or MATCHED alone |

### Human: set Hold (L15 note — still valid; agent F11/F15 already exercised)

| Step | EN | RU / FR (device locales seen) |
|------|----|---------------------|
| Open Settings | Home → Settings / `ruletka://settings` | — |
| Section | **Match & language** | **Матч и язык** / **Correspondance et langue** |
| Row | **Stranger privacy veil** | **Шторка для незнакомцев** / **Voile de confidentialité…** |
| Chip | **Until I tap** (`blurModeHold`) | **Пока не нажму** / **Jusqu'à ce que je touche** |
| Confirm | toast … **Until I tap** · next stranger match | FR: **Jusqu'à ce que je touche · prochain match inconnu** |

Next stranger match expect (Hold only): `prefs_load mode=hold`; veil **stays** until **Show video** (no `intro_auto` peel). Agent F11/F15/F16 logcat chain is **agent evidence only** — human GOAL_MET still open; multi SoftBlur **F17–F70 BLOCKED** (keyguard · serial 43343 · tip 0.1.374; F19s static OK; F71 ≥ ~11:14 MDT) until unlocked device hop.

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
- **Call cards (disk after 452):** `CallPeerAvatar` on incoming / outgoing / no-answer / push-waiting. Lookup friends list + optional `from_avatar`. Letter tile if no URI. **Needs APK** after **0.1.452**.
- Incoming **friend request** is a root Accept/Decline overlay (`HubProvider.incomingFriendReq` + `_layout`), not toast-only. **APK 0.1.452 / vc460** (no Pixel adb that hop).

## Please stay / partner actions (2026-08-20)

- Please stay is **not** a gift-strip / stars-sheet card. Tap-face **LiveMoreSheet** row `more-please-stay` (30★). Gift chips filter `please_stay`. Web: `#btn-partner-please-stay`. No “1× / month” copy. **Unverified** until APK + smoke.

## Friend call = 1v1 (2026-08-20)

- Do **not** auto-hunt 3rd on friend connect. Hunt only after Find 3rd **accepted** (`huntingWithPartner`). Invite pending ≠ looking strip. Gotcha **66**. Disk **live.js 844+**. Android needs APK. **No MULTI_PASS.**

## Ship target (smoke pending)

| Artifact | Version |
|----------|---------|
| APK | **0.1.357-vc365** denser gift FX on disk (`mobile/artifacts/`); Friends polish → **0.1.358** pending; confirm device `app_vc` before claiming |
| Web | **`live.js?v=552`** + **`live-stage.css?v=380`** (fw-v6 fireworks) + **`live-brand.css?v=10`** |
| Checklist | [`../specs/SMOKE-NEXT.md`](../specs/SMOKE-NEXT.md) |
| PC chrome / brand | [live-chrome-ux](live-chrome-ux.md) |
| Device tools | `mobile/scripts/device-smoke.sh`, `scripts/phone-web-pair.mjs` |

### Log
- 2026-08-20 eve: APK **0.1.456 / vc464** on Pixel — disco club 96px + 8 beams **unverified**. Settings self-photo + dock avatar on 454+. Please stay more sheet. **No invent GOAL_MET / MULTI_PASS.**
- 2026-08-20: APK **0.1.452 / vc460** friend-req Accept/Decline. Disk-only after that: call avatars, dock friend-code, Please stay in more sheet, friend-call 1v1 until Find 3rd. Web **846/563**. **No invent GOAL_MET / MULTI_PASS.**
- 2026-08-14 and-wiki (herd `20260814T083341Z`): Android 3-way **split + Stop labels on disk** (portrait top/bottom remotes · PiP you · hunt wrap · 2×2 only at 4 · pair+3rd **Leave 3rd** / you-are-3rd **Leave call**). Tip APK still **0.1.384 / vc392** (director bumps after `--bump` — do not invent vc). Human 3-way faces still **OPEN**. **No MULTI_PASS**. SoftBlur F17–F70 residual unchanged.
- 2026-08-12 residual (F70b continuity): multi SoftBlur device still **OPEN / NOT claimed** — chain **F17–F70 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw dump already current (`knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F70.md`); wiki table/residual already current from F70; **F70 BLOCKED COMPLETE (keyguard)** @ ~**10:16 MDT** unchanged; CONN-idle F70b stamped · hop ~**10:25 MDT** still before gate · **NOT** promote F71; **F71 unlock recheck ≥ ~11:14 MDT** (STOP; or human unlock; F71 backlog; no invent multi PASS). Sources: `BLUR-F70-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F70-note-RESULT`, `CONN-idle-green-F70b-RESULT`, this F70b hop.
- 2026-08-12 residual (F70): multi SoftBlur device still **OPEN / NOT claimed** — chain **F17–F70 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); **F70 BLOCKED COMPLETE (keyguard)** @ ~**10:16 MDT** (`20260812T161616Z`) · NotificationShade · Dozing→Awake after WAKEUP only · keyguard still true · trust UNTRUSTED · no Hold/multi/softNative/Sink · artifacts `f70-blur/`; raw dump `knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F70.md`; **F71 unlock recheck ≥ ~11:14 MDT** (STOP; or human unlock; no invent multi PASS). Sources: `BLUR-F70-multi-soft-unlock-retry-RESULT` (primary), F17–F69 continuity, this F70 wiki hop.
- 2026-08-12 residual (F69b continuity): multi SoftBlur device still **OPEN / NOT claimed** — chain **F17–F69 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw dump already current (`knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F69.md`); wiki table/residual already current from F69; **F69 BLOCKED COMPLETE (keyguard)** @ ~**09:16 MDT** unchanged; director ~**09:35 MDT** still keyguard/Dozing; **F70 unlock recheck ≥ ~10:14 MDT** (STOP; or human unlock; F70 backlog; no invent multi PASS). Sources: `BLUR-F69-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F69-note-RESULT`, `CONN-idle-green-F69b-RESULT`, this F69b hop.
- 2026-08-12 residual (F69): multi SoftBlur device still **OPEN / NOT claimed** — chain **F17–F69 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); **F69 BLOCKED COMPLETE (keyguard)** @ ~**09:16 MDT** (`20260812T151610Z`) · NotificationShade · Dozing→Awake after WAKEUP only · keyguard still true · trust UNTRUSTED · no Hold/multi/softNative/Sink · artifacts `f69-blur/`; raw dump `knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F69.md`; **F70 unlock recheck ≥ ~10:14 MDT** (STOP; or human unlock; no invent multi PASS). Sources: `BLUR-F69-multi-soft-unlock-retry-RESULT` (primary), F17–F68 continuity, this F69 wiki hop.
- 2026-08-12 residual (F68f continuity): multi SoftBlur device still **OPEN / NOT claimed** — chain **F17–F68 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw dump already current (`knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F68.md`); wiki table/residual already current from F68/F68b/F68c/F68d/F68e; still keyguard as of **09:05 probe**; **F69 unlock recheck ≥ ~09:08 MDT** (STOP; or human unlock; F69+ backlog; no invent F69/multi PASS). Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F68-note-RESULT`, `WIKI-keyguard-F68b-note-RESULT`, `WIKI-keyguard-F68c-note-RESULT`, `WIKI-keyguard-F68d-note-RESULT`, `WIKI-keyguard-F68e-note-RESULT`, this F68f hop.
- 2026-08-12 residual (F68e continuity): multi SoftBlur device still **OPEN / NOT claimed** — chain **F17–F68 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw dump already current (`knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F68.md`); wiki table/residual already current from F68/F68b/F68c/F68d; **F69 unlock recheck ≥ ~09:08 MDT** (or human unlock; F69+ backlog; no invent F69/multi PASS). Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F68-note-RESULT`, `WIKI-keyguard-F68b-note-RESULT`, `WIKI-keyguard-F68c-note-RESULT`, `WIKI-keyguard-F68d-note-RESULT`, this F68e hop.
- 2026-08-12 residual (F68d continuity): multi SoftBlur device still **OPEN / NOT claimed** — chain **F17–F68 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw dump already current (`knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F68.md`); wiki table/residual already current from F68/F68b/F68c; **F69 unlock recheck ≥ ~09:08 MDT** (or human unlock; F69+ backlog; no invent F69/multi PASS). Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F68-note-RESULT`, `WIKI-keyguard-F68b-note-RESULT`, `WIKI-keyguard-F68c-note-RESULT`, this F68d hop.
- 2026-08-12 residual (F68c continuity): multi SoftBlur device still **OPEN / NOT claimed** — chain **F17–F68 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw dump already current (`knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F68.md`); wiki table/residual already current from F68/F68b; **F69 unlock recheck ≥ ~09:08 MDT** (or human unlock; F69+ backlog; no invent F69/multi PASS). Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F68-note-RESULT`, `WIKI-keyguard-F68b-note-RESULT`, this F68c hop.
- 2026-08-12 residual (F68b continuity): multi SoftBlur device still **OPEN / NOT claimed** — chain **F17–F68 BLOCKED** keyguard (serial **43343** · tip **0.1.374-vc382**); raw dump `knowledge/raw/2026-08-12-multi-softblur-keyguard-F17-F68.md`; wiki table/residual already current from F68 note; **no invent multi SoftBlur PASS**. Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT`, `WIKI-keyguard-F68-note-RESULT`, this F68b hop.
- 2026-08-12 residual: multi SoftBlur **F17–F68 BLOCKED** keyguard PIN / AlternateBouncer / AOD (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F58–F67** continuity keyguard · **F68** unlock-retry still gate-blocked (~14:06–14:07Z · multipoll · NotificationShade · Dozing/AOD · trust `UNTRUSTED` · brave Main under keyguard) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F68-multi-soft-unlock-retry-RESULT` (primary), F17–F67 continuity (incl. F58–F67 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F67-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F67 BLOCKED** keyguard PIN / AlternateBouncer / AOD (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F58–F66** continuity keyguard · **F67** unlock-retry still gate-blocked (~13:55–13:56Z · multipoll · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F67-multi-soft-unlock-retry-RESULT` (primary), F17–F66 continuity (incl. F58–F66 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F66-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F66 BLOCKED** keyguard PIN / AlternateBouncer / AOD (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F58–F65** continuity keyguard · **F66** unlock-retry still gate-blocked (~13:45–13:46Z · multipoll · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F66-multi-soft-unlock-retry-RESULT` (primary), F17–F65 continuity (incl. F58–F65 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F65-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F65 BLOCKED** keyguard PIN / AlternateBouncer / AOD (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F58–F64** continuity keyguard · **F65** unlock-retry still gate-blocked (~13:36Z · multipoll · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F65-multi-soft-unlock-retry-RESULT` (primary), F17–F64 continuity (incl. F58–F64 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F64-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F64 BLOCKED** keyguard PIN / AlternateBouncer / AOD (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F58–F63** continuity keyguard · **F64** unlock-retry still gate-blocked (~13:25–13:26Z · multipoll · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F64-multi-soft-unlock-retry-RESULT` (primary), F17–F63 continuity (incl. F58–F63 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F63-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F63 BLOCKED** keyguard PIN / AlternateBouncer / AOD (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F58–F62** continuity keyguard · **F63** unlock-retry still gate-blocked (~13:16Z · multipoll · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F63-multi-soft-unlock-retry-RESULT` (primary), F17–F62 continuity (incl. F58–F62 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F62-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F62 BLOCKED** keyguard PIN / AlternateBouncer / AOD (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F58–F61** continuity keyguard · **F62** unlock-retry still gate-blocked (~13:05–13:07Z · multipoll · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F62-multi-soft-unlock-retry-RESULT` (primary), F17–F61 continuity (incl. F58–F61 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F61-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F61 BLOCKED** keyguard PIN / AlternateBouncer / AOD (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F58–F60** continuity keyguard · **F61** unlock-retry still gate-blocked (~12:56Z · multipoll · NotificationShade · Dozing/AOD · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F61-multi-soft-unlock-retry-RESULT` (primary), F17–F60 continuity (incl. F58–F60 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F60-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F60 BLOCKED** keyguard PIN / AlternateBouncer (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F55–F59** continuity keyguard · **F60** unlock-retry still gate-blocked (~12:45–12:47Z · multipoll · AlternateBouncer / fingerprint · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F60-multi-soft-unlock-retry-RESULT` (primary), F17–F59 continuity (incl. F55–F59 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F57-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F57 BLOCKED** keyguard PIN / AlternateBouncer (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F55–F56** continuity keyguard · **F57** unlock-retry still gate-blocked (~12:15–12:17Z · multipoll · AlternateBouncer / fingerprint · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F57-multi-soft-unlock-retry-RESULT` (primary), F17–F56 continuity (incl. F55/F56 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F54-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F54 BLOCKED** keyguard PIN / AlternateBouncer (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F48–F53** continuity keyguard · **F54** unlock-retry still gate-blocked (~11:46–11:47Z · multipoll · AlternateBouncer / fingerprint · trust `UNTRUSTED`) · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F54-multi-soft-unlock-retry-RESULT` (primary), F17–F53 continuity (incl. F48–F53 RESULT files), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F47-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F47 BLOCKED** keyguard PIN / AlternateBouncer (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F40–F44** continuity keyguard · **F45/F46/F47** unlock-retry still gate-blocked · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F45/F46/F47-multi-soft-unlock-retry-RESULT` (primary), F17–F44 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F39-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F39 BLOCKED** keyguard PIN / AlternateBouncer (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F30–F36** continuity keyguard · **F37/F38/F39** unlock-retry still gate-blocked · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F37/F38/F39-multi-soft-unlock-retry-RESULT` (primary), F17–F36 continuity, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F29-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F29 BLOCKED** keyguard PIN / AlternateBouncer (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F25–F27** continuity keyguard · **F28/F29** unlock-retry still gate-blocked · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F17…F29-*-RESULT` (F28/F29 primary), `BLUR-F19s-multi-soft-static-reconfirm-RESULT`, `WIKI-keyguard-F24-note-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F24 BLOCKED** keyguard PIN / AlternateBouncer (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F23/F24** unlock-retry still gate-blocked · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F17…F24-*-RESULT`, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F21 BLOCKED** keyguard PIN / AlternateBouncer (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); **F20/F21** unlock-retry still gate-blocked · no Hold / multi / softNative / Sink; human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F17/F18/F19/F20/F21-*-RESULT`, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`.
- 2026-08-12 residual: multi SoftBlur **F17–F19 BLOCKED** keyguard PIN (serial **43343** · tip **0.1.374-vc382**); **F19s static OK** (wiring + product flag intact · not device PASS); human unlock needed; **no invent multi SoftBlur PASS**. Sources: `BLUR-F17/F18/F19-*-RESULT`, `BLUR-F19s-multi-soft-static-reconfirm-RESULT`.
- 2026-08-12 morning compound: Soft **1v1** agent matrix **closed** (F11–F14 on **371** · F15 Hold **373** · F16b Off+Intro **374-vc382**); multi SoftBlur **F17+F18 BLOCKED** keyguard (peers=0, 0× softNative/Sink, SCAFFOLD only / F18 not attempted) · tip package **0.1.374/vc382** · **no invent multi SoftBlur PASS / human blur GOAL_MET**. Sources: `BLUR-F17/F18-*-RESULT`, `BLUR-F16-off-intro-373-RESULT`, F11–F15 RESULTs, L28/L31 docs.
- 2026-08-12 overnight-2 compound: Soft **1v1** agent matrix **F11 Hold · F12 Off · F14 Intro** on **0.1.371-vc379** + **F15 Hold reconfirm** on **0.1.373-vc381** post-MX (`softNative=1`+Sink where privacy on); multi SoftBlur **open**; multi-pair SCAFFOLD only; **no invent human blur / multi SoftBlur PASS**. Sources: `BLUR-F11/F12/F14/F15-*-RESULT`, `L28-smoke-softblur-docs-RESULT`.
- 2026-08-12 L16 wiki: L13 intro-not-hold + L15 Settings Hold how-to stamped — tip **0.1.367-vc375**; `prefs_load mode=intro` on L13; Hold **not** device-exercised then; **no** blur product PASS invent. Sources: `L13-phone-blur-hold-smoke-RESULT`, `L15-settings-blur-hold-note-RESULT`.
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

## Friends Signal look (2026-08-12 night seed)

- Spec: `knowledge/specs/FRIENDS-SIGNAL-LOOK.md`
- Conversation-list rows: avatar 52 · online green dot · name+time · preview · unread pill · videocam icon
- Tap = chat, long-press = actions; no Chat/Call text CTA cluster
- RESULT: `tasks/admin-queue/done/453-friends-signal-s2-s4-RESULT.md`
- Human smoke / APK OPEN — do not claim visual PASS from agent alone.

