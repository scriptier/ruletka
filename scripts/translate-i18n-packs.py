#!/usr/bin/env python3
"""Translate ui/i18n packs from en.json (Google via deep_translator).

Creates/updates: cs, bg, sr, ar
Fills English leftovers in: ru, uk, es, de, fr, pt, tr, pl, zh

Resume-safe (disk cache under ui/i18n/.mt-cache).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "ui" / "i18n"
CACHE = I18N / ".mt-cache"
CACHE.mkdir(exist_ok=True)

NEW = {"cs": "cs", "bg": "bg", "sr": "sr", "ar": "ar"}
EXISTING = ["ru", "uk", "es", "de", "fr", "pt", "tr", "pl", "zh"]
SKIP_KEYS = {
    "brand.name",
    "brand.badge",
    "home.openHubs",
    "home.openSourceJson",
    "home.openSrc",
}
SKIP_EXACT = {
    "ruletka.vip",
    "P2P",
    "TURN",
    "STUN",
    "WebRTC",
    "VPN",
    "OK",
    "IP",
    "A/V",
    "UI",
    "API",
    "GitHub",
    "★",
    "•",
    "Emoji",
    "JSON",
    "HTTP",
    "HTTPS",
    "WSS",
    "UDP",
    "TCP",
    "BTC",
    "ETH",
    "KYC",
    "QR",
    "iOS",
    "Android",
    "macOS",
    "Linux",
    "Windows",
    "HTML",
    "CSS",
    "JS",
    "hubs.json",
    "source.json",
}

PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
HTML_TAG_RE = re.compile(r"<[^>]+>")
# only letters (any script) count as "needs translation"
LETTER_RE = re.compile(r"[^\W\d_]", re.UNICODE)


def should_skip_text(text: str) -> bool:
    if not text or not isinstance(text, str):
        return True
    if text in SKIP_EXACT:
        return True
    # no letters → keep as-is (symbols, numbers, ★)
    if not LETTER_RE.search(text):
        return True
    return False


def protect(text: str):
    ph = []

    def sub_ph(m):
        ph.append(m.group(0))
        return f" __PH{len(ph) - 1}__ "

    t = PLACEHOLDER_RE.sub(sub_ph, text)
    tags = []

    def sub_tag(m):
        tags.append(m.group(0))
        return f" __TG{len(tags) - 1}__ "

    t = HTML_TAG_RE.sub(sub_tag, t)
    return re.sub(r"\s+", " ", t).strip(), ph, tags


def restore(text: str, ph, tags):
    if not text:
        return text
    t = text
    for i, p in enumerate(ph):
        for form in (
            f"__PH{i}__",
            f" __PH{i}__ ",
            f"PH{i}",
            f"{{PH{i}}}",
            f"[PH{i}]",
        ):
            t = t.replace(form, p)
    for i, tag in enumerate(tags):
        for form in (f"__TG{i}__", f" __TG{i}__ ", f"TG{i}", f"[TG{i}]"):
            t = t.replace(form, tag)
    t = re.sub(r"\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}", r"{\1}", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def cache_path(lang: str, text: str) -> Path:
    h = hashlib.sha1(f"{lang}\0{text}".encode("utf-8")).hexdigest()
    return CACHE / f"{lang}_{h}.txt"


def cached_get(lang, text):
    p = cache_path(lang, text)
    if p.exists():
        return p.read_text(encoding="utf-8")
    return None


def cached_set(lang, text, out):
    try:
        cache_path(lang, text).write_text(out, encoding="utf-8")
    except Exception:
        pass


def looks_english_prose(s: str) -> bool:
    if should_skip_text(s):
        return False
    letters = [c for c in s if c.isalpha()]
    if not letters:
        return False
    latin = sum(1 for c in letters if "a" <= c.lower() <= "z")
    return latin / len(letters) >= 0.7 and len(s) > 2


def fix_placeholders(src: str, out: str) -> str:
    pe = set(PLACEHOLDER_RE.findall(src))
    po = set(PLACEHOLDER_RE.findall(out))
    if pe == po:
        return out
    for name in pe - po:
        out = f"{out} {{{name}}}"
    if set(PLACEHOLDER_RE.findall(out)) == pe:
        return out
    return src


def translate_one(tr: GoogleTranslator, gt_code: str, text: str) -> str:
    if should_skip_text(text):
        return text
    hit = cached_get(gt_code, text)
    if hit is not None:
        return hit
    protected, ph, tags = protect(text)
    if not protected or should_skip_text(protected.replace("__", "")):
        # still try if has letters outside markers
        if not LETTER_RE.search(re.sub(r"__P?H?\d+__", "", protected)):
            return text
    last = None
    for attempt in range(3):
        try:
            out = tr.translate(protected)
            if not out:
                # untranslatable token — keep original
                cached_set(gt_code, text, text)
                return text
            out = restore(out, ph, tags)
            out = fix_placeholders(text, out)
            cached_set(gt_code, text, out)
            return out
        except Exception as e:
            last = e
            time.sleep(0.6 * (attempt + 1))
    print(f"  FAIL {gt_code}: {last!r} :: {text[:60]!r}", flush=True)
    return text


def write_pack(code: str, data: dict, en: dict):
    ordered = {k: data.get(k, en[k]) for k in sorted(en.keys())}
    path = I18N / f"{code}.json"
    path.write_text(
        json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return path


def need_for_new(code: str, en: dict):
    path = I18N / f"{code}.json"
    existing = {}
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            existing = {}
    base = {k: existing.get(k, en[k]) for k in en}
    need = []
    for k, v in en.items():
        if k in SKIP_KEYS:
            base[k] = v
            continue
        if not isinstance(v, str):
            base[k] = v
            continue
        if should_skip_text(v):
            base[k] = v
            continue
        cur = existing.get(k)
        if cur is None or (
            cur == v and looks_english_prose(v)
        ) or (isinstance(cur, str) and cur == v):
            # still english or missing
            if cur is None or cur == v:
                need.append(k)
    return base, need


def process_new(code: str, gt: str, en: dict):
    base, need = need_for_new(code, en)
    if not need:
        print(f"{code}: complete", flush=True)
        write_pack(code, base, en)
        return
    print(f"=== NEW {code}: {len(need)} remaining ===", flush=True)
    tr = GoogleTranslator(source="en", target=gt)
    for i, k in enumerate(need):
        base[k] = translate_one(tr, gt, en[k])
        if (i + 1) % 80 == 0 or i + 1 == len(need):
            write_pack(code, base, en)
            print(f"  {code} {i+1}/{len(need)}", flush=True)
        # light pacing; cache hits are free
        if cached_get(gt, en[k]) is None:
            time.sleep(0.03)
    write_pack(code, base, en)
    print(f"  wrote {code}.json", flush=True)


def process_fill(code: str, en: dict):
    path = I18N / f"{code}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    need = []
    for k, v in en.items():
        if k in SKIP_KEYS or not isinstance(v, str) or should_skip_text(v):
            if k in SKIP_KEYS:
                data[k] = v
            continue
        if k not in data or data[k] == v:
            if looks_english_prose(v) or k not in data:
                need.append(k)
    if not need:
        print(f"{code}: no leftovers", flush=True)
        write_pack(code, data, en)
        return
    gt = "zh-CN" if code == "zh" else code
    print(f"=== FILL {code}: {len(need)} leftovers ===", flush=True)
    tr = GoogleTranslator(source="en", target=gt)
    for i, k in enumerate(need):
        data[k] = translate_one(tr, gt, en[k])
        if (i + 1) % 60 == 0 or i + 1 == len(need):
            write_pack(code, data, en)
            print(f"  {code} fill {i+1}/{len(need)}", flush=True)
        if cached_get(gt, en[k]) is None:
            time.sleep(0.03)
    write_pack(code, data, en)
    print(f"  wrote {code}.json", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--fill-only", action="store_true")
    ap.add_argument("--new-only", action="store_true")
    ap.add_argument("--parallel", type=int, default=3)
    args = ap.parse_args()
    en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
    only = {c.strip() for c in args.only.split(",") if c.strip()}

    if not args.fill_only:
        jobs = [
            (c, g)
            for c, g in NEW.items()
            if not only or c in only
        ]
        workers = max(1, min(args.parallel, len(jobs) or 1))
        if workers == 1:
            for c, g in jobs:
                process_new(c, g, en)
        else:
            with ThreadPoolExecutor(max_workers=workers) as ex:
                futs = {ex.submit(process_new, c, g, en): c for c, g in jobs}
                for fut in as_completed(futs):
                    c = futs[fut]
                    try:
                        fut.result()
                    except Exception as e:
                        print(f"FAIL {c}: {e!r}", flush=True)
                        raise

    if not args.new_only:
        for code in EXISTING:
            if only and code not in only:
                continue
            process_fill(code, en)

    print("DONE", flush=True)


if __name__ == "__main__":
    main()
