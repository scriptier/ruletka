# CLEAN: mid-match chrome verify RESULT

**Date:** 2026-08-12  
**Card:** `02-CLEAN-chrome-verify`  
**Status:** COMPLETE (read-only static disk verify)  
**OWN:** READ `ui/live.js` + `ui/live-stage.css` + `ui/live.html` pins — **no product edit**

## Goal

Confirm clean chrome CSS/JS on disk: no default ★ unlock bar, LIVE/water/volume hidden mid-match, easter egg dblclick wired.

## Pins (`ui/live.html`)

| Asset | Pin | Location |
|-------|-----|----------|
| `live-stage.css` | **`?v=390`** | L395 `<link rel="stylesheet">` |
| `live-brand.css` | `?v=13` | L396 (brand lane; not OWN of clean chrome) |
| `live.js` | **`?v=570`** | L397 preload + L3032 `<script defer>` |
| `i18n.js` | `?v=248` | L398 preload |

```html
<link rel="stylesheet" href="live-stage.css?v=390" />
<link rel="stylesheet" href="live-brand.css?v=13" />
<link rel="preload" href="live.js?v=570" as="script" />
…
<script src="live.js?v=570" defer></script>
```

## Selectors hidden mid-match (`html.match-live`)

Clean block: `ui/live-stage.css` L20919–20967 (`Clean mid-match chrome (2026-08-12)`).

| What | Selector(s) | Rule | OK |
|------|-------------|------|----|
| **LIVE** brand badge | `html.match-live .stage-top .badge`, `html.match-live .brand .badge` | `display: none !important` | ✓ |
| LIVE compact chip | `html.match-live #live-compact-chip` | `display: none !important` | ✓ |
| Arch / P2P pill noise | `html.match-live #arch-pill` | `display: none !important` | ✓ |
| **Water** (💧 blur) | `html.match-live .peer-blur-btn`, `#btn-blur-remote-main`, `#btn-blur-remote2`, `#btn-blur-remote-third`, `#btn-blur-remote` | `display/visibility none` + `pointer-events: none` | ✓ |
| **Volume** rail/tile | `html.match-live .side-vol`, `#remote-vol`, `.peer-vol-wrap`, `.peer-vol-inline` | same force-hide | ✓ |
| ★ unlock default | `#star-unlock-bar:not(.is-easter-egg)`, `#star-unlock-bar[hidden]` | `display: none !important` | ✓ |
| ★ unlock easter only | `#star-unlock-bar.is-easter-egg:not([hidden])` | `display: inline-flex !important` | ✓ |
| Peer conn chip noise | `html.match-live .peer-conn-chip` | `display: none !important` | ✓ |

Partner **mute** stays (not in hide list) — intentional per block comment.

### CSS quote

```css
/* Clean mid-match chrome (2026-08-12)
 * - Hide LIVE brand badge + arch noise while in call
 * - Remove water (tile blur 💧) + volume sliders from stage
 * - ★ unlock countdown is easter egg only (JS + .is-easter-egg)
 */
html.match-live .stage-top .badge,
html.match-live .brand .badge { display: none !important; }
html.match-live #live-compact-chip { display: none !important; }
html.match-live #arch-pill { display: none !important; }
html.match-live .peer-blur-btn,
html.match-live #btn-blur-remote-main,
html.match-live #btn-blur-remote2,
html.match-live #btn-blur-remote-third,
html.match-live #btn-blur-remote {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
html.match-live .side-vol,
html.match-live #remote-vol,
html.match-live .peer-vol-wrap,
html.match-live .peer-vol-inline {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
#star-unlock-bar:not(.is-easter-egg),
#star-unlock-bar[hidden] { display: none !important; }
#star-unlock-bar.is-easter-egg:not([hidden]) { display: inline-flex !important; }
```

## HTML stage presence (DOM still exists; CSS/JS gate)

| Element | Markup | Default |
|---------|--------|---------|
| LIVE badge text | L572 `class="badge" …>live</span>` | visible idle; CSS hide under `match-live` |
| `#arch-pill` | L594 | same |
| `#star-unlock-bar` | L843 `class="star-unlock-bar" id="star-unlock-bar" hidden` | **`hidden` attr** |
| Water 💧 | L853 `#btn-blur-remote-main`, L896 `#btn-blur-remote`, multi L660/L1040 | present; CSS hide mid-match |
| Volume | L854–857 `#vol-remote-wrap`, L890–895 `.side-vol` / `#remote-vol` | present; CSS hide mid-match |

