# T4-apk-rebuild-note-trio-overlay — RESULT

**Status:** COMPLETE  
**OWN:** RESULT-only under `tasks/grok-loop/done/` (inventory / operator note — **no APK build**)  
**Date:** 2026-08-12  
**Code change:** none  
**APK build:** **none** (card forbids unless human proceed; human has not said proceed)

## Goal
Document that the **W8 mobile trio overlay fix** needs a **new Android APK** before find-3rd hunt caption can show fixed copy on phone. Current ship binary is still **pre-fix 0.1.366-vc374**.

## Verdict

| Item | State |
|------|--------|
| W8 source fix on disk | **Yes** — overlay EN keys present |
| Baked into ship APK | **No** — artifact still `ruletka-0.1.366-vc374.apk` |
| Phone until rebuild | Runs **pre-fix** bundle (raw `trio.*` risk if keys missing in that build) |
| This task builds APK? | **No** — needs **human proceed** |
| Multi / device smoke PASS invented? | **No** |

**State for ops:** **needs human proceed for APK.** Agents must not rebuild until human says so (e.g. “build apk”, “bump apk”, “sideload build”).

## What W8 already fixed (source only)

Upstream card: `tasks/grok-loop/done/W8-mobile-trio-overlay-RESULT.md`.

| Surface | Fix | Role |
|---------|-----|------|
| `mobile/src/i18n/overlay/en.json` | `trio.slotEmpty` → `Looking for a 3rd…`; `trio.searching` → `Looking for a 3rd together…` | Runtime `t()` is **overlay-only** (packs not loaded) |
| `mobile/app/live.tsx` (`labels.lookingForThird`) | Prefer `t("trio.slotEmpty")` / `t("trio.searching")` with hardcode fallback `"Looking for a 3rd…"` | Hunt caption must not stay blank; with keys present resolves to English copy |

Root cause (W8): packs already had `trio.*` but `translate()` only reads overlay → raw key painted when overlay lacked keys.

## Why phone is still pre-fix

| Source | versionName | versionCode | mtime (local) | Notes |
|--------|-------------|-------------|---------------|--------|
| `mobile/app.json` | **0.1.366** | **374** | (dirty vs git) | Same tip as last artifact; **not** bumped for W8 |
| Ship APK | **0.1.366** | **374** | **2026-08-11 19:49** | `mobile/artifacts/ruletka-0.1.366-vc374.apk` |
| `overlay/en.json` (W8 keys) | — | — | **2026-08-11 20:16** | **After** APK mtime → keys **not** in that binary |
| `live.tsx` | — | — | 2026-08-11 19:36 | Dirty working tree; caption path still needs rebuild to ship |

Latest pointers:

- `mobile/artifacts/ruletka-android-latest.apk` → `ruletka-0.1.366-vc374.apk`
- `mobile/artifacts/ruletka-latest.apk` — same content as versioned APK

**Conclusion:** Installing/sideloading current “latest” APK does **not** deliver the W8 overlay fix. Phone remains on **0.1.366-vc374 without** the post-build `en.json` trio keys until a new APK is built from current `mobile/` tree.

## What human must do (when ready)

Per `docs/MOBILE_BUILD.md` — **human-triggered only**:

```bash
cd /home/drakosik/freenet-roulette/mobile
./scripts/build-apk-local.sh           # same versionCode refresh (repack current source)
# or, if shipping a new tip:
./scripts/build-apk-local.sh --bump    # patch version + versionCode
```

Optional after build:

```bash
./scripts/push-apk-to-phone.sh --install   # adb install -r when device present
```

### Suggested post-rebuild human check (not agent PASS)

1. Settings / about shows new version (or at least install time after W8).  
2. Start match → find 3rd / party hunt caption shows **“Looking for a 3rd…”** (not raw `trio.slotEmpty`).  
3. Do **not** invent multi GOAL_MET from this note alone.

## Explicit non-actions this hop

- Did **not** run `build-apk-local.sh` / Gradle / EAS  
- Did **not** bump `app.json` version / versionCode  
- Did **not** adb install / push to phone  
- Did **not** deploy web (`push.sh`)  
- Did **not** invent multi smoke PASS / product GOAL_MET  
- Did **not** thrash MediaSession / ICE / pool

## Connect risk

**None** — documentation only. Next APK is packaging-only for i18n caption path (no WebRTC policy change required for this fix).

## Files

| Path | Role |
|------|------|
| Read: `mobile/app.json` | 0.1.366 / vc374 |
| Read: `mobile/src/i18n/overlay/en.json` | W8 trio keys on disk |
| Read: `mobile/app/live.tsx` | lookingForThird labels |
| Read: `mobile/artifacts/ruletka-0.1.366-vc374.apk` (+ latest) | Pre-fix ship binary |
| Prior: `tasks/grok-loop/done/W8-mobile-trio-overlay-RESULT.md` | Source fix evidence |
| Card: `tasks/grok-loop/running/T4-apk-rebuild-note-trio-overlay.md` → done |
| This RESULT: `tasks/grok-loop/done/T4-apk-rebuild-note-trio-overlay-RESULT.md` |

## COMPLETE

**RESULT written.** Trio overlay fix is **source-complete (W8)**; **phone still pre-fix 0.1.366-vc374 until human rebuilds APK.** **Did not build.**
