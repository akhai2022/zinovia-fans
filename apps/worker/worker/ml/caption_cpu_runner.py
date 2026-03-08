"""CPU-only image captioning runner using HuggingFace transformers.

Supports two models:
- fast: microsoft/git-base (MIT license, ~500ms on CPU)
- better: Salesforce/blip-image-captioning-base (BSD-3-Clause, ~1-3s on CPU)

All inference is forced to CPU. Models are loaded once per worker process (warm).
Images are downscaled to max 768px longest side for predictable latency.
"""

from __future__ import annotations

import logging
import re
import time
from io import BytesIO

from PIL import Image

logger = logging.getLogger(__name__)

MAX_CAPTION_DIM = 768


def _downscale(img: Image.Image) -> Image.Image:
    """Downscale image so longest side <= MAX_CAPTION_DIM."""
    w, h = img.size
    if max(w, h) <= MAX_CAPTION_DIM:
        return img
    scale = MAX_CAPTION_DIM / max(w, h)
    new_w, new_h = int(w * scale), int(h * scale)
    return img.resize((new_w, new_h), Image.LANCZOS)


def _generate_caption_git(img: Image.Image) -> str:
    """Generate caption using microsoft/git-base (fast)."""
    import torch
    from worker.ml.model_loader import get_git_model

    processor, model = get_git_model()
    inputs = processor(images=img, return_tensors="pt")
    with torch.no_grad():
        generated_ids = model.generate(pixel_values=inputs.pixel_values, max_length=50)
    caption = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    return caption.strip()


def _generate_caption_blip(img: Image.Image) -> str:
    """Generate caption using Salesforce/blip-image-captioning-base (better quality)."""
    import torch
    from worker.ml.model_loader import get_blip_model

    processor, model = get_blip_model()
    inputs = processor(images=img, return_tensors="pt")
    with torch.no_grad():
        generated_ids = model.generate(**inputs, max_length=75)
    caption = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    return caption.strip()


def _extract_keywords(caption: str) -> list[str]:
    """Extract simple keywords from caption text (noun-like words, unique, lowercased)."""
    stop_words = {
        "a", "an", "the", "is", "are", "was", "were", "in", "on", "at", "to",
        "for", "of", "with", "and", "or", "it", "its", "this", "that", "from",
        "by", "as", "be", "has", "have", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "can", "there", "their",
        "they", "he", "she", "we", "you", "i", "me", "my", "your", "his",
        "her", "our", "them", "which", "who", "what", "where", "when", "how",
        "not", "no", "but", "if", "so", "up", "out", "about", "into", "over",
        "after", "before", "between", "under", "above", "very", "just", "also",
        "than", "then", "some", "any", "all", "each", "every", "both", "few",
        "more", "most", "other", "such", "only", "same", "own", "while",
    }
    words = re.findall(r"[a-zA-Z]{3,}", caption.lower())
    seen: set[str] = set()
    keywords: list[str] = []
    for w in words:
        if w not in stop_words and w not in seen:
            seen.add(w)
            keywords.append(w)
    return keywords[:10]


PLAYFUL_EMOJIS = ["✨", "🔥", "💫", "🌟", "💕", "😍", "🎉"]
FLIRTY_EMOJIS = ["💋", "🔥", "😘", "✨", "💕", "🥰"]


def _format_caption(raw_caption: str, mode: str, tone: str) -> str:
    """Format the raw model caption based on mode and tone."""
    caption = raw_caption.strip()
    if not caption:
        return caption

    # Capitalize first letter
    caption = caption[0].upper() + caption[1:] if len(caption) > 1 else caption.upper()

    # Ensure ends with period for detailed/alt_text
    if mode in ("detailed", "alt_text") and not caption.endswith((".","!","?")):
        caption += "."

    if mode == "alt_text":
        # Alt-text: factual, no emojis, no embellishment
        return caption

    if mode == "short":
        # Keep it brief
        sentences = re.split(r'(?<=[.!?])\s+', caption)
        caption = sentences[0] if sentences else caption

    # Add tone flair
    if tone == "playful" and mode != "alt_text":
        import random
        emoji = random.choice(PLAYFUL_EMOJIS)
        caption = f"{caption} {emoji}"
    elif tone == "flirty" and mode != "alt_text":
        import random
        emoji = random.choice(FLIRTY_EMOJIS)
        caption = f"{caption} {emoji}"
    elif tone == "professional":
        # Clean and polished, no additions
        pass

    return caption


def _generate_alt_text(raw_caption: str) -> str:
    """Generate accessibility alt-text from the raw caption."""
    alt = raw_caption.strip()
    if alt:
        alt = alt[0].upper() + alt[1:] if len(alt) > 1 else alt.upper()
    if alt and not alt.endswith((".", "!", "?")):
        alt += "."
    return alt


def run_caption(
    image_bytes: bytes,
    mode: str = "short",
    tone: str = "neutral",
    quality: str = "fast",
    include_keywords: bool = True,
) -> dict:
    """Run image captioning pipeline.

    Returns:
        {
            "caption": str,
            "alt_text": str,
            "keywords": list[str],
            "model": str,
            "timings": {"preprocess_ms": int, "inference_ms": int, "postprocess_ms": int}
        }
    """
    # 1. Preprocess
    t0 = time.monotonic()
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    img = _downscale(img)
    preprocess_ms = int((time.monotonic() - t0) * 1000)

    # 2. Inference
    t1 = time.monotonic()
    if quality == "better":
        raw_caption = _generate_caption_blip(img)
        model_name = "Salesforce/blip-image-captioning-base"
    else:
        raw_caption = _generate_caption_git(img)
        model_name = "microsoft/git-base"
    inference_ms = int((time.monotonic() - t1) * 1000)

    # 3. Postprocess
    t2 = time.monotonic()
    caption = _format_caption(raw_caption, mode, tone)
    alt_text = _generate_alt_text(raw_caption)
    keywords = _extract_keywords(raw_caption) if include_keywords else []
    postprocess_ms = int((time.monotonic() - t2) * 1000)

    logger.info(
        "Caption generated: model=%s, mode=%s, tone=%s, preprocess=%dms, inference=%dms, postprocess=%dms",
        model_name, mode, tone, preprocess_ms, inference_ms, postprocess_ms,
    )

    return {
        "caption": caption,
        "alt_text": alt_text,
        "keywords": keywords,
        "model": model_name,
        "timings": {
            "preprocess_ms": preprocess_ms,
            "inference_ms": inference_ms,
            "postprocess_ms": postprocess_ms,
        },
    }
