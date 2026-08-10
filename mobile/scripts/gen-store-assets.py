#!/usr/bin/env python3
"""Generate Expo + store icons from mobile/assets/icon-source.jpg (or ui/brand fallback).

Requires: Pillow, numpy
Usage:
  cp ~/Pictures/icon.jpg mobile/assets/icon-source.jpg
  python3 scripts/gen-store-assets.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "ui" / "brand"
OUT = ROOT / "mobile" / "assets"
STORE = OUT / "store"
BG = (7, 8, 12)


def load_source() -> Image.Image:
    for p in (
        OUT / "icon-source.jpg",
        OUT / "icon-source.png",
        BRAND / "icon-source-cylinder.jpg",
        BRAND / "icon-512.png",
    ):
        if p.exists():
            print("source:", p)
            return Image.open(p).convert("RGBA")
    raise FileNotFoundError(
        "No icon source. Copy your art to mobile/assets/icon-source.jpg"
    )


def content_bbox(im: Image.Image, thr: int = 12):
    import numpy as np

    a = np.array(im.convert("RGB"))
    mask = (a[:, :, 0] > thr) | (a[:, :, 1] > thr) | (a[:, :, 2] > thr)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return 0, 0, im.width, im.height
    pad = max(4, int(min(im.width, im.height) * 0.01))
    return (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(im.width, int(xs.max()) + 1 + pad),
        min(im.height, int(ys.max()) + 1 + pad),
    )


def square_icon(source: Image.Image, size: int, fill: float = 0.96, bg=BG) -> Image.Image:
    """Crop empty margins, scale so longest side fills `fill` of the square."""
    src = source.convert("RGBA")
    x0, y0, x1, y1 = content_bbox(src)
    logo = src.crop((x0, y0, x1, y1))
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    max_inner = max(1, int(size * fill))
    logo.thumbnail((max_inner, max_inner), Image.Resampling.LANCZOS)
    x = (size - logo.width) // 2
    y = (size - logo.height) // 2
    canvas.paste(logo, (x, y), logo)
    return canvas.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    STORE.mkdir(parents=True, exist_ok=True)
    src = load_source()

    # Play high-res + Expo icon — nearly full frame
    icon = square_icon(src, 1024, fill=0.98)
    icon.save(OUT / "icon.png", "PNG", optimize=True)
    icon.save(STORE / "app-icon-1024.png", "PNG", optimize=True)

    # Android adaptive FG (slightly more margin for circular masks)
    square_icon(src, 1024, fill=0.90).convert("RGBA").save(
        OUT / "adaptive-icon.png", "PNG", optimize=True
    )

    # Splash — smaller so it breathes on tall screens
    square_icon(src, 1024, fill=0.78).save(OUT / "splash-icon.png", "PNG", optimize=True)
    square_icon(src, 48, fill=0.96).save(OUT / "favicon.png", "PNG", optimize=True)
    square_icon(src, 180, fill=0.96).save(STORE / "apple-touch-180.png", "PNG", optimize=True)

    # Feature graphic 1024×500
    fg = Image.new("RGB", (1024, 500), BG)
    logo = square_icon(src, 300, fill=0.98).convert("RGBA")
    lx = (1024 - logo.width) // 2
    ly = (500 - logo.height) // 2 - 16
    canvas = fg.convert("RGBA")
    canvas.paste(logo, (lx, ly), logo)
    try:
        from PIL import ImageFont

        draw = ImageDraw.Draw(canvas)
        try:
            font = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40
            )
            font_sm = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20
            )
        except OSError:
            font = font_sm = ImageFont.load_default()
        for text, font_, dy, color in [
            ("ruletka", font, ly + logo.height + 6, (255, 255, 255, 255)),
            (
                "peer-to-peer video · 18+",
                font_sm,
                ly + logo.height + 50,
                (154, 168, 188, 255),
            ),
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
