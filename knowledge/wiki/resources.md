# Resource catalog

Short cards for sources filed via **`/add-new-resource`**. Full dumps stay in `knowledge/raw/` (immutable). Prefer this catalog over re-reading raw.

---

## [2026-10-05] Idle empty-tile online/queue chip {#card-empty-online-chip}

- **Date:** 2026-10-05
- **Type:** screenshot
- **Raw:** [`raw/2026-10-05-empty-online-chip.md`](../raw/2026-10-05-empty-online-chip.md)
- **Shot:** `artifacts/shots/2026-10-05-empty-online-chip.png`
- **Related:** `#empty-online-chip` in `ui/live.html` · `updateEmptySharePresence` in `ui/live.js` · `ui/live-stage.css`

### Takeaways

1. Human wants the green idle pill gone: `1 В сети · 0 В очереди`.
2. Header pool-bar is already hidden; this chip was the lobby counts on the empty tile.
3. Settings still has Online/Waiting under Lobby.
4. CSS used `display: inline-flex !important` even with `[hidden]`.

---

## [2026-08-24] Partner actions overlap {#card-mobile-partner-actions-overlap}

- **Date:** 2026-08-24
- **Type:** screenshot
- **Raw:** [`raw/2026-08-24-mobile-partner-actions-overlap.md`](../raw/2026-08-24-mobile-partner-actions-overlap.md)
- **Shot:** `artifacts/shots/2026-08-24-mobile-partner-actions-overlap.jpg`

### Takeaways

1. Tile chrome z 50–63 beat partner-menu z 46.
2. Hide volume/flag/avatar/name while the sheet is open.

---

## [2026-08-24] Mobile browser 1v1 chrome {#card-mobile-browser-1v1-chrome}

- **Date:** 2026-08-24
- **Type:** screenshot
- **Raw:** [`raw/2026-08-24-mobile-browser-1v1-chrome.md`](../raw/2026-08-24-mobile-browser-1v1-chrome.md)
- **Shot:** `artifacts/shots/2026-08-24-mobile-browser-1v1-chrome.jpg`
- **Related:** `live-brand.css` seam · `live-stage.css` portrait 1v1 tray

### Takeaways

1. Vertical `ruletka.me` was on the partner tile (stage 50% ≠ 1.12/0.88 seam).
2. Next / Block / Stop / Friends sat left over the face.
3. Portrait 1v1: horizontal pill on the seam; actions flush right. Landscape keep L|R.

---

## [2026-08-24] Android idle Start diamond {#card-android-idle-start}

- **Date:** 2026-08-24
- **Type:** screenshot
- **Raw:** [`raw/2026-08-24-android-idle-start.md`](../raw/2026-08-24-android-idle-start.md)
- **Shot:** `artifacts/shots/2026-08-24-android-idle-start.jpg`
- **Related:** `IdleArcadeStart.tsx` · `LiveBottomBar.tsx` · loading-screen.mp4 720×1096

### Takeaways

1. Start is too low — under Chat Roulette, not on the gold diamond.
2. Portrait COVER keeps video Y; diamond is ~70% of the 1096px frame (PC 81% was after landscape crop).
3. Stop/Next must not show before Start.
4. Chrome-only. No ICE.

---

## [2026-08-22] Stars self-gov interview {#card-stars-self-gov}

- **Date:** 2026-08-22
- **Type:** note
- **Raw:** [`raw/2026-08-22-stars-self-gov.md`](../raw/2026-08-22-stars-self-gov.md)
- **Wiki:** [`stars-reputation.md`](stars-reputation.md)

### Takeaways

1. Trust ≠ wallet. Tiers need unique gifters (5 / 12).
2. Non-underage auto-ban is 1 vote each — stars do not buy bans.
3. Recommended unverified hop: one-tap post-chat praise + Praised-by-N chip.

---

## [2026-08-22] Android partner actions bottom tab {#card-android-partner-actions-tab}

- **Date:** 2026-08-22
- **Type:** screenshot
- **Raw:** [`raw/2026-08-22-android-partner-actions-tab.md`](../raw/2026-08-22-android-partner-actions-tab.md)
- **Shot:** `artifacts/shots/20260822T213751Z-phone-partner-actions.png`
- **Related:** `LiveMoreSheet.tsx` (mounted inside the bottom bar) · web `.partner-menu` is a floating card

### Takeaways

1. Human: cool **window**, not a bottom tab.
2. Sheet is a sibling under Stop/Next and covers most of the face.
3. `stars.pleaseStayBtn` painted as the raw key on this locale.
4. Chrome-only. No connect claim.

---

## [2026-08-22] Android 1v1 bottom bar {#card-android-bottom-bar}

- **Date:** 2026-08-22
- **Type:** screenshot
- **Raw:** [`raw/2026-08-22-android-bottom-bar.md`](../raw/2026-08-22-android-bottom-bar.md)
- **Shot:** `artifacts/shots/20260822T212134Z-phone-bottom-bar.png`
- **Related:** `LiveBottomBar.tsx` · `liveStyles.ts` (`btnGhost` / `btnNext` / `MATCHED_ROW`) · web `#btn-next.next-in-tile-floor` 3D

### Takeaways

1. Stop/Next sit in a **black slab under** the video, not on the tile like PC.
2. `MATCHED_ROW` pads for PiP (`108+16`) while PiP lives on the video → empty black to the right of Next.
3. Stop is a ghost pill on black (hard to see). Next is flat `#3d7eff`, not the 3D coral PC Next.
4. Six icon circles left-packed with the same wasted PiP gap.
5. **Unverified** as product PASS — chrome-only. No connect claim.

---

## [2026-08-21] PC Hide vs Blur them {#card-pc-blur-compare}

- **Date:** 2026-08-21
- **Type:** screenshot
- **Raw:** [`raw/2026-08-21-pc-blur-compare.md`](../raw/2026-08-21-pc-blur-compare.md)
- **Shots:** `20260821T201652Z-pc-blur-compare.png` · `20260821T201842Z-pc-blur-compare.png`
- **Related:** gotcha **31** / **71** · `applyLocalHideCover` · `applyPeerBlurCover` · `#self-hide-veil`

### Takeaways

1. Hide (self) is live cam under `backdrop-filter: blur(26px)` glass — not a pixel canvas.
2. 20:16Z both on: same frost family; Hide a bit darker, Blur them creamier.
3. 20:18Z Hide still the nice frost; partner was sharp (Blur them off).
4. Human: **nice blur is good now**. Pins **865/581**. Not a connect PASS.

---

## [2026-08-19] Phone 3-way dual names + black tiles {#card-3way-phone-dual-id-black}

- **Date:** 2026-08-19
- **Type:** image
- **Raw:** [`raw/2026-08-19-3way-phone-dual-id-black.md`](../raw/2026-08-19-3way-phone-dual-id-black.md)
- **Shot:** `artifacts/shots/20260819T200600Z-phone-3way-now.png`

### Takeaways

1. Split is two black halves; PiP self is live.
2. Laptop + Драгонов stacked on the **top** tile.
3. Extra chrome + `remoteFill` escaped the 50% tile (no `position:relative`).
4. **No MULTI_PASS.**

---

## [2026-08-19] 3-way laptop no Android cam {#card-3way-laptop-no-android}

- **Date:** 2026-08-19
- **Type:** paste + scorecard
- **Raw:** [`raw/2026-08-19-3way-laptop-no-android.md`](../raw/2026-08-19-3way-laptop-no-android.md)

### Takeaways

1. Laptop extra to Android stuck ice=**checking** 0/0 offerer=0 ~100s.
2. 818 skip-re-offer-while-checking blocked the 2nd kick on a dead extra.
3. PC↔Android two-way; laptop no cam (fout=0); mto/mta ~6s.
4. Phone 04:47 screenshot is not this 3-way. **No MULTI_PASS.**

---

## [2026-08-19] Browser blur new conversationalist = blue screen {#card-blur-blue-screen}

- **Date:** 2026-08-19
- **Type:** paste
- **Raw:** [`raw/2026-08-19-blur-blue-screen.md`](../raw/2026-08-19-blur-blue-screen.md)
- **Source:** human: “blur does work on browser for new conversationalist only blue screen”

### Takeaways

1. Intro blur on a new stranger hid `#remote` before frost-vid painted.
2. Navy `#2a3342` captureStream + `::after` backdrop-filter = blue slab.
3. Keep the live face until frost `.is-on`. Pin **`live.js?v=819`** · stage **550**.
4. Unverified until hard-refresh smoke (face behind frost, not blue).

---

## [2026-08-18] Spotlight still has yellow circle {#card-spotlight-yellow-circle}

- **Date:** 2026-08-18
- **Type:** screenshot
- **Raw:** [`raw/2026-08-18-spotlight-yellow-circle.md`](../raw/2026-08-18-spotlight-yellow-circle.md)
- **Source:** `artifacts/shots/20260818T144700Z-spotlight-yellow-circle.png`

### Takeaways

1. Gold ring over the face during Spotlight (old iris + circular dim hole).
2. Remove every circle. Cone + shaft + edge shade only. No `mix-blend-mode: screen`.
3. Disk `live-stage.css?v=538`.

---

## [2026-08-18] Partner actions compact effects {#card-partner-actions-effects}

- **Date:** 2026-08-18
- **Type:** screenshot
- **Raw:** [`raw/2026-08-18-partner-actions-effects.md`](../raw/2026-08-18-partner-actions-effects.md)
- **Source:** `artifacts/shots/20260818T141400Z-partner-actions.png`

### Takeaways

1. Gift rows include duration + “they get ★1” — too wide.
2. Want **icon · name · cost** only.
3. Sheet should be narrower / more compact.
4. Debate / Find 3rd / Add friend / Block stay as they are.

