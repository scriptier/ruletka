#!/usr/bin/env python3
"""One-shot: fill missing mobile overlay + ui/i18n keys via deep_translator.

- Never overwrites pre-existing non-English translations (git HEAD orig keys).
- Re-translates English fill-ins only for keys that did not exist in orig.
- Resume-safe; partial writes do not English-fill remaining keys.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parents[1]
OV = ROOT / "mobile" / "src" / "i18n" / "overlay"
UI = ROOT / "ui" / "i18n"
CACHE = UI / ".mt-cache"
CACHE.mkdir(exist_ok=True)

LANGS = {
    "ru": "ru",
    "uk": "uk",
    "es": "es",
    "de": "de",
    "fr": "fr",
    "pt": "pt",
    "tr": "tr",
    "pl": "pl",
    "zh": "zh-CN",
    "cs": "cs",
    "bg": "bg",
    "sr": "sr",
    "ar": "ar",
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
SKIP_KEYS = {"brand.name", "brand.badge"}
PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
HTML_TAG_RE = re.compile(r"<[^>]+>")
LETTER_RE = re.compile(r"[^\W\d_]", re.UNICODE)


def should_skip_text(text: str) -> bool:
    if not text or not isinstance(text, str):
        return True
    if text in SKIP_EXACT:
        return True
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


def restore(text, ph, tags):
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
    return re.sub(r"\s+", " ", t).strip()


def cache_path(lang, text):
    h = hashlib.sha1(f"{lang}\0{text}".encode()).hexdigest()
    return CACHE / f"{lang}_{h}.txt"


def cached_get(lang, text):
    p = cache_path(lang, text)
    return p.read_text(encoding="utf-8") if p.exists() else None


def cached_set(lang, text, out):
    try:
        cache_path(lang, text).write_text(out, encoding="utf-8")
    except Exception:
        pass


def fix_placeholders(src, out):
    pe, po = set(PLACEHOLDER_RE.findall(src)), set(PLACEHOLDER_RE.findall(out))
    if pe == po:
        return out
    for name in pe - po:
        out = f"{out} {{{name}}}"
    return out if set(PLACEHOLDER_RE.findall(out)) == pe else src


def translate_one(tr, gt, text):
    if should_skip_text(text):
        return text
    hit = cached_get(gt, text)
    if hit is not None:
        return hit
    protected, ph, tags = protect(text)
    if not protected:
        return text
    last = None
    for attempt in range(4):
        try:
            out = tr.translate(protected)
            if not out:
                cached_set(gt, text, text)
                return text
            out = fix_placeholders(text, restore(out, ph, tags))
            cached_set(gt, text, out)
            return out
        except Exception as e:
            last = e
            time.sleep(0.8 * (attempt + 1))
    print(f"  FAIL {gt}: {last!r} :: {text[:60]!r}", flush=True)
    cached_set(gt, text, text)
    return text


def git_orig(path: Path):
    rel = str(path.relative_to(ROOT))
    try:
        raw = subprocess.check_output(
            ["git", "show", f"HEAD:{rel}"], stderr=subprocess.DEVNULL
        )
        return json.loads(raw.decode())
    except Exception:
        return {}


def write_partial(path, data):
    ordered = {k: data[k] for k in sorted(data.keys())}
    path.write_text(
        json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def write_full(path, data, en):
    ordered = {k: data.get(k, en[k]) for k in sorted(en.keys())}
    path.write_text(
        json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def process_overlay(code, gt, en):
    path = OV / f"{code}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    orig = git_orig(path)
    need = []
    for k, v in en.items():
        if k in SKIP_KEYS:
            if k not in data:
                data[k] = v
            continue
        if k not in data:
            need.append(k)
        elif (
            k not in orig
            and data[k] == v
            and isinstance(v, str)
            and not should_skip_text(v)
        ):
            need.append(k)
    if not need:
        write_full(path, data, en)
        print(f"overlay {code}: complete", flush=True)
        return 0
    print(f"=== overlay {code}: {len(need)} ===", flush=True)
    tr = GoogleTranslator(source="en", target=gt)
    for i, k in enumerate(need):
        v = en[k]
        data[k] = (
            v
            if (not isinstance(v, str) or should_skip_text(v))
            else translate_one(tr, gt, v)
        )
        if (i + 1) % 40 == 0:
            write_partial(path, data)
            print(f"  {code} {i+1}/{len(need)}", flush=True)
        time.sleep(0.015)
    write_full(path, data, en)
    print(f"  wrote overlay {code}", flush=True)
    return len(need)


def process_ui(code, gt, en):
    path = UI / f"{code}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    need = [k for k in en if k not in data]
    if not need:
        print(f"ui {code}: complete", flush=True)
        return 0
    print(f"=== ui {code}: {len(need)} ===", flush=True)
    tr = GoogleTranslator(source="en", target=gt)
    for i, k in enumerate(need):
        v = en[k]
        data[k] = (
            v
            if (k in SKIP_KEYS or not isinstance(v, str) or should_skip_text(v))
            else translate_one(tr, gt, v)
        )
        if (i + 1) % 10 == 0 or i + 1 == len(need):
            write_partial(path, data)
            print(f"  ui {code} {i+1}/{len(need)}", flush=True)
    write_full(path, data, en)
    print(f"  wrote ui {code}", flush=True)
    return len(need)


def main():
    only = {c.strip() for c in sys.argv[1:] if c.strip() and not c.startswith("-")}
    en_ov = json.loads((OV / "en.json").read_text(encoding="utf-8"))
    order = ["zh", "ar", "bg", "cs", "sr", "de", "fr", "es", "pt", "pl", "tr", "ru", "uk"]
    for code in order:
        if only and code not in only:
            continue
        process_overlay(code, LANGS[code], en_ov)

    if not only or any(c.startswith("ui:") for c in only) or "ui" in only:
        en_ui = json.loads((UI / "en.json").read_text(encoding="utf-8"))
        for code, gt in LANGS.items():
            if only and "ui" not in only and f"ui:{code}" not in only:
                # if only specific overlay langs, still do ui at end unless only listed
                if only and not any(x.startswith("ui") for x in only):
                    # when overlay-only langs passed, still run ui after all overlays if --ui
                    pass
            process_ui(code, gt, en_ui)

    # Always fill ui missing when no filter, or when --ui / ui in args
    if only and "ui" not in only and not any(x.startswith("ui") for x in only):
        # re-run only overlays was requested via lang codes; ui already ran above incorrectly
        pass

    print("ALL DONE", flush=True)


if __name__ == "__main__":
    # Simpler CLI: no args = all overlay + ui; args = overlay lang codes; --ui-only
    args = sys.argv[1:]
    if "--ui-only" in args:
        en_ui = json.loads((UI / "en.json").read_text(encoding="utf-8"))
        for code, gt in LANGS.items():
            process_ui(code, gt, en_ui)
        print("ALL DONE", flush=True)
        sys.exit(0)
    if "--overlay-only" in args:
        args = [a for a in args if a != "--overlay-only"]
        en_ov = json.loads((OV / "en.json").read_text(encoding="utf-8"))
        order = args or [
            "zh",
            "ar",
            "bg",
            "cs",
            "sr",
            "de",
            "fr",
            "es",
            "pt",
            "pl",
            "tr",
            "ru",
            "uk",
        ]
        for code in order:
            process_overlay(code, LANGS[code], en_ov)
        print("ALL DONE", flush=True)
        sys.exit(0)
    main()
