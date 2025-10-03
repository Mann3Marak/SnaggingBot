from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageColor

ROOT = Path(__file__).resolve().parents[1]
ICONS_DIR = ROOT / 'public' / 'icons'
LOGO_DIR = ROOT / 'public' / 'branding' / 'logos'
LOGO_DIR.mkdir(parents=True, exist_ok=True)
ICONS_DIR.mkdir(parents=True, exist_ok=True)

PRIMARY_TONE = '#bcae69'
DEEP_TONE = '#8f8552'
PALE_TONE = '#e6d9a8'
WHITE = '#FFFFFF'
TRANSPARENT = (0, 0, 0, 0)

SIZES = [72, 96, 128, 144, 152, 192, 384, 512]


def path_for(size: int) -> Path:
    return ICONS_DIR / f'nhome-{size}x{size}.png'


def create_icon(size: int) -> None:
    img = Image.new('RGBA', (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    draw.ellipse((0, 0, size, size), fill=PRIMARY_TONE)

    center = size / 2
    roof_height = size * 0.36
    roof_width = size * 0.6
    top_y = center - roof_height / 1.2
    roof_points = [
        (center, top_y),
        (center + roof_width / 2, top_y + roof_height),
        (center - roof_width / 2, top_y + roof_height),
    ]
    draw.polygon(roof_points, fill=WHITE)

    body_width = size * 0.42
    body_height = size * 0.34
    body_left = center - body_width / 2
    body_top = top_y + roof_height * 0.62
    draw.rectangle((body_left, body_top, body_left + body_width, body_top + body_height), fill=WHITE)

    door_width = body_width * 0.34
    door_height = body_height * 0.62
    door_left = center - door_width / 2
    door_top = body_top + body_height - door_height
    draw.rounded_rectangle(
        (door_left, door_top, door_left + door_width, door_top + door_height),
        radius=max(1, int(size * 0.04)),
        fill=PALE_TONE,
    )

    img.save(path_for(size), format='PNG')


def _load_fonts() -> tuple[ImageFont.ImageFont, ImageFont.ImageFont]:
    try:
        heading = ImageFont.truetype('arialbd.ttf', 90)
        sub = ImageFont.truetype('arial.ttf', 38)
        wordmark_font = ImageFont.truetype('arialbd.ttf', 110)
    except OSError:
        heading = ImageFont.load_default()
        sub = ImageFont.load_default()
        wordmark_font = ImageFont.load_default()
    return heading, sub, wordmark_font


def create_logo_png(file_name: str, background: str | None, invert: bool = False) -> None:
    width, height = 640, 240
    img = Image.new('RGBA', (width, height), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    if background:
        draw.rounded_rectangle((0, 0, width, height), radius=40, fill=background)

    icon_size = 180
    base_icon = Image.open(path_for(192)).resize((icon_size, icon_size), Image.LANCZOS)
    if invert:
        r, g, b, a = base_icon.split()
        solid = Image.new('RGBA', base_icon.size, (255, 255, 255, 255))
        base_icon = Image.composite(solid, base_icon, a)
    img.paste(base_icon, (60, (height - icon_size) // 2), mask=base_icon)

    heading_font, sub_font, _ = _load_fonts()
    text_color = ImageColor.getrgb(WHITE if invert else PRIMARY_TONE)
    sub_color = ImageColor.getrgb(WHITE if invert else DEEP_TONE)
    if invert:
        sub_color = (*sub_color[:3], 205)

    draw.text((280, 90), 'NHome', font=heading_font, fill=text_color)
    draw.text((286, 160), 'Inspection Pro', font=sub_font, fill=sub_color)

    img.save(LOGO_DIR / file_name, format='PNG')


def create_wordmark_png() -> None:
    width, height = 720, 200
    img = Image.new('RGBA', (width, height), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    _, _, wordmark_font = _load_fonts()
    text = 'NHome'
    bbox = draw.textbbox((0, 0), text, font=wordmark_font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) / 2
    y = (height - text_height) / 2 - 20
    draw.text((x, y), text, font=wordmark_font, fill=ImageColor.getrgb(PRIMARY_TONE))
    sub_font_size = max(36, int(wordmark_font.size * 0.32))
    try:
        sub_font = ImageFont.truetype('arial.ttf', sub_font_size)
    except OSError:
        sub_font = ImageFont.load_default()
    sub_text = 'Inspection Pro'
    sub_bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    sub_width = sub_bbox[2] - sub_bbox[0]
    sub_height = sub_bbox[3] - sub_bbox[1]
    draw.text(( (width - sub_width) / 2, y + text_height + 10), sub_text, font=sub_font, fill=ImageColor.getrgb(DEEP_TONE))
    img.save(LOGO_DIR / 'nhome-wordmark.png', format='PNG')


def create_apple_touch_icon() -> None:
    size = 180
    img = Image.new('RGBA', (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((0, 0, size, size), radius=int(size * 0.23), fill=PRIMARY_TONE)

    padding = size * 0.18
    left = padding
    right = size - padding
    top = padding
    mid_y = size * 0.54
    bottom = size - padding * 0.45

    roof_points = [((left + right) / 2, top), (right, mid_y), (left, mid_y)]
    draw.polygon(roof_points, fill=WHITE)
    draw.rectangle((left + size * 0.07, mid_y, right - size * 0.07, bottom), fill=WHITE)
    door_width = size * 0.22
    door_height = size * 0.25
    door_left = (size - door_width) / 2
    door_top = bottom - door_height
    draw.rounded_rectangle(
        (door_left, door_top, door_left + door_width, bottom),
        radius=int(size * 0.05),
        fill=PALE_TONE,
    )

    img.save(ICONS_DIR / 'apple-touch-icon.png', format='PNG')


def create_favicon() -> None:
    icon = Image.open(path_for(72)).convert('RGBA')
    favicon_path = ICONS_DIR.parent / 'favicon.ico'
    icon.save(favicon_path, format='ICO', sizes=[(32, 32), (16, 16)])


if __name__ == '__main__':
    for size in SIZES:
        create_icon(size)
    create_logo_png('nhome-logo-primary.png', '#FFFFFF', invert=False)
    create_logo_png('nhome-logo-white.png', None, invert=True)
    create_wordmark_png()
    create_apple_touch_icon()
    create_favicon()