---

## [2026-08-18] Laptop debate send/recv miss + PC cam {#card-laptop-debate-no-recv-pc-cam}

- **Date:** 2026-08-18
- **Type:** paste
- **Raw:** [`raw/2026-08-18-laptop-debate-no-recv-pc-cam.md`](../raw/2026-08-18-laptop-debate-no-recv-pc-cam.md)
- **Related:** `ui/live.js` `sendDebateP2p` hub chat · `mobile/src/media/debate.ts` · gotcha **64**

### Takeaways

1. Laptop invite: other two did not receive. Others invite each other: laptop sees nothing.
2. Laptop sees **Android cam**, not **PC browser cam**. ★ still wrong.
3. Debate was P2P DC only; laptop extra DC often missing. Hub `chat` already fans out to `session_peers`.
4. Identity DC painted wallet ★ onto the wrong tile (`identElId || remote`).
5. **Unverified** until 785 smoke + APK for Android hub path. **No MULTI_PASS.**

---

## [2026-08-18] Laptop 3-way Party of 2 + no debate {#card-laptop-3way-party-of-two}

- **Date:** 2026-08-18
- **Type:** paste
- **Raw:** [`raw/2026-08-18-laptop-3way-party-of-two.md`](../raw/2026-08-18-laptop-3way-party-of-two.md)
- **Related surfaces:** `ui/live.js` `handleMatched` `setSplitRemote` `liveDebateRoster` · skill `multi-party-stage` · gotcha **64** · spec `current-multi-party.md`

### Takeaways

1. Laptop 3rd: mid tile has camera + correct name, **wrong ★**.
2. Left tile **black**, name **Party of 2** (`friends.partyTag`) — pair treated as one slot.
3. No debate invite / overlay / SFX / Accept on laptop. PC + Android debate worked.
4. Root: `setSplitRemote` when `opponents>=2 && !trioBrowse` + `lastMatchMeta.peers` empty for debate roster.
5. **Unverified** until hard-refresh `live.js?v=784`. **No MULTI_PASS.**

---

## [2026-08-17] Behind bars cartoon stripes {#card-bars-cartoon}

- **Date:** 2026-08-17
- **Type:** screenshot
- **Raw:** [`raw/2026-08-17-bars-cartoon-pc.md`](../raw/2026-08-17-bars-cartoon-pc.md)
- **Source:** `artifacts/shots/20260817T154300Z-bars-cartoon-pc.png`

### Takeaways

1. Live bars read as flat black CSS stripes + fat shutter rails.
2. Recolor to oxidized iron pipes, wider 68px pitch, two 14px straps.
3. Do not densify rods. Do not filter `<video>`.

---

## [2026-08-17] Android debate invite covered {#card-debate-invite-covered}

- **Date:** 2026-08-17
- **Type:** screenshot
- **Raw:** [`raw/2026-08-17-android-debate-invite-covered.md`](../raw/2026-08-17-android-debate-invite-covered.md)
- **Source:** `artifacts/shots/20260817T145401Z-android-debate-invite.jpg`
- **Related surfaces:** `LiveDebateChrome.tsx` · `liveStyles.ts` `debateInviteCard` · `debate.ts` P2P invite

### Takeaways

1. Incoming **Formal debate?** card is at the bottom of the stage.
2. Stop / Next / PiP cover **Decline** and **Accept**.
3. Same slot is why starting a debate from Android looks like “nothing happens” (compose sat under the bar).
4. Fix: centered `Modal` for invite + compose (not `bottom: 16` over SurfaceView).
5. **Needs APK** to smoke on phone. No invent WIN.

---

## [2026-08-17] Blur them still sharp {#card-blur-them-still}

- **Date:** 2026-08-17
- **Type:** screenshot
- **Raw:** [`raw/2026-08-17-blur-them-still-sharp.md`](../raw/2026-08-17-blur-them-still-sharp.md)
- **Source:** `artifacts/shots/20260817T201305Z-blur-them-still-pc.png`
- **Related surfaces:** `ui/live.js` `startPeerBlurCanvas` / `bindFrostVideo` · `ui/live-stage.css` partner-blurred · gotcha 31 (never `filter:blur()` on `<video>`)

### Takeaways

1. Human: Blur them does nothing; partner Courtier stays **sharp**.
2. Hide / self-blur on the same GPU **works** (Dragonov PiP smeared).
3. Self path plays `#local-frost` (second `<video>` of captureStream). Partner 721–724 mounted a **canvas** over `#remote` — Chrome HW video punches through canvas.
4. Do not hide `#remote` into black without frost-vid bound. Do not `filter:` the live video.
5. Unverified until human hard-refresh after frost-vid hop.

---

## [2026-08-16] browser new-user 18+ / agreement {#card-new-user-gates}

- **Raw:** [`raw/2026-08-16-new-user-browser-gates.md`](../raw/2026-08-16-new-user-browser-gates.md)
- Shots: left 18+ card on black void, then tiny agreement modal stacked on leftover age card.
- Hop **682/459**: one centered card, two steps. Legal Accept kept. **Browsers.**

## [2026-08-16] 3-way laptop Courtier/Dragonov swap shots {#card-3way-swap}

- **Raw:** [`raw/2026-08-16-3way-laptop-swap-shots.md`](../raw/2026-08-16-3way-laptop-swap-shots.md)
- **Diag:** [`raw/2026-08-16-3way-laptop-swap-diag.md`](../raw/2026-08-16-3way-laptop-swap-diag.md)
- PC: Laptop no-cam OK · Courtier mid no-cam **wrong** · you live. Phone: Dragonov Almost there. Laptop: Courtier name + wrong video. Paint hop **679**. Extra ICE later. **No MULTI_PASS.**

## [2026-08-16] laptop console Incompatible send direction {#card-laptop-send-dir}

- **Raw:** [`raw/2026-08-16-laptop-incompatible-send-dir.md`](../raw/2026-08-16-laptop-incompatible-send-dir.md)
- **Takeaways:** webrtc **334** loaded; UDP relay count=1; `setRemote(answer)` failed send direction; ice=new. nsfwjs / funnel 400 / ruletka.me WS are noise. Gotcha **63**.

---

## [2026-08-16] mute icon speaker+ban {#card-mute-icon}

- **Date:** 2026-08-16
- **Type:** screenshot · chrome
- **Raw:** [`raw/2026-08-16-mute-icon.md`](../raw/2026-08-16-mute-icon.md)
- **Source:** `/home/drakosik/Pictures/2026-08-15_21-03.png`
- **Related:** `.peer-slot-muted` · `LiveStageVideo` mute overlay

### Takeaways

1. Human wants this speaker + red prohibition mark, not 🔇.
2. Show it on the **muted person's** tile (you mute them → them; they mute you → you).
3. Same language on browser + Android. **No MULTI_PASS.**


## [2026-08-16] browser 3-way mid-tile name clip {#card-mid-tile-id-clip}

- Shot `/home/drakosik/Pictures/2026-08-15_20-33.png`
- Raw: `raw/2026-08-16-mid-tile-id-clip.md`
- Takeaways: name clipped to L; Canada/Calgary missing first letters; PARTN/vol/Blur always-on (autohide CSS force-show). ★ top-right already. **No MULTI_PASS.**

## [2026-08-16] browser 3-way mid-tile chrome {#card-mid-tile-chrome}

- **Date:** 2026-08-16
- **Type:** screenshot · chrome hop
- **Raw:** [`raw/2026-08-16-mid-tile-chrome.md`](../raw/2026-08-16-mid-tile-chrome.md)
- **Source:** `/home/drakosik/Pictures/2026-08-15_20-26.png`
- **Related:** `ui/live.html` `#tile-third` · `live-chrome-ux.md` · tap-face still opens partner menu

### Takeaways

1. Mid tile (`#tile-third`) is crowded: name · hide · blur · two volumes · ★61 · `⋯`.
2. Human: drop `⋯`, pin ★ top-right, drop symbols + volume **between** name and stars.
3. Left rail (Partner / vol / Blur) stays. Tap face still opens actions.
4. Keep name / loc / ★ on no-cam cylinder (409 WIN). **No MULTI_PASS.**

## [2026-08-16] park laptop 3rd two-videos {#card-laptop-3rd-park}

- **Date:** 2026-08-16
- **Type:** paste · **PARKED · no MULTI_PASS**
- **Raw:** [`raw/2026-08-16-laptop-3rd-park.md`](../raw/2026-08-16-laptop-3rd-park.md)

### Takeaways

1. Human asked to stop. Laptop 3rd still not two cameras.
2. Resume from park raw + two-videos / offer-android specs. Score first.
3. Extra MediaSession reset is disk-only until next APK.

## [2026-08-16] laptop vs PC 3-way compare {#card-laptop-vs-pc-3way-compare}

- **Date:** 2026-08-16
- **Type:** screenshot · compare · **ROLE + missing laptop inbound**
- **Raw:** [`raw/2026-08-16-laptop-vs-pc-3way-compare.md`](../raw/2026-08-16-laptop-vs-pc-3way-compare.md)
- **Shots:** `010045Z-laptop-3way.jpg` · `010045Z-pc-3way.png`

### Takeaways

1. Same 3-way, different **role**: laptop is the 3rd (vs a pair); this PC is in the pair.
2. This PC view is honest: Courtier phone live + Laptop cylinder + you.
3. Laptop shows **0 inbound cameras**. Mid ★133 is Courtier, named Partner, no-cam. Left Dragonov black.
4. Not a different Chrome. **No MULTI_PASS.**

## [2026-08-16] laptop Courtier tile shows PC cam {#card-laptop-courtier-pc-cam}

