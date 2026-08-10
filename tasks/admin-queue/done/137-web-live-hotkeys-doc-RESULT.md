# Task 137: Web hotkeys note audit — RESULT

## Status
COMPLETE

## Audit
Compared the two places that document keyboard shortcuts on the web live page against
the actual `keydown` handler in `ui/live.js` (~line 30972):

- `#keys-help` — the quick popup opened by pressing `?` (`ui/live.html` ~line 1200)
- `#settings-view-hotkeys` — the full Settings → Hotkeys page (`ui/live.html` ~line 2381)

Finding: the code binds `Shift+B` to `toggleSelfBlur()` (an alternate for "Hide yourself",
same action as `H`). The Settings → Hotkeys page already documented this
(`keys.hideAlt` row), but the `?` popup did not — it was missing the `Shift+B` row, so the
two notes had drifted out of sync. Everything else (Space/Next, S/Stop, swipe-to-skip note,
M/C/P/B/H/F, `?`/Esc) matched the handler and matched each other.

## Fix
Added the missing `Shift+B` row to the `#keys-help` popup list in `ui/live.html`, reusing
the existing `keys.hideAlt` translation key (already defined in all 14 locale files and
already used by the Settings page) — no new strings added.

```html
<li><kbd>Shift</kbd>+<kbd>B</kbd> <span data-i18n="keys.hideAlt">Hide yourself (alternate)</span></li>
```

## Files touched
- `ui/live.html` (1 line added, in the `#keys-help` popup markup)

## Verify commands run
- `python3 scripts/check-i18n.py` — no missing/extra `keys.*` keys in any locale (pre-existing
  gaps reported are unrelated: `connLastLink`, `connOptions`, etc.)
- Manual diff review of `ui/live.js` `keydown` handler vs. both hotkey notes — now consistent.

## Connect risk
none — docs/UI text only, no changes to `ui/webrtc.js`, `ui/geoLocalize.js`, MediaSession,
or any connectivity/offer/ICE/TURN code.

COMPLETE
