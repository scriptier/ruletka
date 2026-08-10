# Task: Web Connection short i18n keys in remaining locales

## Goal
Ensure `settings.connOptions`, `settings.connStatus`, `settings.hideIpHintShort`, `settings.preferDirectHintShort`, `settings.lowLatencyAudioHintShort` exist in **en.json + ru.json** (already) and add English-quality fallbacks into other `ui/i18n/*.json` packs so Connection panel labels never show camelCase fallbacks.

## Context
- PC Connection panel was rewritten with short hints.
- `t()` falls back to EN then ugly key parse.
- Source strings live in `ui/i18n/en.json` / `ru.json`.

## Scope (only these)
- `ui/i18n/*.json` (not en if complete; fill missing keys in other locales)
- Optional tiny note in RESULT

## Done criteria
- [ ] Every locale file includes the five short keys (translate if easy, else copy EN)
- [ ] No live.js / webrtc.js edits
- [ ] RESULT + **COMPLETE**

## Do not
- Deploy
- Redesign Connection HTML
- Touch mobile/

## Verify
```bash
python3 -c "import json,glob; keys=['settings.connOptions','settings.connStatus','settings.hideIpHintShort','settings.preferDirectHintShort','settings.lowLatencyAudioHintShort'];
import pathlib
for p in pathlib.Path('ui/i18n').glob('*.json'):
 d=json.loads(p.read_text()); miss=[k for k in keys if k not in d];
 print(p.name, 'OK' if not miss else miss)"
```
