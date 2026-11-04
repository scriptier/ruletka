# BLUR-F7 default hold product — RESULT

## Status
**COMPLETE**

## OWN
- `mobile/src/prefs/store.ts` — `DEFAULTS.blurStrangersMode` + `normalizeBlurMode` fallbacks
- `mobile/src/prefs/blurMode.test.mjs` — keep pure normalizer in sync
- Optional en default labels: `mobile/src/i18n/overlay/en.json`
- Verify script expectation: `mobile/scripts/verify-match-ux.mjs`
- **Did not** touch SoftBlur Java, LiveStageVideo, live.tsx Modal chrome, APK, MediaSession

## Goal
Product policy: default blur mode **hold** (Until I tap) in mobile store/prefs.
Optional one-shot intro→hold migration only if documented pattern exists.

## Prior default
| Field | Before | After |
|-------|--------|-------|
| `DEFAULTS.blurStrangersMode` | `"intro"` | `"hold"` |
| `normalizeBlurMode` empty / unknown | `"intro"` | `"hold"` |
| Legacy `blurStrangers: true` (no mode string) | `"intro"` | `"hold"` |
| Explicit `"off"` / `"intro"` / `"hold"` in storage | unchanged | unchanged |

## Delivered

### store.ts
- Product default on disk: `blurStrangersMode: "hold"` (fresh install / missing prefs → hold).
- `normalizeBlurMode`: invalid/missing mode and legacy `true` → `hold` (aligned with DEFAULTS).
- **No new intro→hold one-shot migration.** Pattern exists (`BLUR_UX_INTRO_KEY` off→intro; `BLUR_CONNECT_FIX_KEY` hold→off after 0.1.214 forced-hold thrash). Mass-forcing hold again would re-risk veil-during-link / connect health. Existing installs keep their stored mode; only fresh / unmigrated-fallback paths get hold.
- Existing one-shots left intact:
  - connect-fix: first-load unstamped `hold` → `off` (legacy 0.1.214 undo)
  - blur-ux-intro-v2: unstamped `off` → `intro` (then stamp; Settings Off sticks)

### blurMode.test.mjs
Updated expected defaults to `hold`. Run: `node src/prefs/blurMode.test.mjs` → **OK**.

### en.json (optional default labels)
- `blurModeHold`: "Until I tap (default)"
- `blurModeOff`: "Off" (removed stale "(default)")
- `blurStrangersHint`: hold listed as default first
- Other locale packs left as-is (still may say Off is default — non-blocking copy drift).

### verify-match-ux.mjs
Static check now expects `blurStrangersMode: "hold"` in DEFAULTS.

## Verify
```
cd mobile && node src/prefs/blurMode.test.mjs   # OK
cd mobile && node scripts/verify-match-ux.mjs   # 30 ok, 0 fail (incl. default hold)
```

## Explicit non-claims
| Claim | Verdict |
|-------|---------|
| Device Hold product PASS (veil until tap on APK) | **NOT claimed** — no device smoke / F6 |
| SoftBlur native paints under hold | **NOT claimed** — F2 |
| LiveStageVideo / live.tsx hold UX chrome | **NOT claimed** — out of OWN |
| Existing intro users auto-migrated to hold | **NOT done** — intentional (connect thrash history) |
| Non-en i18n default labels updated | **NOT done** — en only |

## Files

| Path | Change |
|------|--------|
| `mobile/src/prefs/store.ts` | DEFAULTS + normalize → hold |
| `mobile/src/prefs/blurMode.test.mjs` | assert hold fallbacks |
| `mobile/src/i18n/overlay/en.json` | default labels for hold |
| `mobile/scripts/verify-match-ux.mjs` | static default check hold |
| `tasks/grok-loop/done/BLUR-F7-default-hold-RESULT.md` | this RESULT |
| Card | `running/` → `done/BLUR-F7-default-hold.md` |

## Connect risk
**Low for prefs-only.** Fresh installs start hold (veil until tap). No MediaSession / ICE / SoftBlur / APK. Did **not** reintroduce forced hold migration that previously slowed linking (0.1.214 → connect-fix).

## COMPLETE
**COMPLETE.** Default blur mode on disk is **hold**. Prior default **intro** documented. No APK. **No device Hold product PASS claimed.**
