#!/usr/bin/env python3
"""Render a project-original geometric study room as an equirectangular PNG.

No photographs, external textures, models, voices or generative AI are used.
Noto CJK is used only for rasterized text (SIL OFL), never distributed here.
Running this script writes only the sibling reviewed panorama image.
"""
from math import cos, pi, sin
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).with_name("shouyue-study-panorama.png")
W, H = 2048, 1024
PAPER, INK, WOOD, RED = "#f5f0e8", "#35362f", "#755441", "#9a4038"


def font(size):
    candidates = ("/usr/share/fonts/noto-cjk/NotoSerifCJK-Regular.ttc",
                  "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc")
    path = next((p for p in candidates if Path(p).is_file()), None)
    if not path:
        raise RuntimeError("Install an OFL Noto Serif CJK font before rebuilding this original texture")
    return ImageFont.truetype(path, size, index=2)


def wall(number):
    im = Image.new("RGB", (1024, 512), PAPER)
    draw = ImageDraw.Draw(im)
    draw.rectangle((0, 0, 1023, 38), fill=WOOD)
    draw.rectangle((0, 447, 1023, 511), fill=WOOD)
    for x in (0, 1012):
        draw.rectangle((x, 0, x + 11, 511), fill=WOOD)
    if number == 0:
        draw.rounded_rectangle((250, 76, 774, 345), radius=3, fill="#e9ddc8", outline=WOOD, width=8)
        draw.text((360, 103), "守约书屋", font=font(66), fill=RED)
        draw.text((315, 206), "认真守诺 · 用心共读", font=font(36), fill=INK)
        draw.text((328, 283), "原创虚构空间 · 非实景拍摄", font=font(26), fill=INK)
        draw.rectangle((196, 390, 828, 419), fill=WOOD)
        for x in (236, 747):
            draw.rectangle((x, 419, x + 23, 493), fill=WOOD)
    elif number == 1:
        for x in (100, 370, 640):
            draw.rectangle((x, 90, x + 200, 442), fill="#dfcdb2", outline=WOOD, width=8)
            for y in (174, 262, 350, 438):
                draw.rectangle((x, y, x + 200, y + 7), fill=WOOD)
                for i in range(7):
                    left = x + 12 + i * 25
                    top = y - (50 + (i * 7 + x) % 23)
                    shade = ("#7d8e80", "#b98b60", "#8b5650", "#cfb484")[(i + x) % 4]
                    draw.rectangle((left, top, left + 18, y - 2), fill=shade)
        draw.text((326, 38), "每一本书，都有下一位读者", font=font(28), fill=INK)
    elif number == 2:
        for x, text in ((120, "先倾听"), (395, "再约定"), (670, "常回顾")):
            draw.rectangle((x, 96, x + 220, 334), fill="#e8dac4", outline=WOOD, width=5)
            draw.text((x + 25, 187), text, font=font(52), fill=RED)
        draw.text((249, 366), "把答应的小事做好，让相处更有温度", font=font(30), fill=INK)
    else:
        draw.rectangle((236, 60, 788, 350), fill="#c4d5d1", outline=WOOD, width=13)
        # An original flat landscape illustration within the fictional window.
        draw.ellipse((621, 96, 673, 148), fill="#e9c992")
        draw.polygon(((244, 300), (391, 164), (536, 300)), fill="#8ca99a")
        draw.polygon(((430, 339), (646, 192), (779, 300), (779, 342)), fill="#769488")
        draw.line((512, 65, 512, 346), fill=WOOD, width=11)
        draw.line((242, 208, 783, 208), fill=WOOD, width=11)
        draw.text((342, 378), "给生活留一段共读时光", font=font(33), fill=INK)
    return im


def render():
    walls = [wall(i).load() for i in range(4)]
    image = Image.new("RGB", (W, H))
    pixels = image.load()
    longitude = [(sin((x + .5) / W * 2 * pi - pi), cos((x + .5) / W * 2 * pi - pi)) for x in range(W)]
    for y in range(H):
        latitude = pi / 2 - (y + .5) / H * pi
        vertical, horizontal = sin(latitude), cos(latitude)
        for x in range(W):
            sx, cz = longitude[x]
            dx, dz = sx * horizontal, cz * horizontal
            tx, ty, tz = 4 / abs(dx) if dx else 1e12, 2 / abs(vertical), 4 / abs(dz) if dz else 1e12
            distance = min(tx, ty, tz)
            px, py, pz = dx * distance, vertical * distance, dz * distance
            if ty <= tx and ty <= tz:
                if vertical > 0:
                    beam = abs(px) < .075 or abs(pz) < .075
                    color = (135, 108, 79) if beam else (230, 218, 195)
                else:
                    seam = (abs((px + .5) % 1 - .5) < .015 or abs((pz + 1) % 2 - 1) < .015)
                    color = (161, 140, 112) if seam else (202, 179, 146)
            else:
                if tz <= tx:
                    face, u = (0, (px + 4) / 8) if dz > 0 else (2, (4 - px) / 8)
                else:
                    face, u = (1, (4 - pz) / 8) if dx > 0 else (3, (pz + 4) / 8)
                v = (2 - py) / 4
                color = walls[face][min(1023, max(0, int(u * 1024))), min(511, max(0, int(v * 512)))]
            pixels[x, y] = color
    image.save(OUT, optimize=True)
    print(f"Rendered original geometric texture: {OUT.name} ({W} × {H})")


if __name__ == "__main__":
    render()
