# 445 — Friends empty-state copy polish — RESULT

## Status
COMPLETE

## What changed
The empty Friends list already used i18n keys (no hardcoded strings in
`friends.tsx`), so this was a copy-only change to the `mobile.friends.empty`
body string in the two overlay locales requested (en + ru). Title
(`mobile.friends.emptyTitle`) and search-miss copy (`mobile.friends.searchEmpty`)
were reviewed and left as-is — already clear and not redundant.

Old body repeated the title ("No friends yet. Share your code or add
theirs.") right under a heading that already says "No friends yet", and
"add theirs" read awkwardly (add their *what*?). New copy drops the
repetition and points at the two concrete actions actually on screen (the
code hero above, and the add-code input in the header row):

- en: "Share your code above, or enter a friend's to add them."
- ru: "Поделитесь своим кодом выше или введите код друга, чтобы добавить его."

## Files touched
- mobile/src/i18n/overlay/en.json (`mobile.friends.empty`)
- mobile/src/i18n/overlay/ru.json (`mobile.friends.empty`)

## Verify commands run
- `node -e "JSON.parse(...)"` on both edited overlay files — valid JSON.

## Connect risk
none — i18n copy only, no touch to hub/ICE/MediaSession/live.tsx.

COMPLETE
