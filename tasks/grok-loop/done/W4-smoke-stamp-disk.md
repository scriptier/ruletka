# W4 SMOKE-NEXT stamp align to disk

## Goal
`knowledge/specs/SMOKE-NEXT.md` ship tips match **actual** `ui/live.html` + `mobile/app.json` — no phantom 561 if html still 560; stage **385** if html says 385.

## OWN
- `knowledge/specs/SMOKE-NEXT.md` only

## Work
1. Read `ui/live.html` for live.js / webrtc / stage `?v=` truth.
2. Read `mobile/app.json` for versionName / versionCode.
3. Rewrite ship tip + all checklist version strings to match disk.
4. Keep all human smoke boxes **unchecked**; never invent PASS / GOAL_MET.
5. Note AAB still missing if true.

## Done criteria
- [ ] All version strings consistent with disk html + app.json
- [ ] RESULT + COMPLETE
- [ ] No invent multi/Friends/Settings PASS

## Must not
- Edit product code, deploy, APK
