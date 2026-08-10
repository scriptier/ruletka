# PC browser smoke checklist

**Goal:** Desktop Chrome / Firefox feel first-class next to Play.  
**Gate:** After any web deploy — hard-refresh once (`Ctrl+Shift+R`).

```bash
curl -sS https://ruletka.vip/deploy.json
./scripts/dev-smoke.sh --pair   # optional local web↔web
```

## Browsers

| Browser | OS | Pass? | Notes |
|---------|-----|-------|-------|
| Chrome (latest) | Linux / Win / Mac | | Primary |
| Firefox (latest) | Linux / Win / Mac | | Secondary |
| Safari | Mac only | | Optional; blur may use canvas path |
| Edge | Win | | Chromium-class |

## Core path (5 min)

| # | Check | Pass? |
|---|--------|-------|
| 1 | Age / rules accept → camera + mic permission | |
| 2 | Local preview paints (not black) | |
| 3 | Start → match with Play or second browser | |
| 4 | Both cams + audio &lt; ~5s same Wi‑Fi | |
| 5 | One offer + one answer (hub / CONNECT toast) | |
| 6 | Next once → second match still warm | |
| 7 | Stop leaves cleanly; Start again works | |

## Desktop chrome

| # | Check | Pass? |
|---|--------|-------|
| 8 | Wide window: stage + chat usable | |
| 9 | Resize to ~900px then full: no broken tiles | |
| 10 | Keyboard: mute / Next / blur shortcuts (if enabled) | |
| 11 | Fullscreen partner (F) enters/exits | |
| 12 | Browser PiP (if offered) does not kill call | |
| 13 | Settings → Hotkeys panel taller + scrolls (no clipped rows) | |

## Privacy / multi

| # | Check | Pass? |
|---|--------|-------|
| 14 | Partner blur / Unblur (desktop CSS blur OK) | |
| 15 | Self Hide (self-blur) — partner sees black/hidden | |
| 16 | Friend call ring + Accept | |
| 17 | Find 3rd → **horizontal** columns (not vertical bands) | |
| 18 | Gift mid-chat plays once | |

## Permissions / failure

| # | Check | Pass? |
|---|--------|-------|
| 19 | Deny camera → clear CTA, no infinite spin | |
| 20 | Block third-party cookies/storage → identity still works or clear recovery | |
| 21 | Tab unfocused friend call → OS notification (if opted in) | |

## After smoke

```bash
./scripts/smoke-connect.sh --hub-only
# Expect: 1 offer + 1 answer per match, android SLOW offers = 0
```

## Fail common causes

| Symptom | Check |
|---------|--------|
| Vertical multi bands again | Hard-refresh; layout mode stack = horizontal |
| Black partner | force_relay / TURN; same Wi‑Fi hairpin |
| Dual offer thrash | Hub android SLOW first-offers |
| No local preview | Permission / device in use by Zoom etc. |
