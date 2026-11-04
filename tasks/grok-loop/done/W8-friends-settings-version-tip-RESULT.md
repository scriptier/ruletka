# W8-friends-settings-version-tip — RESULT

**Status:** COMPLETE  
**OWN:** RESULT audit only (`mobile/app/settings.tsx` read; no code change)  
**Date:** 2026-08-11  
**Code change:** none  
**APK build:** none (card forbids)

## Goal
If Settings shows build/version, it matches **0.1.366 / vc374** (not a stale hard-coded **0.1.28x**).

## Verdict
**HONEST — dynamic, not hard-coded.** Version chip reads `Constants.expoConfig` at runtime; no stale string in source. With disk `app.json` **0.1.366 / versionCode 374**, the label is **`ruletka 0.1.366 (374)`** when Expo embeds that config into the binary.

| Source | versionName | versionCode | Notes |
|--------|-------------|-------------|-------|
| `mobile/app.json` `expo.version` | **0.1.366** | — | disk source of truth |
| `mobile/app.json` `expo.android.versionCode` | — | **374** | disk |
| `settings.tsx` `buildLabel()` | from `Constants.expoConfig?.version` | from `Constants.expoConfig?.android?.versionCode` | dynamic |
| Hard-coded `0.1.28x` / other `0.1.*` in settings | **none** | **none** | grep clean |

## Evidence

### 1. Grep (`mobile/app/settings.tsx`)
Matches for version display / expoConfig:
- L425–426: `Constants.expoConfig?.version`, `Constants.expoConfig?.android?.versionCode`
- L1579: `Constants.expoConfig?.extra` (EAS `projectId` in `__DEV__` only — not version)

No matches for:
- hard-coded `versionName` / `versionCode` literals
- `0.1.28x` or any other `0.1.*` string in this file

### 2. `buildLabel()` implementation
```ts
function buildLabel(): string {
  const ver = Constants.expoConfig?.version || "?";
  const vc = Constants.expoConfig?.android?.versionCode || "";
  return vc ? `ruletka ${ver} (${vc})` : `ruletka ${ver}`;
}
```

Import: `import Constants from "expo-constants";` (line 4).

### 3. UI surfaces using the same label
All version chips go through `buildLabel()`:
- Section subtitle (~L1429)
- Copy handlers (~L1529, L1542)
- `accessibilityLabel` (~L1557)
- Build meta `Text` body (~L1566)

No alternate hard-coded path.

### 4. `app.json` (expected embed for release builds)
```
version: 0.1.366
android.versionCode: 374
package: me.ruletka.app
```

Path: `/home/drakosik/freenet-roulette/mobile/app.json`

## Fix required?
**No.** Version is not hard-coded stale. OWN says fix only if hard-coded wrong → no edit to `settings.tsx`.

### Runtime caveat (not a source bug)
UI shows whatever Expo baked into `Constants.expoConfig` for that install. A device still running an old APK would display the old embed (e.g. 0.1.28x) until reinstalled — that is artifact honesty, not a Settings hard-code. Cross-check vs artifacts: W7 MATCH `ruletka-0.1.366-vc374.apk`.

## Not done (by design)
- No APK/AAB rebuild
- No `app.json` bump
- No device smoke / invent GOAL_MET
- No friends.tsx / deploy / push

## Files
- Read: `/home/drakosik/freenet-roulette/mobile/app/settings.tsx` (buildLabel + chip call sites)
- Read: `/home/drakosik/freenet-roulette/mobile/app.json` (0.1.366 / vc374)
- Card: `/home/drakosik/freenet-roulette/tasks/grok-loop/running/W8-friends-settings-version-tip.md` → done
- This RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/W8-friends-settings-version-tip-RESULT.md`

## COMPLETE
**PASS (audit)** — Settings version chip is dynamic via `Constants.expoConfig`; no hard-coded stale 0.1.28x. Disk config **0.1.366 / 374** → display **`ruletka 0.1.366 (374)`** on builds that embed current `app.json`. No code change. No APK.
