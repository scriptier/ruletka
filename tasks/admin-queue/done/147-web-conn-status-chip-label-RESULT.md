# 147 — Web conn-chip title i18n audit

## Status
COMPLETE

## Audit findings

- `#conn-chip` (main partner-tile connection chip, `ui/live.js:updateConnChip`): title is
  already fully localized via `_t("conn.chipTitle", { label, path })` with a translated
  `label`/`path` built from `conn.chip*` keys. No bug.
- `setPeerConnChip()` (`ui/live.js:11282`, drives the trio/2v2 peer chips
  `remote-peer-conn-chip`, `remote2-conn-chip`, `third-conn-chip`): `textContent` was already
  set from a localized `label` (`trio.connOk` / `trio.connConnecting` / `trio.connFailed` /
  `trio.connWeak`), but the `title` attribute was set to the **raw** `RTCPeerConnection`
  state string (`"connected"`, `"checking"`, `"completed"`, `"disconnected"`, `"failed"`,
  `"new"`) instead of the translated label — so hovering a peer chip showed untranslated
  browser jargon in every locale, including English-visible-but-wrong cases like
  `"completed"` instead of "Live". Fixed by reusing the already-computed localized `label`
  for `title` (same value already used for the chip's visible text), matching how every
  other `.title =` assignment in the file uses `_t(...)`.
- Static `title="Connection"` / `title="Connection quality"` / `title="This peer connection"`
  attributes in `ui/live.html` (lines 620, 812, 813, 1000) are inert: all four chips are
  `hidden` by default and their titles are fully overwritten by JS (`updateConnChip` /
  `setPeerConnChip`) before ever becoming visible, so these static strings are unreachable
  by users. Left as-is — no `data-i18n-title` wiring added, since that would require minting
  new translation keys across 14 locale files for text nobody ever sees, which is out of
  scope for a minimal fix.
- Separately noted (not fixed, out of scope): `trio.connOk` / `trio.connConnecting` /
  `trio.connFailed` / `trio.connWeak` keys don't exist in any locale file (`ui/i18n/*.json`),
  so those labels always fall back to hardcoded English regardless of language. This is a
  pre-existing gap in the *label* text itself (not the title), predating this task.

## Files touched
- `ui/live.js` — 1-line fix: `el.title = state;` → `el.title = label;` in `setPeerConnChip()`.

## Verify commands run
- `node --check ui/live.js` → OK

## Connect risk
none — cosmetic tooltip text only, no change to signaling/ICE/media logic.

COMPLETE
