# BLUR-F10 re-enable SoftBlur product switch — RESULT

## Status
**COMPLETE** (product flag flip + comments only)

## Gate
| Check | Result |
|-------|--------|
| Multi SoftBlur device PASS | **NOT claimed** — F9 static only; F11 owns APK re-smoke |
| LiveStageVideo / F2 Java / adb | **not touched** |
| Force-push / MediaSession thrash | none |

## OWN
- `mobile/src/live/SoftBlurRemote.tsx` (flag + comments only)
- Optional: `node mobile/scripts/verify-match-ux.mjs` → **31 ok, 0 fail**
- RESULT: this file
- Card: `running/BLUR-F10-soft-enable.md` → `done/`

## Context (F9)
F9 static residual: multi-tile SoftBlur **wiring present** after F4, but `SOFT_BLUR_PRODUCT_ENABLED = false` forced `isSoftBlurNativeAvailable()` always false → PartnerBlurVeil-only on privacy despite F2–F5 ship + F6/F8 device softNative evidence on APK **0.1.368-vc376**.

## Delivered

### Flag
```ts
export const SOFT_BLUR_PRODUCT_ENABLED = true;
```

### Comments (honest)
- Product **ON** (BLUR-F10)
- SoftBlurRemote when native registered; **PartnerBlurVeil fallback** when native missing / not Android / empty streamURL
- Rationale: F6 Hold + F8 Intro agent evidence (`softNative=1`, Sink attached) on 0.1.368
- Multi SoftBlur still **not** device-proven; F11 owns APK re-smoke

### `isSoftBlurNativeAvailable()`
Unchanged logic: product flag → Android → native manager config. Product gate no longer hard-kills soft path.

## Verify
| Check | Result |
|-------|--------|
| `SOFT_BLUR_PRODUCT_ENABLED === true` on disk | **yes** |
| `verify-match-ux.mjs` | **31 ok, 0 fail** |
| LiveStageVideo rewrite | none |
| F2 Java | none |
| adb / APK | none (F11) |

## Explicit non-claims
| Claim | Verdict |
|-------|---------|
| Multi SoftBlur product / device PASS | **NOT claimed** |
| Off/Intro/Hold re-smoke on post-flip APK | **NOT claimed** — F11 |
| SoftBlur paints on current tip APK without rebuild | **NOT claimed** — needs APK with flag + native |
| GOAL_MET / MULTI_PASS | **NOT claimed** |

## Files

| Path | Change |
|------|--------|
| `mobile/src/live/SoftBlurRemote.tsx` | `SOFT_BLUR_PRODUCT_ENABLED = true` + product ON comments (F6/F8 rationale; veil fallback; multi not proven) |
| `tasks/grok-loop/done/BLUR-F10-soft-enable-RESULT.md` | this RESULT |
| Card | `running/` → `done/BLUR-F10-soft-enable.md` |

## Connect risk
**None** — no MediaSession / ICE / LiveStageVideo / SoftBlur Java. Flag only gates RN soft path selection.

## Merge advice
- Safe with F11 (APK re-smoke consumes this flag)
- Safe with BM8 plan stamp (product ON residual)
- LiveStageVideo still has a stale comment "soft SoftBlur path OFF" near softBlurNative — cosmetic only; runtime uses `isSoftBlurNativeAvailable()` (not in F10 OWN)

## COMPLETE
**COMPLETE.** Product soft-blur switch re-enabled (`true`). Veil remains native-missing fallback. F6/F8 1v1 agent evidence cited; multi SoftBlur not invented; F11 owns device re-smoke.
