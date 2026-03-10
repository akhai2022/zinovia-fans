"""CPU-only virtual try-on runner — CatVTON (ICLR 2025).

Pipeline:
1. Segment person image using SegFormer (mattmdjaga/segformer_b2_clothes)
   to identify which clothing region to replace (upper/lower/full).
2. Build an inpainting mask from the segmentation labels.
3. Run CatVTON (zhengchong/CatVTON) — a dedicated virtual try-on model
   that uses latent concatenation + skip cross-attention for high-quality
   garment transfer.
4. Encode result as JPEG.

All inference runs on CPU (float32). Expected wall-clock: 4-8 minutes
per image at 20 denoising steps.

Models:
  - mattmdjaga/segformer_b2_clothes  (~90MB, clothing semantic segmentation)
  - runwayml/stable-diffusion-inpainting  (~2GB, SD 1.5 base for CatVTON)
  - stabilityai/sd-vae-ft-mse  (~330MB, VAE)
  - zhengchong/CatVTON  (~50MB, virtual try-on attention weights)
"""

from __future__ import annotations

import logging
import time
from io import BytesIO

import numpy as np
from PIL import Image, ImageFilter

logger = logging.getLogger(__name__)

# CatVTON native resolution — 512x384 matches the vitonhd training config.
# The "mix" checkpoint supports up to 1024x768, but 512x384 is faster on CPU
# and still produces good results.
TRYON_WIDTH = 384
TRYON_HEIGHT = 512

# SegFormer clothing label IDs (mattmdjaga/segformer_b2_clothes)
SEG_LABEL_UPPER_CLOTHES = 4
SEG_LABEL_SKIRT = 5
SEG_LABEL_PANTS = 6
SEG_LABEL_DRESS = 7
SEG_LABEL_BELT = 8
SEG_LABEL_SCARF = 17

CATEGORY_LABELS: dict[str, list[int]] = {
    "upper_body": [SEG_LABEL_UPPER_CLOTHES, SEG_LABEL_SCARF],
    "lower_body": [SEG_LABEL_SKIRT, SEG_LABEL_PANTS],
    "full_body": [
        SEG_LABEL_UPPER_CLOTHES,
        SEG_LABEL_SKIRT,
        SEG_LABEL_PANTS,
        SEG_LABEL_DRESS,
        SEG_LABEL_BELT,
        SEG_LABEL_SCARF,
    ],
}


def _segment_clothing(person_img: Image.Image) -> np.ndarray:
    """Run clothing segmentation, return label map (H, W) with integer labels."""
    import torch
    from worker.ml.model_loader import get_clothing_segmenter

    processor, model = get_clothing_segmenter()

    inputs = processor(images=person_img, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)

    logits = outputs.logits  # (1, num_labels, H/4, W/4)

    upsampled = torch.nn.functional.interpolate(
        logits,
        size=person_img.size[::-1],  # (H, W)
        mode="bilinear",
        align_corners=False,
    )
    labels = upsampled.argmax(dim=1).squeeze().cpu().numpy()
    return labels


def _build_inpainting_mask(
    labels: np.ndarray,
    category: str,
    dilate_px: int = 10,
) -> Image.Image:
    """Build a binary inpainting mask from segmentation labels.

    White (255) = region to inpaint. Black (0) = preserve.
    """
    target_labels = CATEGORY_LABELS.get(category, CATEGORY_LABELS["upper_body"])

    mask = np.zeros_like(labels, dtype=np.uint8)
    for label_id in target_labels:
        mask[labels == label_id] = 255

    mask_img = Image.fromarray(mask, mode="L")

    if dilate_px > 0:
        mask_img = mask_img.filter(ImageFilter.MaxFilter(dilate_px * 2 + 1))

    return mask_img


def _validate_mask_coverage(mask: Image.Image, min_ratio: float = 0.01) -> None:
    """Ensure the mask covers at least min_ratio of the image."""
    arr = np.array(mask)
    coverage = np.count_nonzero(arr) / arr.size
    if coverage < min_ratio:
        raise ValueError(
            f"No clothing region detected for the selected category "
            f"(mask coverage: {coverage:.1%}). "
            f"Ensure the person photo shows the relevant body part."
        )


