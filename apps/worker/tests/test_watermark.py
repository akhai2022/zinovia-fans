"""Unit tests for footer watermark overlay. No DB or storage."""

from __future__ import annotations

from PIL import Image

from worker.watermark import apply_footer_watermark, should_watermark_variant


def test_watermark_footer_region_differs_from_original() -> None:
    """Apply watermark to a solid-color image; footer region pixels differ from original."""
    w, h = 100, 80
    img = Image.new("RGB", (w, h), color=(40, 40, 40))
    original_pixels = img.tobytes()

    out = apply_footer_watermark(
        img,
        "Published on Zinovia-Fans",
        height_pct=0.08,
        opacity=0.55,
        bg=True,
        padding_pct=0.04,
        align="left",
    )
    out_pixels = out.tobytes()

    # Footer is bottom 8%: strip from y = h - strip_h to h. strip_h = max(1, int(80*0.08)) = 6
    strip_h = max(1, int(h * 0.08))
    y1 = h - strip_h
    # Region above footer: rows 0..y1-1 should be largely unchanged (same solid color)
    # We compare full image: at least the top portion must match; footer region may differ
    assert out.size == img.size
    assert out_pixels != original_pixels, "watermark should change some pixels"

    # Pixels in the footer strip (bottom strip_h rows) should differ from original
    footer_start_byte = (y1 * w * 3)
    original_footer = original_pixels[footer_start_byte:]
    out_footer = out_pixels[footer_start_byte:]
    assert original_footer != out_footer, "footer region should differ after watermark"

    # Region above footer: mostly unchanged (all same color in original; may have minor diff at boundary)
    above_len = y1 * w * 3
    original_above = original_pixels[:above_len]
    out_above = out_pixels[:above_len]
    assert original_above == out_above, "region above footer should be unchanged"


def test_watermark_idempotent_behavior_same_input_same_output() -> None:
    """Same image and params produce same output (deterministic)."""
    img = Image.new("RGB", (50, 50), color=(100, 100, 100))
    out1 = apply_footer_watermark(img, "Test", height_pct=0.1, bg=True)
    img2 = Image.new("RGB", (50, 50), color=(100, 100, 100))
    out2 = apply_footer_watermark(img2, "Test", height_pct=0.1, bg=True)
    assert out1.tobytes() == out2.tobytes()


def test_should_watermark_variant_only_when_enabled_and_in_list() -> None:
    """Watermark applied only to configured variants when enabled."""
    assert should_watermark_variant("grid", True, ["grid", "full"]) is True
    assert should_watermark_variant("full", True, ["grid", "full"]) is True
    assert should_watermark_variant("thumb", True, ["grid", "full"]) is False
    assert should_watermark_variant("grid", False, ["grid", "full"]) is False
    assert should_watermark_variant("grid", True, []) is False
    assert should_watermark_variant("poster", True, ["grid", "full"]) is False