- **Date:** 2026-08-16
- **Type:** paste · **FAIL bind/name/no-cam**
- **Raw:** [`raw/2026-08-16-laptop-courtier-pc-cam.md`](../raw/2026-08-16-laptop-courtier-pc-cam.md)

### Takeaways

1. Left labeled Courtier (Android) but paints Dragonov cam.
2. Mid Partner should be Dragonov; PC cam then no-cam cover.
3. Hop **662**: occupancy name on #remote; extra name not collapsed; no-cam never re-covers a face.
4. **No MULTI_PASS.**

## [2026-08-16] 414 phone layout good {#card-414-layout-good}

- **Date:** 2026-08-16
- **Type:** paste · human smoke · **layout WIN**
- **Raw:** [`raw/2026-08-16-414-layout-good.md`](../raw/2026-08-16-414-layout-good.md)
- **Install:** APK **0.1.414 / vc422**
- **Prior FAIL:** `004610Z` Dragonov twice + self strip + 2×2 at 3

### Takeaways

1. Human: phone 3-way layout is good now.
2. Does not close laptop-sees-phone-cam (414 extra-reset smoke).
3. **No MULTI_PASS.**

## [2026-08-16] Android 3-way layout messed {#card-android-messed-3way}

- **Date:** 2026-08-16
- **Type:** screenshot · **layout FAIL**
- **Raw:** [`raw/2026-08-16-android-messed-3way.md`](../raw/2026-08-16-android-messed-3way.md)
- **Shot:** `artifacts/shots/20260816T004610Z-android-messed.png`
- **APK:** still **0.1.413 / vc421**

### Takeaways

1. 3 people, 4 stacked bands. Dragonov on black dock + Dragonov live again.
2. Laptop no-cam cylinder is correct.
3. Self is a full-width tile, not PiP. **2×2** shown at 3 people (gotcha **41**).
4. Extra-reset APK not installed. **No MULTI_PASS.**

## [2026-08-15] 659 laptop sees PC not Android {#card-659-laptop-sees-pc-no-android}

- **Date:** 2026-08-15
- **Type:** paste · human smoke · **partial**
- **Raw:** [`raw/2026-08-15-659-laptop-sees-pc-no-android.md`](../raw/2026-08-15-659-laptop-sees-pc-no-android.md)
- **Score:** `20260815T235546Z`

### Takeaways

1. 659 WIN: laptop paints this PC. Not MULTI_PASS.
2. Laptop 1 PC only (offerer to this PC). Android extra ice=new bind_v=0.
3. Match-wide one-offer lock skipped laptop→phone. Hop 6 **660/332**.
4. **No MULTI_PASS.**

## [2026-08-15] 657 laptop still 17-33-58 {#card-657-same-laptop}

- **Date:** 2026-08-15
- **Type:** paste · human smoke · **FAIL after 657**
- **Raw:** [`raw/2026-08-15-657-same-laptop.md`](../raw/2026-08-15-657-same-laptop.md)
- **Score:** `20260815T234313Z`

### Takeaways

1. Laptop still 0 videos (same photo). This PC 657 still sees phone + laptop cylinder.
2. product.ok is pair only. Laptop absent from av_path. Android extra still ice=failed.
3. Hop 3 skipped dead `#remote` and treated failed PC as joined. Hop 4 **658**.
4. **No MULTI_PASS.**

## [2026-08-15] laptop 3-way zero videos {#card-laptop-3way-zero-videos}

- **Date:** 2026-08-15
- **Type:** screenshot · human + CDP PC · **FAIL**
- **Raw:** [`raw/2026-08-15-laptop-3way-zero-videos.md`](../raw/2026-08-15-laptop-3way-zero-videos.md)
- **Shots:** `233542Z-laptop-3way.jpg` · `233542Z-pc-3way.png`
- **Score:** `20260815T233602Z`

### Takeaways

1. Laptop **should** show 2 videos (phone + this PC). Chip already says “vs a pair (two videos)”.
2. Laptop paints **0**: Courtier black · Partner no-cam · self no-cam.
3. This PC paints phone live + laptop cylinder + self. Correct for the pair side.
4. product.ok **421** is PC↔phone. Android extra still ice=failed. Laptop absent from av_path this window.
5. **No MULTI_PASS.** Next hop still `ui/live.js` keep/re-offer extra — ask first.

## [2026-08-15] laptop only sees this PC {#card-laptop-only-sees-pc}

- **Date:** 2026-08-15
- **Type:** paste · human smoke · **FAIL 3rd hop**
- **Raw:** [`raw/2026-08-15-laptop-only-sees-pc.md`](../raw/2026-08-15-laptop-only-sees-pc.md)
- **Score:** `20260815T230938Z`

### Takeaways

1. Human: laptop shows this PC camera, **not** the phone.
2. Matches score: laptop 1 PC · android extra ice=failed 0/0 after answer.
3. Pair product.ok is leftover 1v1. **No MULTI_PASS.**

## [2026-08-15] laptop-last 3-way score {#card-laptop-last-3way-score}

- **Date:** 2026-08-15
- **Type:** note · av-verify · screenshots · **FAIL laptop↔Android**
- **Raw:** [`raw/2026-08-15-laptop-last-3way-score.md`](../raw/2026-08-15-laptop-last-3way-score.md)
- **Score:** `20260815T230938Z` · APK **0.1.413 / vc421**
- **Shots:** `230857Z-android-laptop-last-pre.png` · `230938Z-pc-laptop-last-3way.png`

### Takeaways

1. This-PC + prod pins **656/331/451**. Phone **413/vc421**. Laptop pin **not seen**.
2. Headline product.ok is **PC↔phone 1v1 only** (4275/4763 · 4704/4249).
3. Laptop↔Android: android 2nd PC **ice=failed 0/0** sig=stable; laptop reports **one** PC (to this PC, fin=3616 fout=0).
4. Phone Laptop cylinder is correct (no webcam). This-PC left tile **black** labeled Laptop; mid cylinder named Partner.
5. Window offers=9 answers=9 is the 10-min aggregate — **not** MULTI_PASS. Gotcha **59** still open.

## [2026-08-15] Android 1v1 bar overlaps self PiP {#card-android-1v1-bar-overlap}

- **Date:** 2026-08-15
- **Type:** screenshot · human paste · **UX hop**
- **Raw:** [`raw/2026-08-15-android-1v1-bar-overlap.md`](../raw/2026-08-15-android-1v1-bar-overlap.md)
- **Shots:** `artifacts/shots/20260815T165215Z-android-1v1-bar.png` · `165142Z`
- **Spec:** `2026-08-15-android-bar-pip.md`
- **Herd:** `20260815T225522Z`

### Takeaways

1. Human likes self cam as bottom-right PiP. Stop / Report / Next + friends/blur sit on the picture.
2. Hop: drop Report + Friends from the bar (Report stays on tap-face sheet). Shift remaining left of PiP.
3. Verify first, then build — **not built yet**.
4. **No MULTI_PASS.** Not leftover 1v1 product.ok.

## [2026-08-15] 411 dock stars works {#card-411-dock-stars-works}

- **Date:** 2026-08-15
- **Type:** paste · human smoke · **UX hop WIN**
- **Raw:** [`raw/2026-08-15-411-dock-stars-works.md`](../raw/2026-08-15-411-dock-stars-works.md)
- **Install:** APK **0.1.411 / vc419**
- **Prior FAIL:** `223755Z` missing dock ★ + overlapping chips

### Takeaways

1. Human: dock ★ + no overlapping Dragonov/Laptop chips — **works**.
2. Extra tile chrome (409) still held.
3. Not MULTI_PASS. Not leftover 1v1 product.ok.

## [2026-08-15] Android 3-way double identity + gifts bar {#card-android-doubles-chrome}

- **Date:** 2026-08-15
- **Type:** screenshot · human paste · **UX hop**
- **Raw:** [`raw/2026-08-15-android-doubles-chrome.md`](../raw/2026-08-15-android-doubles-chrome.md)
- **Shot:** `artifacts/shots/20260815T160739Z-android-doubles.png`
- **Spec:** `2026-08-15-android-dedupe-chrome.md`
- **Herd:** `20260815T221947Z`

### Takeaways

1. Top tile doubles identity: dock + StageTileChrome (name/flag/loc). Extra ★ top-right.
2. Gifts + Message + Send eat the extra tile; tap-face partner actions already own those.
3. Hop: one dock identity; extra tiles keep chrome (409); hide gifts/chat compose. Needs APK.
4. **No MULTI_PASS.**

## [2026-08-15] 409 extra no-cam chrome works {#card-409-extra-nocam-chrome-works}

- **Date:** 2026-08-15
- **Type:** paste · human smoke · **UX hop WIN**
- **Raw:** [`raw/2026-08-15-409-extra-nocam-chrome-works.md`](../raw/2026-08-15-409-extra-nocam-chrome-works.md)
- **Install:** APK **0.1.409 / vc417**
- **Spec:** `2026-08-15-android-extra-nocam-chrome.md`

### Takeaways

1. Human: 3rd-tile name/★ no longer vanish under the no-cam picture.
2. Identity (name · ★ · flag · loc) stays over the cylinder.
3. Overlay only — not MULTI_PASS, not leftover 1v1 product.ok.

## [2026-08-15] 408 tap-face works {#card-408-tap-face-works}

- **Date:** 2026-08-15
- **Type:** paste · human smoke · **UX hop WIN**
- **Raw:** [`raw/2026-08-15-408-tap-face-works.md`](../raw/2026-08-15-408-tap-face-works.md)
- **Install:** APK **0.1.408 / vc416** (`adb install -r` Pixel `45141FDAP0004F`)
- **Spec:** `2026-08-15-android-partner-actions.md`

