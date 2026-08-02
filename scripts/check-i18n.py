#!/usr/bin/env python3
"""Ensure ui/i18n packs share keys and placeholders with en.json."""
import json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
i18n = root / "ui" / "i18n"
en = json.loads((i18n / "en.json").read_text(encoding="utf-8"))
langs = ["ru", "de", "es", "fr", "pl", "pt", "tr", "uk", "zh"]
fail = 0
for lang in langs:
    path = i18n / f"{lang}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    missing = sorted(set(en) - set(data))
    extra = sorted(set(data) - set(en))
    bad_ph = []
    for k, v in en.items():
        if k not in data:
            continue
        pe = set(re.findall(r"\{(\w+)\}", str(v)))
        pl = set(re.findall(r"\{(\w+)\}", str(data[k])))
        if pe != pl:
            bad_ph.append(k)
    print(f"{lang}: keys={len(data)} missing={len(missing)} extra={len(extra)} bad_placeholders={len(bad_ph)}")
    if missing or bad_ph:
        fail += 1
        if missing[:5]:
            print("  missing sample", missing[:5])
        if bad_ph[:5]:
            print("  bad_ph sample", bad_ph[:5])
# mobile sync
mp = root / "mobile" / "src" / "i18n" / "packs" / "en.json"
if mp.exists():
    men = json.loads(mp.read_text(encoding="utf-8"))
    diff = len(set(en) ^ set(men))
    print(f"mobile packs en vs ui en: symmetric_diff={diff}")
    if diff:
        fail += 1
sys.exit(1 if fail else 0)
