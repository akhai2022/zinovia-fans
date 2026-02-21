"""Lazy-singleton model loaders for AI safety inference.

Each model is loaded on first use and cached in a module-level global.
All models run on CPU (device=-1 / device="cpu").

Environment variables:
  HF_HOME / TRANSFORMERS_CACHE — set in Dockerfile to /app/models
  to avoid downloading at runtime.

IMPORTANT: Only ONE copy of each model is loaded per worker process.
Set Celery concurrency to 1-2 to avoid multiple copies in memory.
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Ensure stable cache paths (set in Dockerfile, but also set here as fallback)
_HF_HOME = os.environ.get("HF_HOME", "/app/models")
os.environ.setdefault("HF_HOME", _HF_HOME)
os.environ.setdefault("TRANSFORMERS_CACHE", os.path.join(_HF_HOME, "transformers"))

# --- NSFW classifier ---
_nsfw_pipe: Any = None

NSFW_MODEL = "Falconsai/nsfw_image_detection"


def get_nsfw_pipeline() -> Any:
    """Return a cached HuggingFace image-classification pipeline for NSFW detection."""
    global _nsfw_pipe
    if _nsfw_pipe is None:
        logger.info("Loading NSFW model: %s", NSFW_MODEL)
        from transformers import pipeline

        _nsfw_pipe = pipeline(
            "image-classification",
            model=NSFW_MODEL,
            device=-1,
        )
        logger.info("NSFW model loaded")
    return _nsfw_pipe


# --- Age-range classifier (PROXY signal only — not definitive age determination) ---
_age_pipe: Any = None

AGE_MODEL = "nateraw/vit-age-classifier"


def get_age_pipeline() -> Any:
    """Return a cached HuggingFace image-classification pipeline for age-range estimation.

    NOTE: This is a proxy signal only. The classifier predicts apparent age ranges
    from facial features. It is NOT a reliable age determination tool. All outputs
    must be validated by human review before enforcement.
    """
    global _age_pipe
    if _age_pipe is None:
        logger.info("Loading age-range proxy model: %s", AGE_MODEL)
        from transformers import pipeline

        _age_pipe = pipeline(
            "image-classification",
            model=AGE_MODEL,
            device=-1,
        )
        logger.info("Age-range proxy model loaded")
    return _age_pipe


# --- BLIP image captioning ---
_blip_processor: Any = None
_blip_model: Any = None

BLIP_MODEL = "Salesforce/blip-image-captioning-base"


def get_blip_model() -> tuple[Any, Any]:
    """Return (processor, model) for BLIP image captioning. Cached."""
    global _blip_processor, _blip_model
    if _blip_processor is None or _blip_model is None:
        logger.info("Loading BLIP model: %s", BLIP_MODEL)
        from transformers import BlipForConditionalGeneration, BlipProcessor

        _blip_processor = BlipProcessor.from_pretrained(BLIP_MODEL)
        _blip_model = BlipForConditionalGeneration.from_pretrained(BLIP_MODEL)
        logger.info("BLIP model loaded")
    return _blip_processor, _blip_model


# --- Sentence Transformer (text embeddings) ---
_sentence_model: Any = None

SENTENCE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


def get_sentence_model() -> Any:
    """Return a cached SentenceTransformer for text embeddings (384-dim)."""
    global _sentence_model
    if _sentence_model is None:
        logger.info("Loading sentence model: %s", SENTENCE_MODEL)
        from sentence_transformers import SentenceTransformer

        _sentence_model = SentenceTransformer(SENTENCE_MODEL, device="cpu")
        logger.info("Sentence model loaded")
    return _sentence_model