### Takeaways

1. Human: tap-face partner actions **works** on 408.
2. 1v1 tap partner / 3-way tap each face → that person's sheet (parity with web `live.js?v=656` 3rd-tile).
3. Not 3-way MULTI_PASS. Not leftover 1v1 product.ok. First-offer recvonly still OPEN.
4. **No product.ok invent. No MULTI_PASS.**

## [2026-08-15] 407 rematch works {#card-407-rematch-works}

- **Date:** 2026-08-15
- **Type:** paste · **progress after FAIL**
- **Raw:** [`raw/2026-08-15-407-rematch-works.md`](../raw/2026-08-15-407-rematch-works.md)
- **Prior:** `205612Z` no-media / Linking

### Takeaways

1. Human: rematch **works** after the first 407 1v1 was black / Linking.
2. First-offer `video_dir=recvonly` on a cam-present PC is still an OPEN residual (gotcha 48/53 family).
3. **No product.ok invent. No MULTI_PASS.**

## [2026-08-15] 407 1v1 not linking `205612Z` {#card-407-nolin-1v1}

- **Date:** 2026-08-15 20:56Z
- **Type:** screenshot · av-verify · **FAIL 1v1**
- **Raw:** [`raw/2026-08-15-407-nolin-1v1.md`](../raw/2026-08-15-407-nolin-1v1.md)
- **Shots:** `artifacts/shots/20260815T205612Z-nolin407-{phone,pc}.png`
- **Score:** `20260815T205622Z` product **no-media** app_vc **415**

### Takeaways

1. Phone 1v1 black (PiP self live). PC “Linking cameras…” · local you-tile live.
2. Signaling + TURN OK. Android ICE checking→**failed**. Frames 0/0.
3. Web first offer was **`video_dir=recvonly`** while PC clearly has a camera.
4. Not a rotate-layout FAIL. Do not flip force_relay. **No product.ok invent.**

## [2026-08-15] 406 phone — split + PC video stays {#card-406-phone-pc-video-stays}

- **Date:** 2026-08-15
- **Type:** paste · human smoke · **progress ≠ MULTI_PASS**
- **Raw:** [`raw/2026-08-15-406-phone-pc-video-stays.md`](../raw/2026-08-15-406-phone-pc-video-stays.md)
- **Install:** APK **0.1.406 / vc414** (`adb install -r`)
- **Related:** gotcha **59** · spec `2026-08-15-3way-held-nobreak.md`

### Takeaways

1. Human: split screen, 2 conversationalists, **PC browser video visible on phone**.
2. That closes the `201649Z` “PC cam then no-cam cover” FAIL on this APK.
3. They called it **progress**, not done. Laptop→Android (`live.js?v=652`) not in this paste.
4. **No MULTI_PASS.**

## [2026-08-15] Laptop sees PC not Android — 3rd-link diagnose {#card-laptop-no-android-diag}

- **Date:** 2026-08-15 20:16Z
- **Type:** note · scorecard
- **Raw:** [`raw/2026-08-15-laptop-no-android-diag.md`](../raw/2026-08-15-laptop-no-android-diag.md)
- **Related:** gotcha **59** · spec `2026-08-15-3way-held-nobreak.md`

### Takeaways

1. Same Chrome is a red herring. Laptop never beaconed `offerer=1` toward Android.
2. Android extra waits as answerer (`ice=new bind_v=0`). Web vs mobile = web offers.
3. Next hop: `live.js` `joinPeers` the missing mobile peer on 3rd-join. **No MULTI_PASS.**

## [2026-08-15] 3-way hunt-keep held — PC cam then no-cam cover `201649Z` {#card-3way-held-nocam-cover}

- **Date:** 2026-08-15 20:16Z
- **Type:** screenshot · human paste · av-verify leftover
- **Raw:** [`raw/2026-08-15-3way-held-nocam-cover.md`](../raw/2026-08-15-3way-held-nocam-cover.md)
- **Spec:** [`../specs/2026-08-15-3way-held-nobreak.md`](../specs/2026-08-15-3way-held-nobreak.md)
- **Shots:** `artifacts/shots/20260815T201649Z-3way-smoke2-phone.png` · `201554Z-3way-smoke-pc-live.png` · recapture `201933Z-3way-held-phone.png`
- **Related:** skill `multi-party-stage` · `android-partner-paint` · gotcha 38/40/48 · `current-no-cam.md`

### Takeaways

1. Hunt-keep **HELD** — do not remount RTC while searching for a 3rd.
2. Android two-stack worked. PC cam painted then **NoCamPortrait covered it** (top labeled Драконов).
3. Bottom laptop no-cam is correct (no webcam). Same Chrome on PC vs laptop — laptop misses Android; not a browser-version bug.
4. av-verify answers 2 < offers 3 · one web `ice=new` 0/0. Leftover product.ok is 1v1, **not** this 3-way.
5. Next: overlay routing only (no ICE). Auto-rotate later, no remount. **No MULTI_PASS.**

### Notes

- Locks outrank this card. Do not flip force_relay.

## [2026-08-15] Hunt lost first face after 400 1v1 `052135Z` {#card-hunt-lost-first-face}

- **Date:** 2026-08-15 05:21Z
- **Type:** screenshot · CDP · human paste · **FAIL hunt · 1v1 leftover ok is not this gate**
- **Raw:** [`raw/2026-08-15-hunt-lost-first-face.md`](../raw/2026-08-15-hunt-lost-first-face.md)
- **Shots:** `artifacts/shots/20260815T052135Z-hunt3rd-{phone,pc}.png` · `052326Z-hunt3rd-cdp{1,2}.png`
- **Related:** spec `2026-08-15-3way-now.md` · skill `multi-party-stage` · gotcha hunt remount

### Takeaways

1. Human: 1v1 fixed on 400. Hunt for 3rd → Android lost first face; self cam still works; PC browser cam froze.
2. Live shots missed the match (phone idle Start; CDP both tabs Start). av-verify leftover 1v1 product.ok **not** hunt PASS.
3. Three read-only lanes agree: hunt still wraps 1v1 (`splitStage = huntingThird`). Not startCall / not webrtc.js.
4. Next hop: hunt must keep the same 1v1 RTCView tree. Split only when a 3rd is listed.
5. **No MULTI_PASS.**

## [2026-08-15] 397 smoke phone Start / PC 3-col `040927Z` {#card-3way-phone-start-pc-3col}

- **Date:** 2026-08-15 04:09Z
- **Type:** screenshot · **FAIL · STOP APK**
- **Raw:** [`raw/2026-08-15-3way-phone-start-pc-3col.md`](../raw/2026-08-15-3way-phone-start-pc-3col.md)
- **Shots:** `artifacts/shots/20260815T040927Z-verify397-{phone,pc}.png`

### Takeaways

1. Phone idle Start (last chat Dragonov 9s). PC still 3-col Courtier moving.
2. 397 omit-extra keep does not run after leave. Same as `030415Z`.
3. Human: **no more APKs until 3-way is right.**
4. **No MULTI_PASS.**

## [2026-08-15] CaptureThread crash 0.1.395 `21:50:59` {#card-capturethread-crash-395}

- **Date:** 2026-08-15 03:50Z / 21:50:59 local
- **Type:** logcat · screenshot · **FAIL**
- **Raw:** [`raw/2026-08-15-capturethread-crash-395.md`](../raw/2026-08-15-capturethread-crash-395.md)
- **Related:** gotcha CaptureThread · `refreshLocalVideoTrack` · MediaSession

### Takeaways

1. App died to home. Same stack as 20:04:34: Camera2 session closed mid `onConfigured`.
2. New GUM + new PC ctor in the same 20ms as old session configuring.
3. 394 skip only `multiPeerAudio` — 1v1 / second session still GUMs.
4. Do not ICE. **No product.ok invent.**

## [2026-08-15] 1v1 phone lost PC video `034125Z` {#card-1v1-phone-lost-pc-video}

- **Date:** 2026-08-15 03:41Z
- **Type:** screenshot · av-verify · **FAIL · no product.ok invent**
- **Raw:** [`raw/2026-08-15-1v1-phone-lost-pc-video.md`](../raw/2026-08-15-1v1-phone-lost-pc-video.md)
- **Shots:** `artifacts/shots/20260815T034125Z-lostcam-{phone,pc}.png`
- **Related surfaces:** skill `av-fix-loop` · gotcha B · Hide canvas 649 · `ensureBlurSampleVideo`

### Takeaways

1. 1v1 layout OK. PC sees Courtier. Phone Dragonov **black**. PC you-tile **black**.
2. Parser product.ok is a lie: web bytes_out tiny vs bytes_in megabytes. Dummy/navy frames still increment counters.
3. Same family as `025340Z` (649 rAF). 649 still returns `#local` as sample when `readyState>=2` even if **videoWidth=0** → fillRect dummy.
4. frost `show()` bails once if `!videoWidth` — you-tile stays black, not frost.
5. Do not thrash ICE / MediaSession. **No MULTI_PASS.**

## [2026-08-15] 3-way look then Courtier frozen `030415Z`→`030650Z` {#card-3way-look-then-frozen}

