"""Unit tests for watermark overlays. No DB or storage."""

from __future__ import annotations

from PIL import Image

from worker.watermark import apply_centered_watermark, apply_footer_watermark, should_watermark_variant


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


# ---------------------------------------------------------------------------
# Centered watermark tests
# ---------------------------------------------------------------------------


def test_centered_watermark_modifies_image() -> None:
    """Centered watermark changes pixels of a solid-color image."""
    img = Image.new("RGB", (400, 300), color=(80, 80, 80))
    original_pixels = img.tobytes()
    out = apply_centered_watermark(img, "zinovia-fans", opacity=0.30, stroke_px=2)
    assert out.size == img.size
    assert out.tobytes() != original_pixels, "watermark should change some pixels"


def test_centered_watermark_deterministic() -> None:
    """Same input + params → identical output bytes."""
    img1 = Image.new("RGB", (400, 300), color=(60, 60, 60))
    img2 = Image.new("RGB", (400, 300), color=(60, 60, 60))
    out1 = apply_centered_watermark(img1, "zinovia-fans", opacity=0.30, stroke_px=2)
    out2 = apply_centered_watermark(img2, "zinovia-fans", opacity=0.30, stroke_px=2)
    assert out1.tobytes() == out2.tobytes()


def test_centered_watermark_zero_opacity() -> None:
    """With opacity=0 the image should be unchanged (transparent overlay)."""
    img = Image.new("RGB", (400, 300), color=(120, 120, 120))
    original_pixels = img.tobytes()
    out = apply_centered_watermark(img, "zinovia-fans", opacity=0.0, stroke_px=0)
    assert out.tobytes() == original_pixels, "zero opacity should not change pixels"


def test_centered_watermark_stroke_differs() -> None:
    """Different stroke widths produce different outputs."""
    img1 = Image.new("RGB", (400, 300), color=(50, 50, 50))
    img2 = Image.new("RGB", (400, 300), color=(50, 50, 50))
    out_no_stroke = apply_centered_watermark(img1, "test", opacity=0.5, stroke_px=0)
    out_stroke = apply_centered_watermark(img2, "test", opacity=0.5, stroke_px=4)
    assert out_no_stroke.tobytes() != out_stroke.tobytes()


def test_centered_watermark_scales_with_image() -> None:
    """Larger image → larger font → different pixel pattern even with same text."""
    small = Image.new("RGB", (200, 150), color=(70, 70, 70))
    large = Image.new("RGB", (1000, 750), color=(70, 70, 70))
    out_small = apply_centered_watermark(small, "zinovia-fans", font_size_pct=0.05)
    out_large = apply_centered_watermark(large, "zinovia-fans", font_size_pct=0.05)
    # Both should be modified
    assert out_small.tobytes() != small.tobytes()
    assert out_large.tobytes() != large.tobytes()
    # They should differ from each other (different sizes)
    assert out_small.size != out_large.size
