#!/usr/bin/env python3
"""Generate Expo + store icons from ui/brand/. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "ui" / "brand"
OUT = ROOT / "mobile" / "assets"
STORE = OUT / "store"
BG = (7, 8, 12)

def load(name: str) -> Image.Image:
    return Image.open(BRAND / name).convert("RGBA")

def square_icon(source: Image.Image, size: int, pad_ratio: float = 0.12, bg=BG) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    max_inner = int(size * (1 - 2 * pad_ratio))
    logo = source.copy()
    logo.thumbnail((max_inner, max_inner), Image.Resampling.LANCZOS)
    x = (size - logo.width) // 2
    y = (size - logo.height) // 2
    canvas.paste(logo, (x, y), logo)
    return canvas.convert("RGB")

def adaptive_foreground(source: Image.Image, size: int = 1024, safe: float = 0.72) -> Image.Image:
    base = Image.new("RGBA", (size, size), BG + (255,))
    max_inner = int(size * safe)
    logo = source.copy()
    logo.thumbnail((max_inner, max_inner), Image.Resampling.LANCZOS)
    x = (size - logo.width) // 2
    y = (size - logo.height) // 2
    base.paste(logo, (x, y), logo)
    return base

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    STORE.mkdir(parents=True, exist_ok=True)
    icon512 = load("icon-512.png")
    maskable = load("icon-maskable-512.png") if (BRAND / "icon-maskable-512.png").exists() else icon512

    icon = square_icon(icon512, 1024, pad_ratio=0.10)
    icon.save(OUT / "icon.png", "PNG", optimize=True)
    adaptive_foreground(maskable, 1024).save(OUT / "adaptive-icon.png", "PNG", optimize=True)
    square_icon(icon512, 1024, pad_ratio=0.22).save(OUT / "splash-icon.png", "PNG", optimize=True)
    square_icon(icon512, 48, pad_ratio=0.08).save(OUT / "favicon.png", "PNG", optimize=True)
    icon.save(STORE / "app-icon-1024.png", "PNG", optimize=True)
    square_icon(icon512, 180, pad_ratio=0.1).save(STORE / "apple-touch-180.png", "PNG", optimize=True)

    # Play feature 1024x500
    fg = Image.new("RGB", (1024, 500), BG)
    og_path = BRAND / "og-1200.jpg"
    if og_path.exists():
        og = Image.open(og_path).convert("RGB")
        tw, th = 1024, 500
        r = og.width / og.height
        tr = tw / th
        if r > tr:
            nh, nw = th, int(th * r)
        else:
            nw, nh = tw, int(tw / r)
        og = og.resize((nw, nh), Image.Resampling.LANCZOS)
        x, y = (nw - tw) // 2, (nh - th) // 2
        fg = og.crop((x, y, x + tw, y + th))
        overlay = Image.new("RGBA", fg.size, (0, 0, 0, 80))
        fg = Image.alpha_composite(fg.convert("RGBA"), overlay).convert("RGB")

    logo = icon512.copy()
    logo.thumbnail((280, 280), Image.Resampling.LANCZOS)
    lx = (1024 - logo.width) // 2
    ly = (500 - logo.height) // 2 - 20
    canvas = fg.convert("RGBA")
    canvas.paste(logo, (lx, ly), logo)
    try:
        from PIL import ImageFont
        draw = ImageDraw.Draw(canvas)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 42)
            font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
        except OSError:
            font = font_sm = ImageFont.load_default()
        for text, font_, dy, color in [
            ("ruletka", font, ly + logo.height + 8, (255, 255, 255, 255)),
            ("peer-to-peer video · 18+", font_sm, ly + logo.height + 56, (154, 168, 188, 255)),
        ]:
            bbox = draw.textbbox((0, 0), text, font=font_)
            tw = bbox[2] - bbox[0]
            draw.text(((1024 - tw) // 2, dy), text, fill=color, font=font_)
    except Exception:
        pass
    canvas.convert("RGB").save(STORE / "play-feature-1024x500.png", "PNG", optimize=True)
    print("Wrote icons to", OUT)
    print("Wrote store assets to", STORE)

if __name__ == "__main__":
    main()