- **Date:** 2026-08-15 03:04–03:06Z
- **Type:** screenshot · CDP · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-15-3way-look-then-frozen.md`](../raw/2026-08-15-3way-look-then-frozen.md)
- **Shots:** `artifacts/shots/20260815T030415Z-3way-look-{pc,phone}.png` · `…030421Z-cdp-3way-look.png` · `…030645Z-courtier-frozen2-{pc,phone}.png` · `…030650Z-cdp-courtier-frozen2.png`
- **Related surfaces:** skill `multi-party-stage` · spec `2026-08-15-3way-now.md` · gotcha **56** · `pickPrimaryPeerIndex` / `keepFirstOnOmit`

### Takeaways

1. `030415Z` PC 3-col Courtier **moving** | Laptop no-cam | Dragonov live. Phone already **idle Start** (not in the 3-way).
2. `030650Z` same names; Courtier **frozen** leftover; phone **1v1** no-cam Partner + local PiP.
3. Diagnose: hub omit-primary remount tore Courtier (`pickPrimary` → 0). Disk keepFirstOnOmit APK **0.1.395** not smoked.
4. Lobby-spin (`030415` Start while PC 3-col) is a **second** FAIL — keepFirstOnOmit does not apply after leave.
5. Do not rematch-tear first PC to unstick leftover still. **No MULTI_PASS.**

### Notes

- Thin sidecar `raw/2026-08-15-3way-courtier-frozen2.md` covers 030650Z only — left immutable.

## [2026-08-15] Courtier stops + Android no PC cam `024638Z` {#card-courtier-stop-android-novid}

- **Date:** 2026-08-15 02:46Z
- **Type:** screenshot · CDP · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-15-courtier-stop-android-novid.md`](../raw/2026-08-15-courtier-stop-android-novid.md)
- **Shots:** `artifacts/shots/20260815T024638Z-names-novid-phone.png` · `…-pc.png` · `20260815T024643Z-cdp-names-novid.png`

### Takeaways

1. Phone partner tile is **black** (no Dragonov/PC cam). PiP is self. Find-3rd modal names **Dragonov** — that is the PC, correct for 1v1.
2. Five seconds later PC Courtier is **black**: inbound tracks **ended**, clock stuck 8.31, leftover PC `ice=new` empty.
3. Hunt “Looking for a 3rd” ran on a one-way 1v1. Do not rematch-tear first face.
4. Pins 648/331 · APK 0.1.394.

---

## [2026-08-15] Courtier freeze + Android split gone `023355Z` {#card-courtier-freeze-split-gone}

- **Date:** 2026-08-15 02:33Z
- **Type:** screenshot · CDP · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-15-courtier-freeze-android-split-gone.md`](../raw/2026-08-15-courtier-freeze-android-split-gone.md)
- **Shots:** `artifacts/shots/20260815T023355Z-courtier-freeze-pc.png` · `…-phone.png` · `20260815T023400Z-cdp-courtier-freeze.png`

### Takeaways

1. PC `#remote` Courtier is a **frozen last frame** (`currentTime` 8.49 stuck). ICE **failed**.
2. Phone PiP moving is **self preview** — not proof frames reach the PC.
3. Android 2-screen 3-way split is **gone** — 1v1 no-cam Partner ★0. `extraPeerCount` is 0.
4. Do not rematch-tear the first PC to “unfreeze”; extra ICE still OPEN.

---

## [2026-08-15] Android CaptureThread crash mid 3-way `20:04:34` {#card-android-capturethread-crash}

- **Date:** 2026-08-14 20:04:34 local / 2026-08-15 Z
- **Type:** logcat · native/Java crash · **FAIL**
- **Raw:** [`raw/2026-08-15-android-capturethread-crash.md`](../raw/2026-08-15-android-capturethread-crash.md)
- **Related:** `MediaSession.refreshLocalVideoTrack` · startCall2 · gotcha 33 is older SoftBlur SIGABRT

### Takeaways

1. `IllegalStateException: Session has been closed` on `Camera2Session.onConfigured` / CaptureThread.
2. 0.1.393 vc401 died mid 3-way; Chrome 646 names were already correct.
3. Phone after restart = 1v1 black Partner. PC stayed 3-col, teammate ice=disconnected.
4. Do not mid-call GUM / applyFullAudioProcessing when extras join.

---

## [2026-08-15] 3-way names swapped `015545Z` {#card-3way-names-swapped}

- **Date:** 2026-08-15 01:55Z
- **Type:** screenshot · identity FAIL · **no MULTI_PASS**
- **Raw:** [`raw/2026-08-15-3way-names-swapped.md`](../raw/2026-08-15-3way-names-swapped.md)
- **Shots:** `artifacts/shots/20260815T015545Z-3way-names-pc.png` · `…-phone.png`
- **Related:** skill `mobile-match-identity` · gotcha 32 · hop `live.js?v=646`

### Takeaways

1. 3-way tiles **exist** (progress). Left live cam, mid no-cam cylinder, you Dragonov.
2. Names **swapped**: left **Laptop** (belongs on mid) · mid **Partner** (should be Laptop) · left should be **Courtier**.
3. Phone still 1v1-style Partner + no-cam under settings overlay — extras APK-gated.
4. Do not thrash 1v1 ICE to fix names.

---

## [2026-08-15] 1v1 PC↔Android Linking + no-cam `004321Z` {#card-1v1-pc-android-linking}

- **Date:** 2026-08-15 00:43Z
- **Type:** screenshot · av-verify · **FAIL · no product.ok**
- **Raw:** [`raw/2026-08-15-1v1-pc-android-linking.md`](../raw/2026-08-15-1v1-pc-android-linking.md)
- **Shots:** `artifacts/shots/20260815T004321Z-1v1now-pc.png` · `…-phone.png` · `…-cdp.png`
- **Related:** skill `av-fix-loop` · spec `current-av.md` · gotcha 2 (PASS signaling ≠ frames)

### Takeaways

1. This is **1v1**, not 3-way. PC MATCHED Драконов | phone matched Partner.
2. **Neither camera lands:** PC partner = **Linking cameras**; phone partner = **No camera** cylinder. Phone self PiP is live (ceiling).
3. Score `004415Z` product **no-media** web **0/0** android **0/0** after offers=3 answers=3. ICE still **checking**. Offer slow ~7s.
4. Android policy **all**, hub force_relay **false**. TURN HOT but no frames. app_vc **400**.
5. Debug Chrome tab is **idle Start** on 635/329 — not this pair. Do not diagnose 1v1 from that tab.

---

## [2026-08-14] 3-way ended tracks black `234930Z` + hop 635/329 {#card-3way-ended-tracks-black}

- **Date:** 2026-08-14 23:49Z
- **Type:** screenshot · CDP · av-verify · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-14-3way-ended-tracks-black.md`](../raw/2026-08-14-3way-ended-tracks-black.md)
- **Spec:** [`specs/2026-08-14-3way-cameras-plan.md`](../specs/2026-08-14-3way-cameras-plan.md)
- **Shots:** `artifacts/shots/20260814T234600Z-cdp-live.png` · `…234930Z-cdp-live.png` · `…234751Z-phone.png` · `…234903Z-cam3b-phone.png` · `…234903Z-cam3b-pc.png`

### Takeaways

1. CDP `234930Z`: `#remote` w=427 h=320 **has-remote-feed** but audio+video tracks **ended** — leftover WxH painted as a black slab instead of the no-cam cylinder. New failure mode, not empty/no-cam.
2. Root: 3rd-join `ice_failed` used `dropOnePeerKeepRest` and tore down the **first**, already-good PC — dead stream stayed bound to `#remote`.
3. Phone still **1v1** no-cam Partner cylinder + self PiP, no split, app **0.1.392**.
4. Score `234754Z` product.ok is prior-1v1 only; 1v2 android arm_0 **0/0**, first offer `video_dir=recvonly`.
5. Hop (disk+rsync) `live.js?v=635` · `webrtc.js?v=329` stamp `20260814T235308Z-cam3-635` — ended-tracks paint fix + no-drop first-ok PC + recvonly→sendrecv renegotiate. **Needs human hard-refresh to score.** Gotcha **53**. **No MULTI_PASS.**

---

## [2026-08-14] Laptop 16:41 sees PC; PC `224219Z` mid poster {#card-laptop-vs-pc-630}

- **Date:** 2026-08-14 16:41–16:42 (laptop user 16:41 · PC/phone `224219Z`)
- **Type:** screenshot · av-verify · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-14-laptop-vs-pc-630.md`](../raw/2026-08-14-laptop-vs-pc-630.md)
- **Shots:** `artifacts/shots/20260814T224100Z-laptop-user.jpg` · `…224219Z-lapcmp-pc-ruletka.png` · `…-lapcmp-phone.png`

### Takeaways

1. Laptop 16:41 **3-col** sees this PC: Courtier = PC cam **live** | Partner ★205 **black** | Laptop self **no-cam cylinder**. Banner You vs a pair · YOU Laptop ★31.
2. Broken i18n on laptop self tile: **No Cam Title / No Cam Sub** (keys, not copy).
3. PC `224219Z` **3-col**: Courtier **black** | mid **giant** cylinder **No Cam Title / No Cam Sub** | you live. Weak reconnecting · footer **1v1** Stop/Next.
4. Phone `224219Z` **1v1** cylinder “No camera / Talking with microphone · Partner” ★0 · **no split**.
5. Score `224230Z` product **one-way** web 3641/3650 · android **0/0** app_vc **None**. **No MULTI_PASS.**

---

## [2026-08-14] After 3-col then black `223218Z` {#card-after-3col-then-black}

- **Date:** 2026-08-14 22:32Z
- **Type:** screenshot · av-verify · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-14-after-3col-then-black.md`](../raw/2026-08-14-after-3col-then-black.md)
- **Shots:** `artifacts/shots/20260814T223218Z-after-pc-ruletka.png` · `…-after-pc.png` · `…-after-pc-left.png` · `…-after-phone.png` · prior `…223139Z-morework-*`

### Takeaways

