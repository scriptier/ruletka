# 126 — i18n buildCopyHint multi-lang — RESULT

## Status
COMPLETE

## What changed
Added `mobile.settings.buildCopied` / `mobile.settings.buildCopyHint` translations to all overlay
languages that were missing them (only `en` and `ru` had them before). Placed immediately after
`mobile.settings.blurModeSaved` to match the en/ru insertion point.

- ar: "تم نسخ {build}" / "اضغط مطولًا لنسخ رقم الإصدار للدعم"
- bg: "Копирано {build}" / "Задръжте, за да копирате версията за поддръжка"
- cs: "Zkopírováno {build}" / "Podržte pro zkopírování verze pro podporu"
- de: "{build} kopiert" / "Lange drücken, um die Build-Nummer für den Support zu kopieren"
- es: "Copiado {build}" / "Mantén pulsado para copiar la versión para soporte"
- fr: "Copié {build}" / "Appui long pour copier la version pour le support"
- pl: "Skopiowano {build}" / "Przytrzymaj, aby skopiować wersję do wsparcia"
- pt: "Copiado {build}" / "Toque e segure para copiar a versão para o suporte"
- sr: "Копирано {build}" / "Држите да бисте копирали верзију за подршку"
- tr: "Kopyalandı {build}" / "Destek için sürümü kopyalamak üzere uzun basın"
- uk: "Скопійовано {build}" / "Натисніть і утримуйте, щоб скопіювати версію для підтримки"
- zh: "已复制 {build}" / "长按复制版本号以联系支持"

Note: another agent (Grok) was concurrently editing the same overlay files with much larger,
unrelated diffs (already present as pre-existing `M` in git status before this task started).
Per those overlapping edits, `tr`, `uk`, and `zh` already had these two keys added by the time I
reached them (different wording) — left as-is, untouched. `sr` briefly ended up with a duplicate
key pair from both edits landing at once; removed my duplicate and kept the single surviving pair.
No other files were touched.

## Files touched
- mobile/src/i18n/overlay/ar.json
- mobile/src/i18n/overlay/bg.json
- mobile/src/i18n/overlay/cs.json
- mobile/src/i18n/overlay/de.json
- mobile/src/i18n/overlay/es.json
- mobile/src/i18n/overlay/fr.json
- mobile/src/i18n/overlay/pl.json
- mobile/src/i18n/overlay/pt.json
- mobile/src/i18n/overlay/sr.json (dedup fix only)

## Verify commands run
- `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"` for all 14 overlay files — all valid JSON.
- `grep -c "mobile.settings.buildCopied\|mobile.settings.buildCopyHint"` on all 14 overlay files — each shows exactly 2 (both keys present once, no dupes).

## Connect risk
none — i18n string-only change, no code/logic/CONNECTIVITY_LOCK paths touched.

COMPLETE
