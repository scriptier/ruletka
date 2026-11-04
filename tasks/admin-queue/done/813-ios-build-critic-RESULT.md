# RESULT — 813-ios-build-critic

## Status

Second critic pass, read-only. **Close but not clean** — one process blocker (worktree
harvest) plus one genuine, unavoidable human step (Apple credentials). No spec file exists
at `knowledge/specs/current-ios-app-store.md` (same gap 800/801/803 already noted) —
critiqued against the task's own Done list, `docs/IOS_APP_STORE.md`, `mobile/eas.json`,
`mobile/app.json`/`app.config.js`, and `802-ios-audio-push-gaps-RESULT.md`.

## Verdict: what's actually blocking "human taps eas build"

### 1. Blocker — the fixes below only exist in this Claude worktree, not on the tree a human would build from

`git show HEAD:mobile/eas.json` (commit `23394c6`, current `main`) still has
`submit.production.ios.ascAppId = "REPLACE_ASC_APP_ID"`. The correct value (`6804910924`)
only exists as an **uncommitted** change in this worktree's `mobile/eas.json`, alongside
several other uncommitted iOS fixes (see §2). Per this repo's factory model, this Claude
worktree's diff has to be harvested into the tree Grok/human actually builds from before
"tap eas build" is true there. Today, on `main`, a build would still resolve the placeholder
ascAppId (breaks `eas submit`, not `eas build` itself, but is the first thing on the
checklist).

### 2. Not a blocker — three prior-critic (803) gaps are now fixed in this worktree

All uncommitted, all present:
- `mobile/eas.json`: `ascAppId` = `6804910924` (real value, not placeholder). ✅
- `mobile/app.json`: `ios.bundleIdentifier` = `me.ruletka.app` ✅, camera/mic usage strings
  present with real justification text ✅.
- `mobile/app.config.js`: `ITSAppUsesNonExemptEncryption: false`,
  `config.usesNonExemptEncryption: false`, `UIBackgroundModes: []`, `privacyManifests`
  all present (confirmed by reading the file directly, not just grep).
- `mobile/.gitignore`: lines 11–12 now `/ios/` `/android/` (root-scoped) — no longer
  swallows `mobile/assets/store/ios/`.
- `mobile/assets/store/ios/LISTING.md` now exists (EN + partial RU) — 803's finding #1
  resolved. **`WHAT-TO-TEST.md` still does not exist** — `docs/IOS_APP_STORE.md` §1
  references it but only `LISTING.md` is present in `mobile/assets/store/ios/`.

### 3. Not a blocker for `eas build`, but real and unavoidable — Apple credentials

First iOS build has no Distribution Certificate / Provisioning Profile yet (confirmed no
`ios/` native project or credentials cache in this tree). `npx eas-cli whoami` succeeds
(logged in as `courtier` / `yanesplu@gmail.com`, same account as Android), so the Expo side
is ready — but `eas build --profile production --platform ios` will still stop for an
interactive `eas credentials --platform ios` prompt requiring Apple Developer Program
login + 2FA. This is human-only by design (task's own "Must not" and `IOS_APP_STORE.md`
agree) and cannot be pre-cleared by an agent.

### 4. Not a build blocker — still-open submission blockers from 803 (relevant later, not today)

Re-checked, still unresolved:
- No App Store Connect "App Privacy" (nutrition-label) data-type doc/mapping exists anywhere
  (`grep -in "app privacy|nutrition|data type|tracking" docs/IOS_APP_STORE.md` → no output).
- Delete-my-data is still web-link-only (`mobile/app/settings.tsx:1631` →
  `${hubBase()}/legal/delete.html`), no in-app deletion flow — Guideline 5.1.1(v) risk.
- No iOS-specific screenshots exist (only `LISTING.md` in `mobile/assets/store/ios/`).

These block `eas submit` / App Store review, **not** `eas build` — don't gate the first
build on them.

### 5. Informational, not a blocker — pre-existing bug found via `tsc --noEmit`, not iOS-specific