1. `223139Z` (~16:31): PC **3-col** Laptop **beige/blur video** | Partner ★31 **black** | you live. Banner You + friend · stranger on the right. Phone **idle Start** last Partner 30s.
2. `223218Z` (~16:32): PC **3-col** Laptop **solid black** | Partner ★31 **black** | you live. Same banner + Stop Leave Third.
3. Phone matched **1v1** · no-cam cylinder · toast “Still no video — tap Retry path or Next” · Partner ★0 · **no split**.
4. av-verify `223227Z` product **one-way** web 767/774 · android **0/0** bind_v=**0** app_vc=400. **No MULTI_PASS.**

---

## [2026-08-14] Laptop Chrome 3-col vs PC Chrome 2-col {#card-laptop-vs-pc-chrome-3way}

- **Date:** 2026-08-14 22:12Z
- **Type:** screenshot · **FAIL · ROLE ≠ app · no MULTI_PASS**
- **Raw:** [`raw/2026-08-14-laptop-vs-pc-chrome-3way.md`](../raw/2026-08-14-laptop-vs-pc-chrome-3way.md)
- **Shots:** laptop `Downloads/laptop chrome browser photo_2026-08-14_16-09-11.jpg` · PC `artifacts/shots/20260814T221232Z-pc-left.png` · `…-pc-xwd.png` · phone `…221222Z-compare3c-phone.png`

### Takeaways

1. Laptop **3-col**: Courtier **black** | Драконов **live** | Laptop self no-cam. Banner **You vs a pair**. YOU **Laptop** ★31.
2. This PC `221232Z` **2-col**: Courtier **black** + mute | Драконов self live. YOU **Драконов**. 1v1 dock. Title Connecting…
3. Phone `221222Z` still **1v1**: partner **Laptop** ★31 **black**. No split.
4. 3-col vs 2-col is **ROLE** (Laptop is the 3rd vs a pair; this PC is still 1v1), **not** a different app.
5. **No MULTI_PASS.**

---

## [2026-08-14] iPhone+PC+Android 3-way {#card-iphone-pc-android-3way}

- **Date:** 2026-08-14 21:49Z
- **Type:** note · av-verify · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-14-iphone-pc-android-3way.md`](../raw/2026-08-14-iphone-pc-android-3way.md)
- **Spec:** [`../specs/2026-08-14-iphone-pc-android-3way.md`](../specs/2026-08-14-iphone-pc-android-3way.md)

### Takeaways

1. Mix is **inverted**: iPhone Safari + PC 1v1 first; Android joins as **3rd**.
2. Browsers see each other; neither sees Android; Android sees nobody.
3. iPhone hangup → 2 tiles, PC sees Android again (3→2 keep works).
4. Score: android ice=failed 0/0 · two webs host→host ~4900 frames · offers 8 answers 6.
5. **No MULTI_PASS.**

---

## [2026-08-14] PC first black / second painted {#card-pc-first-black-second-ok}

- **Date:** 2026-08-14 21:43–21:45Z
- **Type:** screenshot · av-verify · **paint FAIL then rematch paint · no GOAL_MET**
- **Raw:** [`raw/2026-08-14-pc-first-black-second-ok.md`](../raw/2026-08-14-pc-first-black-second-ok.md)
- **Shots:** `artifacts/shots/20260814T214314Z-novid-pc-ruletka.png` · `…-second-ok-pc.png`

### Takeaways

1. First 1v1: phone sees PC; PC Courtier **black**. Scorecard **product.ok** frames both ways.
2. Second connect: PC Courtier **live**. ICE was fine.
3. Cause: inbound `track.muted` treated as no-cam + CSS painted `#remote-no-cam[hidden]` at z=9.
4. Disk fix `live.js?v=627` · stage **442** — **not on prod** until rsync.
5. **No GOAL_MET.**

---

## [2026-08-14] 3-way-now 213141Z this PC 2-col {#card-3way-625-now-shots}

- **Date:** 2026-08-14 21:31Z
- **Type:** screenshot · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-14-3way-625-now-shots.md`](../raw/2026-08-14-3way-625-now-shots.md)
- **Shots:** `artifacts/shots/20260814T213141Z-3way-now-pc-ruletka.png` · `…-phone.png`
- Human: “im in 3 way right now”

### Takeaways

1. **This** PC tab is **2-col**: Courtier **black**, you live. No 3rd tile.
2. Pixel is **idle Start** — not in the call this screencap.
3. 625 occupancy hop **not visible** here (either not 3-way on this tab, or collapsed).
4. 3rd may be on another laptop this DISPLAY cannot see.
5. **No MULTI_PASS.**

---

## [2026-08-14] 3-way 624 shots — PC split, remotes black {#card-3way-624-shots}

- **Date:** 2026-08-14 21:18Z
- **Type:** screenshot · **layout partial · media FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-14-3way-624-shots.md`](../raw/2026-08-14-3way-624-shots.md)
- **Shots:** `artifacts/shots/20260814T211817Z-3way-624-pc-ruletka.png` · `…-phone.png`
- **Related:** spec `2026-08-14-finish-3way-4way.md` · prod `live.js?v=624`

### Takeaways

1. **PC layout:** 3 columns (Laptop | Courtier | you) — 624 split **did** fire.
2. **PC media:** Laptop + Courtier tiles **black** (laptop should be no-cam portrait, not empty).
3. **Phone layout:** still **1v1** Partner ★0 + no-cam cylinder — extra tile needs APK.
4. MATCHED + Mesh + Relayed. Not 1v1 leftover chrome on PC tiles.
5. **No MULTI_PASS** — faces missing both remotes on PC; phone not split.

### Notes

- Unverified av-verify this frame. Locks outrank.

---

## [2026-08-14] 3-way same FAIL after 623 rsync {#card-3way-same-shots}

- **Date:** 2026-08-14 21:09Z
- **Type:** screenshot · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-14-3way-same-shots.md`](../raw/2026-08-14-3way-same-shots.md)
- **Shots:** `artifacts/shots/20260814T210922Z-3way-same-phone.png` · `…-pc.png` · `…-pc-ruletka.png`
- **Related:** `2026-08-14-3way-android-laptop-pc-partial.md` · spec `2026-08-14-finish-3way-4way.md` · prod `live.js?v=623`

### Takeaways

1. PC still **2-col 1v1**: Courtier **black**, you live — **no 3rd column**.
2. Matches last human: original PC never split 3-way; conversationalist black.
3. Phone already **idle Start** (28s last chat) — 3-way on the phone not in this frame.
4. Seam watermark on the 1v1 line (not the place bug).
5. 623 rsync did **not** close this FAIL. **No MULTI_PASS.**

### Notes

- Unverified which tab hard-refreshed 623. Locks outrank. No invent product.ok.

---

## [2026-08-14] 3-way Android + laptop + PC partial {#card-3way-android-laptop-pc-partial}

- **Date:** 2026-08-14
- **Type:** note · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-14-3way-android-laptop-pc-partial.md`](../raw/2026-08-14-3way-android-laptop-pc-partial.md)
- **Related:** skill `multi-party-stage` · `handleFindThirdResult` · `start_party_vs_solo` · `clearStaleTrioOnPair` · spec `2026-08-14-3way-see-everyone.md`

### Takeaways

1. Hunt split on Android worked; after 3rd joined phone showed **only laptop**.
2. Laptop (3rd) saw Android, not the original PC.
3. Original PC stayed **1v1** + black conversationalist (no 3-col).
4. 621 `clearStaleTrioOnPair` could collapse trio while 3rd PC still connecting.
5. Android remount on 3rd join (gotcha 1) still possible on **0.1.392**.

### Notes

- Unverified scorecard. Locks outrank. **No MULTI_PASS.**

---

## [2026-08-14] PC watermark on partner tile {#card-watermark-partner-tile}

- **Date:** 2026-08-14 14:17
- **Type:** screenshot · **FAIL place · no brand GOAL_MET**
- **Raw:** [`raw/2026-08-14-watermark-partner-tile.md`](../raw/2026-08-14-watermark-partner-tile.md)
- **Source:** `/home/drakosik/Pictures/2026-08-14_14-17.png`
- **Related:** skill `brand-stage` · `ui/live-brand.css` · `#stage-brand-center` · spec `BRAND-SPIN-IMPROVE-PLAN.md` · gotcha **19**

### Takeaways

1. Vertical `ruletka.me` pill sits **inside the partner tile** (right of mute), not on the partner|you **center seam**.
2. Left Courtier is frosted; right Драконов is sharp — 1v1 match-live.
3. Contract: PC mark is `.stage-brand-center` on the seam; `.stage-wm` stays hidden.
4. Likely cause: abspos grid item `left:50%` used the **first grid cell** as containing block, not the stage padding box.
5. Human asked for **one 360° every 30s** (was ~15s / 16.2s cycle).

### Notes

- Unverified which URL (vip vs 8787) produced the shot. Disk hop is place + 30s; prod needs rsync. **No invent brand PASS.**

---

## [2026-08-14] Hide СКРЫТЬ no frost on you-tile {#card-hide-skryt-no-blur}

- **Date:** 2026-08-14 (shot file 2026-08-11 13:19)
- **Type:** screenshot · **FAIL · no blur GOAL_MET**
- **Raw:** [`raw/2026-08-14-hide-skryt-no-blur.md`](../raw/2026-08-14-hide-skryt-no-blur.md)
- **Source:** `/home/drakosik/Pictures/2026-08-11_13-19.png` (+ `13-18.png` partner ПОКАЗАТЬ)
- **Related:** `btn-blur-self` · `applyLocalHideCover` · `#self-hide-veil` · spec `2026-08-14-one-live-blur.md`

### Takeaways