def run_tryon(
    person_bytes: bytes,
    garment_bytes: bytes,
    category: str = "upper_body",
) -> dict:
    """Run CatVTON virtual try-on pipeline on CPU.

    Steps:
      1. Preprocess: open and convert images
      2. Segment: detect clothing region on person image
      3. Mask: build inpainting mask for the target category
      4. Infer: CatVTON pipeline (person + garment + mask → result)
      5. Postprocess: encode result as JPEG

    Args:
        person_bytes: Raw bytes of the person photo (JPEG/PNG/WebP).
        garment_bytes: Raw bytes of the garment product image.
        category: "upper_body", "lower_body", or "full_body".

    Returns:
        {
            "result_bytes": bytes (JPEG),
            "content_type": "image/jpeg",
            "model": str,
            "timings": {
                "preprocess_ms": int,
                "segment_ms": int,
                "inference_ms": int,
                "postprocess_ms": int,
            },
        }
    """
    import torch

    # ── 1. Preprocess ──────────────────────────────────────────────
    t0 = time.monotonic()

    person_img = Image.open(BytesIO(person_bytes)).convert("RGB")
    garment_img = Image.open(BytesIO(garment_bytes)).convert("RGB")

    preprocess_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        "tryon preprocess: %dms, person=%s, garment=%s",
        preprocess_ms,
        person_img.size,
        garment_img.size,
    )

    # ── 2. Clothing segmentation ───────────────────────────────────
    t1 = time.monotonic()

    # Segment at a reasonable resolution for speed
    seg_size = (TRYON_WIDTH, TRYON_HEIGHT)
    person_for_seg = person_img.copy()
    person_for_seg.thumbnail((seg_size[0] * 2, seg_size[1] * 2), Image.LANCZOS)
    labels = _segment_clothing(person_for_seg)

    segment_ms = int((time.monotonic() - t1) * 1000)
    logger.info(
        "tryon segmentation: %dms, unique_labels=%s",
        segment_ms,
        np.unique(labels).tolist(),
    )

    # ── 3. Build inpainting mask ───────────────────────────────────
    mask = _build_inpainting_mask(labels, category)
    _validate_mask_coverage(mask)

    # Resize mask to match the segmented person size (pipeline will resize further)
    mask = mask.resize(person_for_seg.size, Image.NEAREST)

    # ── 4. CatVTON inference ──────────────────────────────────────
    t2 = time.monotonic()

    from worker.ml.model_loader import get_tryon_pipeline

    pipe = get_tryon_pipeline()

    generator = torch.Generator(device="cpu").manual_seed(42)

    num_steps = 20  # 20 steps is a good quality/speed trade-off on CPU
    result_images = pipe(
        image=person_img,
        condition_image=garment_img,
        mask=mask,
        num_inference_steps=num_steps,
        guidance_scale=2.5,
        height=TRYON_HEIGHT,
        width=TRYON_WIDTH,
        generator=generator,
    )

    result_img = result_images[0]

    inference_ms = int((time.monotonic() - t2) * 1000)
    logger.info("tryon CatVTON inference: %dms (%d steps)", inference_ms, num_steps)

    # ── 5. Postprocess ─────────────────────────────────────────────
    t3 = time.monotonic()

    output_img = result_img.convert("RGB")

    buf = BytesIO()
    output_img.save(buf, format="JPEG", quality=92)
    buf.seek(0)
    result_bytes = buf.getvalue()

    postprocess_ms = int((time.monotonic() - t3) * 1000)

    model_desc = "CatVTON (ICLR 2025) — segformer_b2_clothes + CatVTON/mix"

    logger.info(
        "tryon complete: category=%s, preprocess=%dms, segment=%dms, "
        "inference=%dms, postprocess=%dms, output_size=%d bytes",
        category,
        preprocess_ms,
        segment_ms,
        inference_ms,
        postprocess_ms,
        len(result_bytes),
    )

    return {
        "result_bytes": result_bytes,
        "content_type": "image/jpeg",
        "model": model_desc,
        "timings": {
            "preprocess_ms": preprocess_ms,
            "segment_ms": segment_ms,
            "inference_ms": inference_ms,
            "postprocess_ms": postprocess_ms,
        },
    }