`cd mobile && npx tsc --noEmit` still has pre-existing errors, consistent with what
`802-ios-audio-push-gaps-RESULT.md` already disclosed (zero new errors from its 4 OWN
files). Two categories:
- Most errors (`expo-clipboard`, `expo-av`, `expo-image-manipulator`,
  `react-native-gesture-handler`, `react-native-reanimated` "Cannot find module") are this
  worktree's local `node_modules` being incomplete, not real code errors — all five are
  correctly listed in `mobile/package.json`, and `npm install --package-lock-only --dry-run`
  reports the lockfile already in sync ("up to date"). EAS cloud build does a fresh
  `npm install`, so this doesn't reproduce there.
- `app/live.tsx:7403,7408` — genuine bug, not a module-resolution artifact: bare
  `media2`/`media3` identifiers used inside the gift-effect data-channel send path, but only
  `media2Ref`/`media3Ref` exist in that scope (used correctly a few lines above at
  `media2Ref.current`). This throws `ReferenceError` at runtime, but it's wrapped in its own
  `try {} catch { /* ignore */ }`, so it silently no-ops that leg of the gift-fx broadcast
  rather than crashing. Same on Android — not iOS-specific, doesn't block `eas build`
  (Metro/Babel don't type-check). Flagging because it's a real latent bug in a file outside
  this task's Read scope (`live.tsx`) — did not touch it, per "Must not: edit code."

### 6. Minor, local-only — Node version mismatch

`mobile/package.json` `engines.node` requires `>=20`; this shell's local node is `v18.19.1`
(EBADENGINE warnings on `npm install`). Irrelevant to EAS cloud builds (they provision their
own Node), only matters if a human runs `eas` CLI commands from this same local shell.

## Files touched

None — read-only critic, per task scope (`OWN: none`). This RESULT file only.

## Verify commands run

```bash
git show HEAD:mobile/eas.json | grep -A3 '"ios"'          # ascAppId still REPLACE_ASC_APP_ID at HEAD
grep -n "ascAppId" mobile/eas.json                          # worktree has real value 6804910924
grep -n "bundleIdentifier" mobile/app.json mobile/app.config.js
cat mobile/app.config.js                                    # ITSAppUsesNonExemptEncryption/privacyManifests/UIBackgroundModes present
sed -n '1,20p' mobile/.gitignore                             # /ios/ /android/ now root-scoped
find mobile/assets/store/ios -type f                         # LISTING.md only, no WHAT-TO-TEST.md
cd mobile && npx eas-cli whoami                               # courtier / yanesplu@gmail.com, logged in
cd mobile && npm install --package-lock-only --dry-run        # "up to date", lockfile in sync
cd mobile && npx tsc --noEmit                                  # pre-existing errors, see §5
grep -n "media2\|media3" mobile/app/live.tsx | sed -n '1,20p'  # confirms media2Ref/media3Ref defined, bare media2/media3 used at 7403/7408
grep -n "delete" mobile/app/settings.tsx | head -10             # still web-link-only
grep -in "app privacy|nutrition|data type|tracking" docs/IOS_APP_STORE.md  # no output, still missing
git log --oneline -5 -- mobile/eas.json mobile/app.json mobile/app.config.js mobile/.gitignore mobile/assets/store/ios/
```

## Connect risk

**none** — read-only review, no edits to any file, no MediaSession/live.tsx/webrtc/ICE/
CONNECTIVITY_LOCK changes, no `eas build`, no deploy.

## Bottom line

Once this worktree's `mobile/` diff is harvested into the tree the human builds from, the
answer is **yes, human can tap `eas build --profile production --platform ios`** — expect it
to pause once for the interactive `eas credentials --platform ios` Apple login/2FA on first
run (unavoidable, human-only). Do not gate the *build* on the App Privacy label / in-app
delete / screenshots gaps — those only block `eas submit` / App Store review, which is a
separate, later step.

COMPLETE (critic)