1. You-rail **СКРЫТЬ** is idle (not gold, not Reveal) — `selfBlurred` looks **false**.
2. Face behind the rail is not frosted.
3. Partner rail 13-18 **ПОКАЗАТЬ** gold — Blur them toggle armed; Hide is the broken control.
4. Disk veil hops need **human rsync**; pin ≠ prod.
5. Hide must frost **#tile-local** on this laptop, not only outbound to the phone.

---

## [2026-08-14] Android blur 2–3s → Linking → camera gone {#card-android-blur-then-linking}

- **Date:** 2026-08-14
- **Type:** screenshot trio · **FAIL · no product.ok invent**
- **Raw:** [`raw/2026-08-14-android-blur-then-linking.md`](../raw/2026-08-14-android-blur-then-linking.md)
- **Shots:** `artifacts/shots/20260814T091900Z-tg1-video-blur.jpg` · `…-tg2-linking.jpg` · `…-tg3-camera-gone.jpg`
- **Related:** `live.tsx` `revealPartnerVideo` / `INTRO_UNBLUR_MS=2800` · SoftBlur · `2026-08-14-android-first-paint.md` · gotcha **33/34/45**

### Takeaways

1. Face **is** on stage under intro SoftBlur (tg1) — not an ICE miss.
2. ~2–3s later (intro timer) tile goes navy + **Linking cameras…** (tg2). Identity fills in (Partner ★0 → Драконов ★205) in the same second.
3. Linking pill then hides; partner tile stays empty (tg3). Self PiP never dies.
4. Matches `intro_auto` peel → `forceRepaintRemote` remount, not a new connect.
5. Phone still **0.1.384 / vc392** unless user installed 385. Disk latch + peel skip need APK.

---

## [2026-08-14] 3-way black + sliver + silent `084504Z` {#card-3way-messed-novideo}

- **Date:** 2026-08-14
- **Type:** screenshot · **FAIL · no MULTI_PASS**
- **Raw:** [`raw/2026-08-14-3way-messed-novideo.md`](../raw/2026-08-14-3way-messed-novideo.md)
- **Shots:** `artifacts/shots/20260814T084504Z-3way-messed-pc.png` · `…-phone.png`
- **Score:** av-verify `084452Z` product one-way · android 0/0 · app_vc **392**

### Takeaways

1. PC MATCHED 3-way banner but **hunt Find 3rd** occupies the middle column.
2. You crushed to a sliver; left Courrier **black**; no conversationalist cams.
3. Phone still 1v1 Partner ★0 black — tip APK **385 not installed** (beacon 392).
4. offers=3 answers=2. Tab is **prod** — disk hops need rsync.
5. Related: `2026-08-14-3way-messed-novideo.md` · multi-party-stage

---

## [2026-08-14] Android partner tile black 14:44 {#card-android-black-partner}

- **Date:** 2026-08-14
- **Type:** screenshot · **FAIL · no product.ok invent · not MULTI_PASS**
- **Raw:** [`raw/2026-08-14-android-black-partner.md`](../raw/2026-08-14-android-black-partner.md)
- **Source:** `artifacts/shots/20260814T075019Z-android-black-partner.jpg`
- **Related surfaces:** `mobile/app/live.tsx` · `mobile/src/live/LiveStageVideo.tsx` · `current-no-cam.md` · `one-way-video.md` · av-fix-loop paint/ontrack

### Takeaways

1. Phone is **matched 1v1 for 14:44** — Linking overlay **gone**, timer painted, chrome live.
2. Partner tile is **empty navy** (not cylinder, not blur veil). Self PiP **is** the face. Browser seeing Android matches outbound.
3. Same-session av-path: android **frames_in ~15k** — decoder has pictures; this is **paint / dummy-black / missing no-cam**, not ICE down.
4. Two honest forks: (a) partner browser is sending a **black dummy** video m-line (laptop no-cam / old sendrecv) so RTCView stays black; (b) real PC cam frames are not bound to SurfaceView.
5. Disk no-cam cylinder hop is **not in APK 0.1.384 / vc392**. Do not invent GOAL_MET.

### Notes

- Human: “android stopped linking cameras but on browser i can see android camera.”
- Scorecard leftover `074811Z` is **not** a new product.ok for this FAIL.

---

## [2026-08-14] 3-way black + UI off (`071810Z`)

| | |
|--|--|
| **Type** | Screenshot · **FAIL · no MULTI_PASS** |
| **Raw** | [`../raw/2026-08-14-3way-now-black.md`](../raw/2026-08-14-3way-now-black.md) |
| **Shot** | `artifacts/shots/20260814T071810Z-3way-now-pc-live.png` (phone **no adb**) |
| **Score** | av-verify `20260814T071744Z` product.ok is **1v1** leftover; 1v2 answers&lt;offers |

**Takeaways:** 3-column trio, you sliver; laptop black (no portrait); 3rd dark + hex `AC8BEC2F`; no faces. UI off. Phone not on USB. Disk hops 594/410 **not proven on this tab**.

---

## [2026-08-14] 3rd not linking (no3rd3)

| | |
|--|--|
| **Type** | Screenshot dump · **FAIL · no MULTI_PASS** |
| **Raw** | [`../raw/2026-08-14-no3rd-linking.md`](../raw/2026-08-14-no3rd-linking.md) |
| **Shots** | `artifacts/shots/20260814T032707Z-no3rd3-{pc,phone}.png` |
| **Hop** | `live.js?v=578` `showThirdConnecting` — disk only |

**Takeaways:** pair stayed on hunt brand after 3rd matched because `setThirdSlotStream(null)` undid `joinPeers`. Phone was solo first-in-line. Same-identity two tabs kick. No MULTI_PASS.

---

## [2026-08-14] Phone plug measure (desk A+D)

| | |
|--|--|
| **Type** | Lab dump (USB Pixel bench · **not** product PASS · **not** linking GOAL_MET) |
| **Raw** | [`../raw/2026-08-14-phone-plug-measure.md`](../raw/2026-08-14-phone-plug-measure.md) — desk-raw **MEASURE_IN_FLIGHT** |
| **Device** | Pixel 9 Pro · USB **`45141FDAP0004F`** · keyguard off · stay_on=15 · APK **0.1.376 / vc384** |
| **Scorecard** | `artifacts/av-verify/latest.md` still **`20260812T193821Z`** mto **1498** / mta **2685** · **measure in flight** |
| **Herd** | `artifacts/herd/20260814T024723Z` · wiki lane **desk-wiki**; siblings desk-raw / desk-docs |

**Takeaways**

1. Phone is a USB lab bench (plan **A+D**): **A** = av-verify + logcat while match; **D** = `scripts/phone-desk.sh` (no APK install; `guard` refuses keyguard spam).
2. Installed **0.1.376 / vc384** — hide_ip warm on disk (`preferRelayWarm`) is **not** in this APK; this measure cannot verify that hop.
3. Residual to beat remains **1498/2685** until `latest.md` `at=` is newer than `2026-08-12T19:38:21Z`.
4. latest.md still **193821Z** → **measure in flight**. Desk plug ≠ product.ok ≠ linking GOAL_MET.
5. `phone-desk.sh guard` exits 2 on keyguard — do not SoftBlur / unlock spam.

**Repo surfaces:** `wiki/linking-speed.md` · `scripts/phone-desk.sh` · `artifacts/phone-desk/status.txt`.

---

## [2026-08-14] P2P + linking-speed brainstorm

| | |
|--|--|
| **Type** | Director brainstorm (Grok after iOS-audio herd · **not** product FAIL · **not** linking GOAL_MET) |
| **Raw** | [`../raw/2026-08-14-linking-brainstorm.md`](../raw/2026-08-14-linking-brainstorm.md) |
| **Scorecard** | `artifacts/av-verify/latest.md` **product.ok** `20260812T193821Z` mto **1498** / mta **2685** · app_vc **383** · web 4372/5038 · android 5021/4371 |
| **Herd** | `artifacts/herd/20260814T021956Z` · wiki lane **link-wiki**; siblings link-harness / link-spec / link-static |

**Takeaways**

1. Latest **product.ok** residual is **1498/2685** — closer than morning wiki **1895/3122**; still **no linking GOAL_MET** (1498 at 1500 pure stretch · 2685 &gt; 2500).
2. Prefer honest harness (gotcha 24: `ROULETTE_TURN=off` + same-IP `force_relay` → pair-smoke 0/0) so agents stop “fixing” fake wire silence.
3. Avoid cutting `relayWaitBudgetMs` again (already 480/300), dual-write MediaSession + live.js, pool&gt;0 / dual-offer / sticky wipe / SFU.
4. This herd: **no** MediaSession, **no** live.js, **no** webrtc.js. Human hard-refresh + new av-verify before any budget hop.

**Repo surfaces:** `wiki/linking-speed.md` · spec `current-linking-speed.md`.

---

## [2026-08-14] iPhone Safari audio crackle + delay

| | |
|--|--|
| **Type** | Human paste (friend on iPhone browser · **unverified** product FAIL) |
| **Raw** | [`../raw/2026-08-14-iphone-safari-audio.md`](../raw/2026-08-14-iphone-safari-audio.md) |
| **Spec** | [`../specs/current-ios-safari-audio.md`](../specs/current-ios-safari-audio.md) |
| **Herd** | `artifacts/herd/20260814T021357Z` · wiki lane **ios-wiki**; code lanes ios-boost / ios-gum **in progress** |

**Takeaways**

1. Symptom: crackling + big delay between speakers on **Safari/WebKit** (not Android app). No scorecard / av-verify / device logs.
2. Default mic-boost **125%** always builds Web Audio (Gain + compressor + dest) unless unity 100% — comment says skip is required for AEC.
3. GUM forced **48k** vs WebKit AudioContext often **44.1k** → resample crackle; meter taps live send track.
4. **No product.ok / “fixed”** until human iPhone Safari smoke. Code hop **not claimed shipped** at wiki write.