## ★ easter egg path (`ui/live.js`)

| Step | Fn / site | Lines | Behavior |
|------|-----------|-------|----------|
| State | `starUnlockEasterEggUntil`, `starUnlockEasterEggTimer` | 7128–7129 | timed peek window |
| Hide | `hideStarUnlockBar()` | 7131–7137 | `hidden` + remove `is-ready` / `is-near` / **`is-easter-egg`** |
| Peek | `peekStarUnlockEasterEgg(ms=12000)` | 7139–7152 | sets until; auto-hide; status tip |
| Wire | `wireStarUnlockEasterEgg()` | 7155–7181 | **`dblclick`** on `#local-stars-badge` + `#remote-stars-badge`; second dblclick hides |
| Gate show | `syncStarUnlockBar(...)` | 7183–7221 | show **only if** `matched\|\|inFriendCall` **and** `secs >= 20` **and** `egg` (`Date.now() < starUnlockEasterEggUntil`); then add `is-easter-egg` |
| Progress tick | `maybeStarChatProgress` → `syncStarUnlockBar` | 7002–7038 | never forces bar without egg |
| Match start | `startMatchTimer` | 29861–29863 | `hideStarUnlockBar()` |
| Boot | module bottom | **34408** | **`wireStarUnlockEasterEgg()`** |

### Easter egg control flow

```
boot → wireStarUnlockEasterEgg()
         └─ dblclick local-stars-badge | remote-stars-badge
              ├─ if egg already open → hideStarUnlockBar()
              └─ else peekStarUnlockEasterEgg(14000)
                   └─ tickStarUnlockUi / updateMatchTimer
                        └─ maybeStarChatProgress → syncStarUnlockBar
                             ├─ !live || secs < 20 || !egg → hide
                             └─ else show + class is-easter-egg
```

### JS quote (gate)

```js
// Default: never show ★ countdown on stage (clean UI). Easter egg only.
if (!live || secs < 20 || !egg) {
  hideStarUnlockBar();
  return;
}
bar.hidden = false;
bar.removeAttribute("hidden");
bar.classList.add("is-easter-egg");
```

## Static checks summary

| Check | Result |
|-------|--------|
| Clean CSS block present | ✓ L20919–20967 stage.css |
| LIVE hidden mid-match | ✓ badge + compact chip + arch-pill |
| Water (blur 💧) hidden mid-match | ✓ peer-blur + btn-blur-* |
| Volume hidden mid-match | ✓ side-vol / remote-vol / peer-vol-* |
| ★ unlock default off | ✓ HTML `hidden` + CSS not `.is-easter-egg` + JS egg gate |
| dblclick easter egg wired | ✓ badges → `wireStarUnlockEasterEgg` @ boot L34408 |
| Pins | **live-stage.css?v=390**, **live.js?v=570** |
| Product edit this hop | **None** |
| Deploy | **None** |

## Verdict

**Static disk verify OK (code present).**  
On-disk PC stack has clean mid-match chrome: LIVE badge/arch noise, water blur controls, and volume sliders are force-hidden under `html.match-live`; ★ unlock bar stays hidden unless easter-egg class after dblclick on ★ badges. Pins: `live-stage.css?v=390`, `live.js?v=570`.

## Not claimed / not done

- **No browser / human mid-match smoke PASS** (no live pair screenshot)
- **No invent product PASS** for connect / multi / brand spin
- **No deploy**, no pin bump, no CSS/JS edit
- **No mobile** chrome audit (separate card `05-MOBILE-clean-chrome-static`)
- i18n keys `stars.unlockEasterEgg` / `stars.unlockEasterEggTip` may fall back to English literals (backlog `07-I18N-unlock-easter-egg`)

## Residual (human)

1. Hard-refresh live → Network: `live-stage.css?v=390`, `live.js?v=570`
2. Enter match (`html.match-live`): no LIVE badge, no 💧, no volume rail/tile; mute still available
3. Double-click local or partner ★ → unlock bar peeks ~14s with `.is-easter-egg`; dblclick again hides
