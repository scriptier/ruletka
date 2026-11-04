# W6 hunt caption i18n key audit — RESULT

## Status
**COMPLETE** (audit only; no en.json edit)

## Goal
PC+Android hunt captions resolve i18n (no raw keys on UI).

## OWN
- RESULT preferred
- en.json only if key missing: `mobile/src/i18n/packs/en.json` **OR** `ui/i18n/en.json` (one file)
- No full pack thrash / no deploy / no APK

## Work done

### 1. Grep: `trio.slotEmpty` / `lookingForThird` / captions

| Surface | Path | Wire |
|---------|------|------|
| **PC caption** | `ui/live.html` ~1028 | `data-i18n="trio.slotEmpty"` · default text `Looking for a 3rd…` on `#third-empty` / `.empty-title` |
| **PC packs** | `ui/i18n/*.json` | `trio.slotEmpty` + `trio.searching` present in all 14 locale packs |
| **PC fallback** | `ui/i18n.js` | Embedded EN + RU `trio.slotEmpty` |
| **Android layout flag** | `mobile/app/live.tsx` ~5655–5659 | `lookingForThird={!remote2/3 && remoteStream && (huntingWithPartner \|\| findThirdPending)}` |
| **Android label prop** | `mobile/app/live.tsx` ~5740–5743 | `labels.lookingForThird` = `t("trio.slotEmpty")` → `t("trio.searching")` → hardcode |
| **Android pane** | `mobile/src/live/LiveStageVideo.tsx` ~410–412, ~935–967 | `lookingLabel` from `L.lookingForThird`; `testID="live-looking-for-third"` + a11y |

### 2. Key presence (en.json)

| File | `trio.slotEmpty` | `trio.searching` |
|------|------------------|------------------|
| `ui/i18n/en.json` | **present** `"Looking for a 3rd…"` | **present** `"Looking for a 3rd together…"` |
| `mobile/src/i18n/packs/en.json` | **present** same | **present** same |

**No en.json edit** — keys already exist. Task forbids thrashing other locales.

### 3. Runtime resolution audit

| Client | Resolver | Result |
|--------|----------|--------|
| **PC** | `data-i18n` → `ui/i18n/{lang}.json` (+ `i18n.js` embedded) | **PASS** — caption resolves; no raw key |
| **Android** | `translate()` in `mobile/src/i18n/index.tsx` uses **overlay only** (`overlay[key] ?? enOverlay[key] ?? key`); packs are **not** loaded at runtime | **GAP** — see below |

#### Android overlay gap (documented, not fixed under OWN)

```
mobile/src/i18n/overlay/*.json  →  zero trio.* keys (all 14 langs)
t("trio.slotEmpty")             →  returns literal "trio.slotEmpty"
labels.lookingForThird pick     →  truthy raw key wins over hardcode
UI paint                        →  "trio.slotEmpty" on looking pane
```

Simulated EN pick (current wire, no miss-guard):

| Step | Value |
|------|-------|
| `t("trio.slotEmpty")` | `"trio.slotEmpty"` |
| `t("trio.searching")` | `"trio.searching"` |
| final label | **`"trio.slotEmpty"`** (raw key leak) |
| with miss-guard (v ≠ key) | would fall to `mobile.toast.findThirdAccepted` → `"Finding a 3rd together…"` or hardcode |

Note: P1-RESULT claimed overlay adds; W5-RESULT claimed miss-guard — **neither is present on disk now**.

OWN for this card allows only `packs/en.json` or `ui/i18n/en.json` if missing. Packs/UI EN already have keys; **adding them again would not fix Android runtime**. Overlay edit is out of OWN (and would be “full pack thrash” if done for all langs). No code change.

## Verdict

| Check | Result |
|-------|--------|
| EN keys in ui + mobile packs | **PASS** (no edit needed) |
| PC hunt caption i18n | **PASS** |
| Android `lookingForThird` uses trio keys in source | **PASS** (wire correct) |
| Android runtime no raw key | **FAIL / GAP** — overlay missing `trio.*`; no miss-guard |
| Full pack thrash | **Not done** (constraint) |
| Deploy / APK | **Not done** (constraint) |

## Follow-up (not this OWN)

1. Add `trio.slotEmpty` (+ optionally `trio.searching`) to **`mobile/src/i18n/overlay/en.json`** only, or all overlay langs (separate card).
2. Restore miss-guard in `live.tsx` labels pick: reject when `t(k) === k`.
3. Optional: re-verify P1 overlay write was never committed / was overwritten.

## Files touched
- **This RESULT only** — no en.json / overlay / live.tsx edits

## Connect risk
**None** — audit + documentation.

## COMPLETE
