"""Footer watermark overlay for derived image variants. Originals are never modified."""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def _font_path() -> Path | None:
    """Bundled font: apps/worker/assets/fonts/DejaVuSans.ttf or env WORKER_FONT_PATH."""
    env_path = os.environ.get("WORKER_FONT_PATH")
    if env_path and os.path.isfile(env_path):
        return Path(env_path)
    base = Path(__file__).resolve().parent.parent
    candidate = base / "assets" / "fonts" / "DejaVuSans.ttf"
    return candidate if candidate.is_file() else None


def load_font(size: int = 14) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Load preferred font or PIL default."""
    path = _font_path()
    if path is not None:
        return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def apply_footer_watermark(
    image: Image.Image,
    text: str,
    *,
    height_pct: float = 0.08,
    opacity: float = 0.55,
    bg: bool = True,
    padding_pct: float = 0.04,
    align: str = "left",
) -> Image.Image:
    """
    Draw a semi-transparent footer strip with text. Clamps height_pct to [0.05, 0.12].
    Does not modify the original; returns a new image (RGB or RGBA).
    """
    height_pct = max(0.05, min(0.12, height_pct))
    w, h = image.size
    strip_h = max(1, int(h * height_pct))
    padding = max(0, int(min(w, h) * padding_pct))

    if image.mode != "RGBA":
        out = image.convert("RGBA")
    else:
        out = image.copy()

    draw = ImageDraw.Draw(out)
    font = load_font(size=max(10, strip_h - 2 * padding))

    # Footer strip (top of strip at y = h - strip_h)
    y1 = h - strip_h
    y2 = h
    if bg:
        overlay = Image.new("RGBA", (w, strip_h), (0, 0, 0, int(255 * opacity)))
        out.paste(overlay, (0, y1), overlay)

    # Text: white with subtle shadow for contrast
    text_y = y1 + (strip_h - font.size) // 2 if strip_h >= font.size else y1
    text_color = (255, 255, 255, 255)
    shadow_color = (0, 0, 0, 180)
    # Bounding box for text
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    if align == "center":
        text_x = (w - tw) // 2
    else:
        text_x = padding
    text_x = max(padding, min(text_x, w - tw - padding))

    for dx, dy in [(1, 1), (1, 0), (0, 1)]:
        draw.text((text_x + dx, text_y + dy), text, font=font, fill=shadow_color)
    draw.text((text_x, text_y), text, font=font, fill=text_color)

    if out.mode == "RGBA" and image.mode == "RGB":
        out = out.convert("RGB")
    return out


def should_watermark_variant(variant: str, enabled: bool, variant_list: list[str]) -> bool:
    """Return True if watermark should be applied for this variant."""
    return bool(enabled and variant_list and variant in variant_list)
