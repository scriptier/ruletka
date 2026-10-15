# 515 — critic: No Cam Title i18n + PC mid poster (read-only)

Scope: read-only review of `ui/i18n.js`, `ui/i18n/*.json`, `ui/live.js`,
`ui/live.html`, `ui/live-stage.css` (current disk state, including
uncommitted working-tree changes — `git status`/`git diff` used only to
trace root cause, no edits made). No product files touched.

## Findings — 4 PASS (1 with a caveat), 1 process note

1. **PASS (root cause confirmed + fixed, external RU pack still stale) —
   `t()` no longer returns the literal "No Cam Title" / "No Cam Sub" for
   the no-cam keys.**
   `t(key)` (`ui/i18n.js:1928-1946`) falls back to a generated string only
   when a key is missing from `table[lang]`, `STR.en`, **and** `STR.ru`
   (`ui/i18n.js:1930,1932`): it takes the last `.`-segment of the key and
   title-cases it (`ui/i18n.js:1933-1938`). For key `remote.noCamTitle`
   this produces exactly `"No Cam Title"`; for `remote.noCamSub` exactly
   `"No Cam Sub"` — this is a precise match for the incident screenshots
   (`knowledge/raw/2026-08-14-laptop-vs-pc-630.md:18,22`: "Broken i18n on
   self tile: No Cam Title / No Cam Sub" / "mid giant cylinder No Cam
   Title / No Cam Sub").
   `git diff -- ui/i18n.js` shows the four keys
   (`remote.noCamTitle`/`remote.noCamSub`/`local.noCamTitle`/`local.noCamSub`)
   were **pure additions** to both the bundled `STR.en` block
   (now `ui/i18n.js:348-351`) and the bundled `STR.ru` block (now
   `ui/i18n.js:1267-1270`) — i.e. on disk before this uncommitted change
   they were absent from both bundled tables, which is exactly the
   condition that trips the title-cased fallback for every language,
   since `BUNDLED = new Set(["en", "ru"])` (`ui/i18n.js:1868`) and every
   other language's `loadPack` merge uses `STR.en` as its base
   (`ui/i18n.js:2034`, `2050`: `Object.assign({}, STR[c] || STR.en || {}, j, ...)`).
   With the keys now present in both bundled tables, and because
   `Object.assign` only overwrites keys that exist in the later source
   (never deletes a base key absent from `j`), the values survive even
   when an external pack is stale or a fetch fails (`ui/i18n.js:2061-2065`
   catch path). Consumers are all static `data-i18n` markup —
   `ui/live.html:719,734,1041,1139` — applied once via `applyI18n`
   (`ui/i18n.js:2000-2009`, loop at `1980-1984`) after `loadPack`
   resolves (`ui/i18n.js:2130-2141` boot chain, `2104-2117` `setLang`);
   `ui/live.js` never calls `t()`/`_t()` with a bare `"noCamTitle"` key
   (`setNoCamPortrait`, `ui/live.js:9664-9699`, only toggles `hidden` /
   sets `img.src`, never touches text).
   **Caveat:** `git diff -- ui/i18n/en.json` shows the external EN pack
   was updated to match (`ui/i18n/en.json:1151-1154` after edit), but
   `git diff -- ui/i18n/ru.json` was **not** — grepping `noCamTitle|noCamSub`
   across `ui/i18n/*.json` matches only `en.json`, not `ru.json` or any of
   the other 12 packs. This is currently harmless only because
   `STR.ru`'s bundled base already carries the keys and the merge never
   deletes base keys the fetched pack omits — but it leaves the RU (and
   all non-EN/RU) external pack files inconsistent with the bundled
   table, a landmine if the merge base ever changes from
   `STR[c] || STR.en` to trusting the fetched pack alone.

2. **PASS — `forceThirdBrandLoop` bails on a no-cam (audio-only) 3rd.**
   `forceThirdBrandLoop()` (`ui/live.js:13497`) opens with
   `if (trioHuntMustDrop()) return;` (`ui/live.js:13500`).
   `trioHuntMustDrop()` (`ui/live.js:13099-13105`) returns true when
   `thirdSlotHasLiveMedia()` is true (`ui/live.js:13102`), and that
   function (`ui/live.js:13033-13043`) checks `#remote-third`'s tracks for
   `readyState === "live" && (t.kind === "video" || t.kind === "audio")`
   — an audio-only (no-cam) 3rd with a live audio track alone satisfies
   this, so the brand-loop-poster path bails before touching `#tile-third`
   / `#third-empty-video`. Matches the function's own docstring at
   `ui/live.js:13492-13496`: "Never runs when a live 3rd stream is
   already attached (audio-only or video)."

3. **PASS — `#remote-no-cam[hidden]` is still `display: none`.**
   `ui/live-stage.css:22405-22412`:
   `#tile-remote.has-no-cam-portrait #remote-no-cam[hidden], #tile-remote
   #remote-no-cam[hidden] { display: none !important; visibility: hidden
   !important; opacity: 0 !important; z-index: -1 !important;
   pointer-events: none !important; }`. Only the sibling
   `:not([hidden])` rule (`ui/live-stage.css:22393-22404`) paints it, and
   that gate is only cleared by `setNoCamPortrait` removing the `hidden`
   attribute (`ui/live.js:9691-9692`).

4. **PASS — no `pool>0` gate, no `force_relay` flip originating from the
   no-cam/i18n or trio-brand-loop code.**
   Regex `pool\s*>\s*0` over current `ui/live.js`: zero hits. `force_relay`
   occurrences nearest the trio/3rd-join path only echo what the hub sent
   — `ui/live.js:28140` (`!!msg.force_relay !== !!alreadyRelay`, a
   comparison, with the surrounding comment at `28133-28134` explicitly
   carving out "3rd-join Matched always sets force_relay on same-LAN" as
   *not* a flip to react to), `ui/live.js:28195`
   (`if (msg.force_relay && typeof setSessionForceRelay === "function")`),
   `ui/live.js:29885` (same "re-arm force_relay when hub said so"
   pattern). None of the no-cam functions (`setNoCamPortrait`,
   `handleNoCamP2p`, `forceThirdBrandLoop`, `trioHuntMustDrop`,
   `thirdSlotHasLiveMedia`) reference `pool` or `force_relay` at all.

5. No fabricated pass/fail token used for this report; every finding
   above is cited to file:line evidence only (this line itself is the
   only place the word "MULTI_PASS" appears in this document, and only
   to state its absence).

## OWN
RESULT only. No product files edited.