**Repo surfaces:** `wiki/ios-safari-audio.md` · `wiki/gotchas.md` §27 · spec `current-ios-safari-audio.md`.

---

## [2026-08-14] Herd connect-safe cleanup (P0 + P1 inventory)

| | |
|--|--|
| **Type** | Herd run dump (compound · **not** product PASS) |
| **Raw** | [`../raw/2026-08-14-herd-connect-safe-cleanup.md`](../raw/2026-08-14-herd-connect-safe-cleanup.md) · P1 map [`../raw/2026-08-13-connect-p1-extract.md`](../raw/2026-08-13-connect-p1-extract.md) |
| **Run** | `artifacts/herd/20260814T020528Z` · 5/5 lanes done |

**Takeaways**

1. P0 shipped: dead fire-and-forget gone; outbound watch timers cleared on `closeCall`; `[client-ice]` demoted; tests import **real** `connectUi` (lock 16s).  
2. UI A–D leftovers + retry/stats siblings **already-clean**.  
3. P1 extract **inventory only** — do not split MediaSession without one writer + smoke. P2 out.  
4. `dev-smoke --unit` PASS · **no product.ok / APK**.

**Repo surfaces:** `wiki/connect-cleanup.md` · `wiki/gotchas.md` §25–26 · spec `current-ui-dedupe-connect-cleanup.md` · Claude `479-connectui-import-real-RESULT`.

---

## [2026-08-12] Multi SoftBlur keyguard chain F17–F70 (device OPEN)

| | |
|--|--|
| **Type** | Residual dump (agent compound · not product PASS) |
| **Raw** | [`../raw/2026-08-12-multi-softblur-keyguard-F17-F70.md`](../raw/2026-08-12-multi-softblur-keyguard-F17-F70.md) (prior: [`F17–F69`](../raw/2026-08-12-multi-softblur-keyguard-F17-F69.md) · [`F17–F68`](../raw/2026-08-12-multi-softblur-keyguard-F17-F68.md)) |
| **Device** | Pixel 9 Pro · adb **`192.168.1.94:43343`** · package **0.1.374-vc382** |

**Takeaways**

1. Multi SoftBlur **device** still **OPEN / NOT claimed**.  
2. Hops **F17–F70** all **BLOCKED (keyguard)** — latest **F70 BLOCKED COMPLETE** @ ~**10:16 MDT**: NotificationShade · Dozing→Awake (WAKEUP only) · keyguard still true · trust UNTRUSTED · no Hold/multi/softNative/Sink.  
3. F19s static OK ≠ device PASS · SCAFFOLD_DONE ≠ MULTI_PASS · **no invent multi SoftBlur PASS**.  
4. Unblock is human unlock only · **F71** gated ≥ ~**11:14 MDT** (STOP).

**Repo surfaces:** `wiki/mobile-ux.md` multi SoftBlur table · `wiki/multi-party.md` residual · `wiki/log.md` F70 + F70b continuity + F69/F69b · F68/F68b–F68f · RESULT `WIKI-keyguard-F70-note-RESULT` + `WIKI-keyguard-F70b-note-RESULT` + prior F69* wiki RESULTs.

---

## [2026-08-10] Marchese — 10× Claude (self-improve + skill library)

| | |
|--|--|
| **Type** | YouTube + local screenshots |
| **Raw** | [`../raw/2026-08-10-marchese-10x-claude.md`](../raw/2026-08-10-marchese-10x-claude.md) |
| **URL** | https://www.youtube.com/watch?v=Q-3fgVdmuVw |
| **Shots** | `Pictures/2026-08-10_16-54.png` (`/add-new-resource`), `…_16-54_1.png` (`/improve-system`) |

**Takeaways**

1. **6 steps:** lock AI stack → expand execution domains → **self-improving system** → pick vertical → **skill library** → niche command center.  
2. Self-improve = review work → propose → human gate → log (no silent thrash; no multi-GB history dumps).  
3. Skill library from **work already done** (archetypes), not speculative skills.  
4. Screenshots define two skills now in-repo: `/add-new-resource`, `/improve-system`.  
5. Complements prior Marchese 3-layer video (`marchese-karpathy-method.md`).

**Repo surfaces:** skills `add-new-resource`, `improve-system`; `AGENTS.md`; `knowledge/SCHEMA.md`; niche command center = this wiki + AGENTS.

---

## [2026-08-10] App UX thrash evidence (mute · location · stars)

| | |
|--|--|
| **Type** | Screenshot |
| **Raw** | [`../raw/2026-08-10-screenshot-mute-loc-stars.md`](../raw/2026-08-10-screenshot-mute-loc-stars.md) |
| **Path** | `/home/drakosik/Downloads/photo_2026-08-10_16-30-59.jpg` |
| **App** | 0.1.297 (video linked; chrome lagging) |

**Takeaways**

1. Location stuck on “Looking up location…” while video works.  
2. Partner ★ shows 0; self balance ★40 visible in gifts.  
3. Mute spam: multiple “They muted you” / “You muted” surfaces at once.  
4. Connect path OK (relay, q:low) — **UX chrome ≠ product.ok**; keep separate lanes.

**Repo surfaces:** `knowledge/specs/current-mobile-ux.md`, `wiki/mobile-ux.md`, LiveStatusBanners single-mute work.

### Log

- 2026-08-14: laptop 16:41 vs PC `224219Z` raw + catalog card (laptop 3-col sees PC cam live + self **No Cam Title**; PC Courtier black + giant mid poster; phone 1v1 Partner ★0; score `224230Z` one-way web 3641/3650 android **0/0**; **no MULTI_PASS**).
- 2026-08-14: after 3-col then black raw + catalog card (`223218Z` PC 3-col Laptop+Partner ★31 **black**; phone 1v1 no-cam toast Partner ★0; av-verify `223227Z` one-way web 767/774 android **0/0** bind_v=0; **no MULTI_PASS**).
- 2026-08-14: laptop vs PC Chrome 3-way raw + catalog card (`221232Z` PC 2-col vs laptop 3-col is **ROLE** not a different app; phone 1v1 Laptop ★31 black; **no MULTI_PASS**).
- 2026-08-14: phone plug measure raw + catalog card (USB **45141FDAP0004F** · APK **0.1.376/vc384** · residual 1498/2685 still tip · **measure in flight**; no linking GOAL_MET).
- 2026-08-14: linking-speed brainstorm raw + catalog card (residual 1498/2685 product.ok; no linking GOAL_MET; herd 20260814T021956Z).
- 2026-08-14: iPhone Safari crackle+delay raw + catalog card (unverified; herd 20260814T021357Z; no product.ok).
- 2026-08-12: F70b continuity reconfirm — multi SoftBlur device still OPEN / NOT claimed (F17–F70 keyguard; serial 43343 · 0.1.374-vc382); F70 BLOCKED COMPLETE @ ~10:16 MDT unchanged; CONN-idle F70b stamped; hop ~10:25 still before gate; F71 ≥ ~11:14 MDT (STOP · NOT promote F71); no invent multi PASS.
- 2026-08-12: F70 residual — multi SoftBlur device still OPEN / NOT claimed (F17–F70 keyguard BLOCKED COMPLETE @ ~10:16 MDT; serial 43343 · 0.1.374-vc382); raw F17–F70 dump filed; F71 ≥ ~11:14 MDT (STOP); no invent multi PASS.
- 2026-08-12: F69b continuity reconfirm — multi SoftBlur device still OPEN / NOT claimed (F17–F69 keyguard; serial 43343 · 0.1.374-vc382); F69 BLOCKED COMPLETE @ ~09:16 MDT unchanged; director ~09:35 still Dozing; F70 ≥ ~10:14 MDT (STOP); no invent multi PASS.
- 2026-08-12: F69 residual — multi SoftBlur device still OPEN / NOT claimed (F17–F69 keyguard BLOCKED COMPLETE @ ~09:16 MDT; serial 43343 · 0.1.374-vc382); raw F17–F69 dump filed; F70 ≥ ~10:14 MDT (STOP); no invent multi PASS.
- 2026-08-12: F68f continuity reconfirm — multi SoftBlur device still OPEN / NOT claimed (F17–F68 keyguard; serial 43343 · 0.1.374-vc382); still keyguard @09:05 probe; F69 unlock ≥ ~09:08 MDT (STOP); no invent multi PASS.
- 2026-08-12: F68e continuity reconfirm — multi SoftBlur device still OPEN / NOT claimed (F17–F68 keyguard; serial 43343 · 0.1.374-vc382); F69 unlock ≥ ~09:08 MDT; no invent multi PASS.
- 2026-08-12: F68d continuity reconfirm — multi SoftBlur device still OPEN / NOT claimed (F17–F68 keyguard; serial 43343 · 0.1.374-vc382); F69 unlock ≥ ~09:08 MDT; no invent multi PASS.
- 2026-08-12: F68c continuity reconfirm — multi SoftBlur device still OPEN / NOT claimed (F17–F68 keyguard; serial 43343 · 0.1.374-vc382); F69 unlock ≥ ~09:08 MDT; no invent multi PASS.
- 2026-08-12: multi SoftBlur keyguard F17–F68 raw dump + catalog card (F68b continuity; device still OPEN / NOT claimed).
- 2026-08-10: catalog started with Marchese 10× + UX evidence.
- 2026-08-10: dedicated raw sidecar `raw/2026-08-10-screenshot-mute-loc-stars.md` (was catalog-only).
