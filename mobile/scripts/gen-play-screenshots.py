#!/usr/bin/env python3
"""
Generate simple phone-frame marketing stills for Play Console.
Not a device capture — flat mockups of Home quiet/busy + Live search chips.

Usage:
  python3 scripts/gen-play-screenshots.py
  → assets/store/screenshots/phone-07-home-quiet.png
  → assets/store/screenshots/phone-08-home-busy.png
  → assets/store/screenshots/phone-09-live-steps.png
"""
from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as e:
    raise SystemExit("Need Pillow: pip install Pillow") from e

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "store" / "screenshots"
W, H = 1080, 1920
BG = (7, 8, 12)
CARD = (20, 28, 42)
TEXT = (232, 238, 247)
MUTED = (154, 168, 188)
PINK = (255, 45, 85)
BLUE = (61, 126, 255)
GREEN = (45, 159, 111)


def font(size: int, bold: bool = False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in candidates:
        if Path(p).is_file():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def rounded(draw: ImageDraw.ImageDraw, xy, r, fill, outline=None):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline)


def base() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    # status bar fake
    d.rectangle((0, 0, W, 64), fill=(10, 12, 18))
    d.text((40, 18), "9:41", fill=MUTED, font=font(28))
    return im, d


def home_quiet():
    im, d = base()
    d.text((48, 120), "ruletka", fill=TEXT, font=font(64, True))
    d.text((48, 210), "Peer-to-peer video · 18+", fill=MUTED, font=font(28))
    d.ellipse((48, 290, 72, 314), fill=(61, 255, 160))
    d.text((90, 286), "Hub online · ★3 · 2 online · 0 waiting", fill=MUTED, font=font(26))
    # invite card
    rounded(d, (48, 380, W - 48, 780), 28, (16, 32, 56), outline=(80, 140, 220))
    d.text((80, 420), "Pool is quiet — invite a friend", fill=(200, 220, 255), font=font(34, True))
    d.text((80, 490), "Share your code. When they Accept,", fill=MUTED, font=font(26))
    d.text((80, 530), "you can Call — faster than waiting alone.", fill=MUTED, font=font(26))
    d.text((80, 600), "Your code  AB12CD", fill=(255, 233, 160), font=font(36, True))
    rounded(d, (80, 680, 360, 740), 999, (30, 40, 55), outline=(80, 90, 110))
    d.text((130, 694), "Copy code", fill=TEXT, font=font(26, True))
    rounded(d, (390, 680, 700, 740), 999, BLUE)
    d.text((450, 694), "Share invite", fill=(255, 255, 255), font=font(26, True))
    # Start CTA
    rounded(d, (48, 860, W - 48, 980), 999, PINK)
    d.text((W // 2 - 160, 900), "Start chatting", fill=(255, 255, 255), font=font(36, True))
    im.save(OUT / "phone-07-home-quiet.png", optimize=True)
    print("wrote", OUT / "phone-07-home-quiet.png")


def home_busy():
    im, d = base()
    d.text((48, 120), "ruletka", fill=TEXT, font=font(64, True))
    d.ellipse((48, 290, 72, 314), fill=(61, 255, 160))
    d.text((90, 286), "Hub online · 5 online · 3 waiting", fill=MUTED, font=font(26))
    rounded(d, (48, 380, W - 48, 720), 28, (12, 40, 28), outline=(80, 200, 140))
    d.text((80, 420), "People are waiting", fill=(184, 245, 212), font=font(36, True))
    d.text((80, 500), "3 in queue · 5 online — tap Start to match.", fill=(154, 184, 168), font=font(28))
    d.text((80, 600), "Start chatting", fill=(125, 255, 160), font=font(30, True))
    rounded(d, (48, 800, W - 48, 920), 999, PINK)
    d.text((W // 2 - 160, 840), "Start chatting", fill=(255, 255, 255), font=font(36, True))
    im.save(OUT / "phone-08-home-busy.png", optimize=True)
    print("wrote", OUT / "phone-08-home-busy.png")


def live_steps():
    im, d = base()
    # stage
    rounded(d, (40, 100, W - 40, 1400), 32, (18, 21, 28), outline=(40, 48, 60))
    d.text((80, 160), "Looking… · 4s", fill=TEXT, font=font(40, True))
    d.text((80, 230), "1 waiting · 3 online", fill=(158, 197, 255), font=font(28, True))
    d.text((80, 280), "You're first in line…", fill=(255, 233, 160), font=font(24))
    # chips
    chips = [("Queue", True, False), ("Connect", False, False), ("Video", False, False)]
    x = 80
    for i, (label, active, done) in enumerate(chips):
        if i:
            d.text((x, 360), "›", fill=(100, 110, 130), font=font(28, True))
            x += 30
        fill = (40, 70, 120) if active else (24, 28, 36)
        outline = (120, 170, 255) if active else (50, 55, 65)
        w = 160 if label != "Connect" else 180
        rounded(d, (x, 350, x + w, 410), 999, fill, outline=outline)
        d.text((x + 36, 362), label, fill=(220, 232, 255) if active else MUTED, font=font(24, True))
        x += w + 8
    d.text((80, 500), "Camera warm · TURN ready", fill=MUTED, font=font(24))
    # bottom bar
    rounded(d, (40, 1500, W - 40, 1840), 28, (12, 14, 20))
    d.text((80, 1540), "★ 3 · online 3 · wait 1 · you are waiting", fill=MUTED, font=font(24))
    # Next / Stop (primary row)
    rounded(d, (80, 1600, 520, 1700), 999, BLUE)
    d.text((230, 1630), "Next", fill=TEXT, font=font(30, True))
    rounded(d, (560, 1600, 1000, 1700), 999, (40, 50, 70), outline=(80, 90, 110))
    d.text((700, 1630), "Stop", fill=TEXT, font=font(30, True))
    # Icon row: mic · cam · flip · friends (matches app 0.1.89+)
    icons = ["🎤", "📹", "🔄", "👥"]
    gap = 24
    bw = 200
    x0 = 80
    y0 = 1720
    for i, ic in enumerate(icons):
        x = x0 + i * (bw + gap)
        rounded(d, (x, y0, x + bw, y0 + 90), 999, (28, 32, 42), outline=(60, 68, 82))
        d.text((x + 72, y0 + 22), ic, fill=TEXT, font=font(36))
    im.save(OUT / "phone-09-live-steps.png", optimize=True)
    print("wrote", OUT / "phone-09-live-steps.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    home_quiet()
    home_busy()
    live_steps()
    print("Done. Review assets/store/screenshots/phone-07…09")


if __name__ == "__main__":
    main()
