# T5 joinPeers use log.partyCap i18n

## Goal
joinPeers hard-coded "max 3 opponents" → prefer _t("log.partyCap") when key exists.

## OWN
ui/live.js only — only the 2–3 log() strings in joinPeers cap paths. Minimal.

## Work
1. Grep max 3 opponents in joinPeers
2. Replace with _t("log.partyCap") || existing EN fallback
3. No deploy. RESULT COMPLETE.

## Must not
ICE thrash, multi layout thrash, invent PASS
