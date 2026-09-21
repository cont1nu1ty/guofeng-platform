"""Rebuild the original silent typography samples (Python + Pillow + FFmpeg).

No photographs, recordings, external footage or generated AI assets are used.
Font rendering uses the locally installed Noto CJK font (SIL Open Font License).
Fonts are not embedded in the videos or distributed by this script.
"""
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/miniapp/src/pkg-content/static/media"
OUT.mkdir(parents=True, exist_ok=True)
SERIF = "/usr/share/fonts/noto-cjk/NotoSerifCJK-Regular.ttc"
SANS = "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc"
RED = "#C41A1A"
GOLD = "#C9A96E"
INK = "#2C2C2C"
PAPER = "#F5F0E8"
WIDTH, HEIGHT, FPS, SECONDS = 640, 360, 15, 12
TITLE = ImageFont.truetype(SERIF, 36, index=2)
BODY = ImageFont.truetype(SERIF, 28, index=2)
SMALL = ImageFont.truetype(SANS, 14, index=2)
TINY = ImageFont.truetype(SANS, 11, index=2)

SAMPLES = [
    ("family-letter", "写给长大后的你", "一封家书 · 一份牵挂", ["愿你心中有光，脚下有路", "诚实待人，认真做事", "把小家的温暖，带给更多人"]),
    ("everyday-values", "家风，就在日常之间", "帧藏家风 · 日常篇", ["一粥一饭，记得来之不易", "邻里之间，多一份帮助", "认真守诺，用心过好每一天"]),
    ("integrity-talk", "清廉家风", "家风讲堂 · 回放样片", ["把规矩记在心里", "家事多商量，公私要分明", "从一件小事开始，让清廉成为习惯"]),
]


def centered(draw, words, y, font, fill, offset=0):
    box = draw.textbbox((0, 0), words, font=font)
    draw.text(((WIDTH - (box[2] - box[0])) / 2, y + offset), words, font=font, fill=fill)


def frame(title, category, lines, time):
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 640, 59), fill=RED)
    draw.text((28, 20), "家风中华行", font=SMALL, fill="white")
    draw.text((472, 23), "原创静音样片 · 12秒", font=TINY, fill="white")
    draw.rectangle((21, 78, 619, 317), outline=GOLD, width=1)
    draw.line((43, 106, 43, 285), fill=GOLD, width=3)
    draw.line((597, 106, 597, 285), fill=GOLD, width=3)
    centered(draw, category, 94, SMALL, RED)
    scene = min(3, int(time / 3))
    phase = (time % 3) / 3
    shift = int(9 * (1 - min(1, phase * 4)))
    words = title if scene == 0 else lines[scene - 1]
    chosen = TITLE if scene == 0 else BODY
    if len(words) > 17:
        split = words.find("，") + 1
        if split < 2:
            split = len(words) // 2
        centered(draw, words[:split], 146, chosen, INK, shift)
        centered(draw, words[split:], 192, chosen, INK, shift)
    else:
        centered(draw, words, 164, chosen, INK, shift)
    draw.rounded_rectangle((289, 254, 352, 282), radius=1, outline=RED, width=1)
    centered(draw, "家风共读", 259, TINY, RED)
    for i in range(4):
        x = 292 + i * 18
        draw.ellipse((x, 301, x + 5, 306), fill=RED if i == scene else GOLD)
    draw.line((22, 331, 618, 331), fill=GOLD, width=1)
    draw.line((22, 331, 22 + int(596 * min(time / SECONDS, 1)), 331), fill=RED, width=3)
    draw.text((23, 339), "文字、图形与排版均为本项目原创演示内容", font=TINY, fill=INK)
    return image


for slug, title, category, lines in SAMPLES:
    frame(title, category, lines, 1.2).save(OUT / f"{slug}.jpg", quality=91, optimize=True)
    encoder = subprocess.Popen([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-vcodec", "rawvideo",
        "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-", "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(OUT / f"{slug}.mp4")
    ], stdin=subprocess.PIPE)
    assert encoder.stdin is not None
    for index in range(FPS * SECONDS):
        encoder.stdin.write(frame(title, category, lines, index / FPS).tobytes())
    encoder.stdin.close()
    if encoder.wait() != 0:
        raise RuntimeError(f"Failed to encode {slug}")
    print(f"Created {slug}: {(OUT / f'{slug}.mp4').stat().st_size:,} bytes")
