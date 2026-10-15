# RESULT — 800-ios-app-store-runbook

## Status

Done — docs + listing pack written. No code, no build, no submission (human/Grok owns those).

## Files touched

- `docs/IOS_APP_STORE.md` (new) — EAS iOS production build steps, ASC App creation +
  `ascAppId` how-to, 17+ age rating questionnaire mapping, camera/mic usage strings
  (referenced, not edited), `ITSAppUsesNonExemptEncryption` guidance, App Review notes,
  TestFlight smoke matrix vs `ruletka.vip`, friends-only contingency.
- `mobile/assets/store/ios/LISTING.md` (new) — App name, subtitle, promotional text,
  keywords (char-counted, ≤100), description, what's new, support/marketing/privacy URLs,
  age-rating table, App Review notes. EN + RU.
- `mobile/.gitignore` — scoped the `ios/`/`android/` prebuild-output ignore rules to
  `/ios/`/`/android/` (repo root only). The unscoped rule was silently swallowing the new
  `mobile/assets/store/ios/` directory (`git check-ignore` confirmed it matched via the
  `ios/` rule at line 11 before the fix). Minimal 2-line fix so the new listing files are
  actually trackable; did not touch `app.json` or `eas.json`.

No spec file existed at `knowledge/specs/current-ios-app-store.md` (only
`knowledge/specs/2026-08-20-ru-reach.md` present in the repo) — followed the task's own
Done-list instead, cross-checked against `docs/STORE.md`, `docs/MOBILE.md`,
`docs/PLAY_UPLOAD.md`, `docs/DEVICE_SMOKE.md`, and the existing
`mobile/assets/store/LISTING-I18N.md` / `mobile/assets/store/rustore/` packs for
tone/structure/URL parity.

## Verify commands run

```bash
# URL parity check: new doc only adds URLs already present in STORE.md, no mismatches
diff <(grep -oE 'https://ruletka\.(vip|me)[a-zA-Z0-9/._-]*' docs/STORE.md | sort -u) \
     <(grep -oE 'https://ruletka\.(vip|me)[a-zA-Z0-9/._-]*' docs/IOS_APP_STORE.md | sort -u)

# Apple field-length checks (subtitle ≤30, keywords ≤100)
python3 -c "..."   # EN subtitle 28, EN keywords 90, RU subtitle 25, RU keywords 91

# Confirm no forbidden-file diffs came from this session
git diff --stat -- mobile/src/media/ mobile/app/live.tsx ui/webrtc.js ui/live.js \
  mobile/app.json mobile/eas.json
# (all changes to those paths pre-date this task — untouched by this session)

git status --short mobile/assets/store/ios/ docs/IOS_APP_STORE.md mobile/.gitignore
```

No MediaSession.ts / live.tsx / webrtc.js / live.js / app.json / eas.json edits were made by
this task (pre-existing dirty state from other lanes in the worktree, confirmed via
`git diff --stat` above showing no attribution to this session).

## Connect risk

**none** — docs-only change plus a `.gitignore` scoping fix. No touch to MediaSession, ICE,
TURN, offer/answer, or CONNECTIVITY_LOCK paths.

## Leftover human steps

1. Create the app in App Store Connect, copy the numeric Apple App ID.
2. Fill `submit.production.ios.ascAppId` in `mobile/eas.json` (currently
   `REPLACE_ASC_APP_ID`) — out of scope for this task, different lane.
3. `npx eas credentials --platform ios` (interactive Apple Developer login).
4. `npx eas build --profile production --platform ios`, then `eas submit`.
5. Paste listing copy from `mobile/assets/store/ios/LISTING.md` into App Store Connect.
6. Take/regenerate iOS-specific screenshots (6.7"/6.5" iPhone + iPad if `supportsTablet`
   stays on) — none exist yet, Play/RuStore shots are Android-only.
7. Complete the age rating questionnaire in ASC (mapping provided in
   `docs/IOS_APP_STORE.md` §4 / `LISTING.md` age-rating table) — expect **17+**.
8. Set export compliance answer for `ITSAppUsesNonExemptEncryption = false`; if EAS
   validation wants it explicit in `app.json`, flag to Grok/human (different lane).
9. TestFlight internal smoke per `docs/IOS_APP_STORE.md` §8 before requesting review.
10. If Apple rejects stranger roulette on first pass: `production-friends` profile
    contingency, documented in §9.

COMPLETE
