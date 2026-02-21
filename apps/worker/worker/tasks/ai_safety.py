"""AI safety tasks: image scanning, caption generation, tag extraction + embeddings.

Task chain:
  scan_image → (if ALLOW) → generate_caption + generate_tags

All tasks are idempotent — they skip processing if a result row already exists.
DB access uses _make_session_factory() per invocation (same pattern as worker/tasks/media.py).

IMPORTANT: The age-range classifier (vit-age-classifier) is a PROXY signal only.
It does NOT determine actual age. All flagged content MUST be reviewed by a human
moderator before any enforcement action is taken.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from io import BytesIO

import sqlalchemy as sa
from celery import shared_task
from PIL import Image
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.settings import get_settings
from app.modules.ai_safety.models import ImageCaption, ImageSafetyScan, ImageTag
from app.modules.media.models import MediaObject
from worker.storage_io import get_media_bucket, get_object_bytes

logger = logging.getLogger(__name__)

# Age-range labels that the classifier maps to "under 20".
# NOTE: This is a proxy signal from a ViT model trained on facial appearance,
# NOT a reliable age determination. False positives are expected.
UNDERAGE_AGE_LABELS = {"0-2", "3-9", "10-19"}

# Stopwords for tag extraction
_STOPWORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "may", "might", "must", "can", "could", "of", "in", "to",
    "for", "with", "on", "at", "from", "by", "about", "as", "into",
    "through", "during", "before", "after", "above", "below", "between",
    "and", "but", "or", "nor", "not", "no", "so", "very", "too", "also",
    "just", "than", "then", "that", "this", "these", "those", "it", "its",
    "he", "she", "they", "we", "you", "i", "me", "him", "her", "us",
    "them", "my", "your", "his", "our", "their", "up", "out", "off",
    "over", "under", "again", "further", "once", "here", "there", "when",
    "where", "why", "how", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "only", "own", "same", "what",
    "which", "who", "whom",
})


# ---------------------------------------------------------------------------
# DB helpers (same pattern as worker/tasks/media.py)
# ---------------------------------------------------------------------------


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    """Create a fresh async session factory per task invocation."""
    engine = create_async_engine(str(get_settings().database_url), pool_pre_ping=True)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def _scan_exists(media_asset_id: uuid.UUID) -> bool:
    async with _make_session_factory()() as session:
        r = await session.execute(
            select(ImageSafetyScan.id)
            .where(ImageSafetyScan.media_asset_id == media_asset_id)
            .limit(1)
        )
        return r.scalar_one_or_none() is not None


async def _caption_exists(media_asset_id: uuid.UUID) -> bool:
    async with _make_session_factory()() as session:
        r = await session.execute(
            select(ImageCaption.id)
            .where(ImageCaption.media_asset_id == media_asset_id)
            .limit(1)
        )
        return r.scalar_one_or_none() is not None


async def _tags_exist(media_asset_id: uuid.UUID) -> bool:
    async with _make_session_factory()() as session:
        r = await session.execute(
            select(ImageTag.id)
            .where(ImageTag.media_asset_id == media_asset_id)
            .limit(1)
        )
        return r.scalar_one_or_none() is not None


async def _get_caption_text(media_asset_id: uuid.UUID) -> str | None:
    async with _make_session_factory()() as session:
        r = await session.execute(
            select(ImageCaption.raw_caption)
            .where(ImageCaption.media_asset_id == media_asset_id)
            .limit(1)
        )
        return r.scalar_one_or_none()


async def _update_safety_status(media_asset_id: uuid.UUID, status: str) -> None:
    async with _make_session_factory()() as session:
        await session.execute(
            update(MediaObject)
            .where(MediaObject.id == media_asset_id)
            .values(safety_status=status)
        )
        await session.commit()


# ---------------------------------------------------------------------------
# Policy engine
#
# IMPORTANT: The underage_likelihood_proxy is a PROXY signal from a ViT age
# classifier. It is NOT a reliable age determination. BLOCK only fires when
# BOTH nsfw_score AND underage_proxy exceed their thresholds. All
# REQUIRE_REVIEW items MUST be reviewed by a human moderator.
# ---------------------------------------------------------------------------


def compute_policy_decision(
    nsfw_score: float,
    underage_proxy: float,
    nsfw_block_threshold: float = 0.85,
    underage_high_threshold: float = 0.6,
    underage_med_threshold: float = 0.3,
) -> tuple[str, str]:
    """Return (risk_level, decision) based on NSFW + age-proxy scores.

    Decision matrix:
      underage_proxy >= HIGH AND nsfw_score >= BLOCK_THRESHOLD → BLOCK
      underage_proxy >= HIGH AND nsfw_score <  BLOCK_THRESHOLD → REQUIRE_REVIEW
      underage_proxy >= MED  AND nsfw_score >= 0.50            → REQUIRE_REVIEW
      Everything else                                          → ALLOW

    Returns:
        (risk_level, decision) where risk_level is LOW/MEDIUM/HIGH
        and decision is ALLOW/REQUIRE_REVIEW/BLOCK.
    """
    # BLOCK requires BOTH high underage proxy AND high NSFW score
    if underage_proxy >= underage_high_threshold and nsfw_score >= nsfw_block_threshold:
        return "HIGH", "BLOCK"
    # High underage proxy alone → human review required
    if underage_proxy >= underage_high_threshold:
        return "HIGH", "REQUIRE_REVIEW"
    # Medium underage proxy + moderate NSFW → human review
    if underage_proxy >= underage_med_threshold and nsfw_score >= 0.5:
        return "MEDIUM", "REQUIRE_REVIEW"
    return "LOW", "ALLOW"


# ---------------------------------------------------------------------------
# Task 1: scan_image
# ---------------------------------------------------------------------------


@shared_task(
    name="ai_safety.scan_image",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def scan_image(self, asset_id: str, object_key: str, content_type: str) -> dict:
    """Run NSFW + age-proxy classification on an uploaded image.

    Writes ImageSafetyScan row, updates media_assets.safety_status,
    and chains caption + tag tasks if the image is allowed.
    """
    try:
        media_uuid = uuid.UUID(asset_id)
    except ValueError:
        logger.warning("Invalid asset_id: %s", asset_id)
        return {"status": "FAILED", "error": "invalid_asset_id"}

    # Idempotent check
    if asyncio.run(_scan_exists(media_uuid)):
        logger.info("Scan already exists, skipping", extra={"asset_id": asset_id})
        return {"status": "SKIPPED"}

    # Download image
    try:
        bucket = get_media_bucket()
        raw = get_object_bytes(bucket, object_key)
        img = Image.open(BytesIO(raw)).convert("RGB")
    except Exception as exc:
        logger.exception("Failed to download image", extra={"asset_id": asset_id})
        raise self.retry(exc=exc)

    # --- NSFW classification ---
    from worker.ml.model_loader import NSFW_MODEL, get_nsfw_pipeline

    nsfw_pipe = get_nsfw_pipeline()
    nsfw_results = nsfw_pipe(img)
    # Results: [{"label": "nsfw", "score": 0.95}, {"label": "normal", "score": 0.05}]
    nsfw_map = {r["label"]: r["score"] for r in nsfw_results}
    nsfw_score = nsfw_map.get("nsfw", 0.0)
    nsfw_label = "nsfw" if nsfw_score >= 0.5 else "normal"

    # --- Age-range classification (PROXY signal only) ---
    from worker.ml.model_loader import AGE_MODEL, get_age_pipeline

    age_pipe = get_age_pipeline()
    age_results = age_pipe(img)
    # Results: [{"label": "20-29", "score": 0.45}, {"label": "10-19", "score": 0.3}, ...]
    age_map = {r["label"]: r["score"] for r in age_results}
    # Sum probabilities for age ranges under 20 as a proxy for underage likelihood
    underage_proxy = sum(age_map.get(label, 0.0) for label in UNDERAGE_AGE_LABELS)
    age_range_prediction = max(age_results, key=lambda r: r["score"])["label"]

    # --- Policy decision ---
    settings = get_settings()
    risk_level, decision = compute_policy_decision(
        nsfw_score=nsfw_score,
        underage_proxy=underage_proxy,
        nsfw_block_threshold=settings.ai_safety_nsfw_block_threshold,
        underage_high_threshold=settings.ai_safety_minor_high_threshold,
        underage_med_threshold=settings.ai_safety_minor_med_threshold,
    )

    logger.info(
        "AI safety scan complete",
        extra={
            "asset_id": asset_id,
            "nsfw_score": round(nsfw_score, 4),
            "nsfw_label": nsfw_label,
            "age_range_prediction": age_range_prediction,
            "underage_likelihood_proxy": round(underage_proxy, 4),
            "risk_level": risk_level,
            "decision": decision,
        },
    )

    # --- Write scan row ---
    async def _write_scan() -> None:
        async with _make_session_factory()() as session:
            session.add(
                ImageSafetyScan(
                    id=uuid.uuid4(),
                    media_asset_id=media_uuid,
                    nsfw_score=nsfw_score,
                    nsfw_label=nsfw_label,
                    age_range_prediction=age_range_prediction,
                    underage_likelihood_proxy=underage_proxy,
                    risk_level=risk_level,
                    decision=decision,
                    model_versions={"nsfw": NSFW_MODEL, "age": AGE_MODEL},
                )
            )
            await session.commit()

    asyncio.run(_write_scan())

    # --- Update safety_status ---
    status_map = {"ALLOW": "allowed", "REQUIRE_REVIEW": "review", "BLOCK": "blocked"}
    asyncio.run(_update_safety_status(media_uuid, status_map[decision]))

    # --- Chain downstream tasks for allowed images ---
    if decision == "ALLOW":
        from worker.celery_app import celery_app

        celery_app.send_task(
            "ai_safety.generate_caption",
            args=[asset_id, object_key, content_type],
        )
        celery_app.send_task(
            "ai_safety.generate_tags",
            args=[asset_id],
        )

    # --- Log warning for blocked images (admin moderation UI surfaces them) ---
    if decision == "BLOCK":
        logger.warning(
            "Image BLOCKED by AI safety (requires human review)",
            extra={
                "asset_id": asset_id,
                "nsfw_score": round(nsfw_score, 4),
                "underage_likelihood_proxy": round(underage_proxy, 4),
            },
        )

    return {
        "status": decision,
        "nsfw_score": round(nsfw_score, 4),
        "underage_likelihood_proxy": round(underage_proxy, 4),
        "risk_level": risk_level,
    }


# ---------------------------------------------------------------------------
# Task 2: generate_caption
# ---------------------------------------------------------------------------


@shared_task(
    name="ai_safety.generate_caption",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    acks_late=True,
)
def generate_caption(self, asset_id: str, object_key: str, content_type: str) -> dict:
    """Generate image captions using BLIP model.

    Produces three variants: short (~15 words), medium (~30 words), promotional.
    """
    try:
        media_uuid = uuid.UUID(asset_id)
    except ValueError:
        logger.warning("Invalid asset_id: %s", asset_id)
        return {"status": "FAILED"}

    # Idempotent
    if asyncio.run(_caption_exists(media_uuid)):
        logger.info("Caption already exists, skipping", extra={"asset_id": asset_id})
        return {"status": "SKIPPED"}

    # Download image
    try:
        bucket = get_media_bucket()
        raw = get_object_bytes(bucket, object_key)
        img = Image.open(BytesIO(raw)).convert("RGB")
    except Exception as exc:
        logger.exception("Failed to download image for captioning", extra={"asset_id": asset_id})
        raise self.retry(exc=exc)

    # Generate caption
    from worker.ml.model_loader import BLIP_MODEL, get_blip_model

    import torch

    processor, model = get_blip_model()
    inputs = processor(img, return_tensors="pt")
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=50)
    raw_caption = processor.decode(out[0], skip_special_tokens=True).strip()

    # Derive variants
    caption_short = _truncate_words(raw_caption, 15)
    caption_medium = _truncate_words(raw_caption, 30)
    caption_promo = f"Check out this amazing content: {caption_short}"

    logger.info(
        "Caption generated",
        extra={"asset_id": asset_id, "raw_caption": raw_caption[:100]},
    )

    # Write to DB
    async def _write_caption() -> None:
        async with _make_session_factory()() as session:
            session.add(
                ImageCaption(
                    id=uuid.uuid4(),
                    media_asset_id=media_uuid,
                    caption_short=caption_short,
                    caption_medium=caption_medium,
                    caption_promo=caption_promo,
                    raw_caption=raw_caption,
                    model_version=BLIP_MODEL,
                )
            )
            await session.commit()

    asyncio.run(_write_caption())

    return {"status": "OK", "raw_caption": raw_caption[:200]}


def _truncate_words(text: str, max_words: int) -> str:
    """Truncate text to max_words, ending at a sentence boundary if possible."""
    words = text.split()
    if len(words) <= max_words:
        return text
    truncated = " ".join(words[:max_words])
    # Try to end at sentence boundary
    for sep in (".", "!", "?"):
        idx = truncated.rfind(sep)
        if idx > len(truncated) // 2:
            return truncated[: idx + 1]
    return truncated + "..."


# ---------------------------------------------------------------------------
# Task 3: generate_tags
# ---------------------------------------------------------------------------


@shared_task(
    name="ai_safety.generate_tags",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    acks_late=True,
)
def generate_tags(self, asset_id: str) -> dict:
    """Extract tags from caption and generate text embedding."""
    try:
        media_uuid = uuid.UUID(asset_id)
    except ValueError:
        logger.warning("Invalid asset_id: %s", asset_id)
        return {"status": "FAILED"}

    # Idempotent
    if asyncio.run(_tags_exist(media_uuid)):
        logger.info("Tags already exist, skipping", extra={"asset_id": asset_id})
        return {"status": "SKIPPED"}

    # Get caption text
    raw_caption = asyncio.run(_get_caption_text(media_uuid))
    if not raw_caption:
        logger.warning("No caption found for tag generation", extra={"asset_id": asset_id})
        return {"status": "NO_CAPTION"}

    # Extract tags from caption
    tags = _extract_tags(raw_caption)

    # Generate embedding
    from worker.ml.model_loader import SENTENCE_MODEL, get_sentence_model

    sentence_model = get_sentence_model()
    embedding = sentence_model.encode(raw_caption).tolist()

    logger.info(
        "Tags generated",
        extra={"asset_id": asset_id, "tag_count": len(tags)},
    )

    # Write to DB
    async def _write_tags() -> None:
        async with _make_session_factory()() as session:
            tag_row = ImageTag(
                id=uuid.uuid4(),
                media_asset_id=media_uuid,
                tags=tags,
                embedding_json=embedding,
                model_version=SENTENCE_MODEL,
            )
            session.add(tag_row)
            await session.commit()

            # Try to set pgvector embedding column if available
            try:
                embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
                await session.execute(
                    sa.text(
                        "UPDATE image_tags SET embedding = :emb::vector "
                        "WHERE id = :tag_id"
                    ),
                    {"emb": embedding_str, "tag_id": str(tag_row.id)},
                )
                await session.commit()
            except Exception:
                # pgvector not available — embedding_json fallback is used for search
                logger.debug("pgvector column update skipped (extension not available)")
                await session.rollback()

    asyncio.run(_write_tags())

    return {"status": "OK", "tags": tags, "embedding_dim": len(embedding)}


# ---------------------------------------------------------------------------
# Task 4: embed_query (called synchronously by API for vector search)
# ---------------------------------------------------------------------------


@shared_task(name="ai_safety.embed_query")
def embed_query(query_text: str) -> list[float]:
    """Encode a search query into a 384-dim embedding using sentence-transformers.

    This runs on the worker so the API doesn't need to load the model.
    Called synchronously with a short timeout from the search endpoint.
    """
    from worker.ml.model_loader import get_sentence_model

    model = get_sentence_model()
    embedding = model.encode(query_text).tolist()
    return embedding


def _extract_tags(caption: str) -> list[str]:
    """Extract meaningful tags from a caption string."""
    words = caption.lower().split()
    # Remove punctuation and filter
    cleaned = []
    for w in words:
        w = w.strip(".,;:!?\"'()-[]{}").strip()
        if len(w) >= 3 and w not in _STOPWORDS and w.isalpha():
            cleaned.append(w)
    # Deduplicate while preserving order
    seen: set[str] = set()
    tags: list[str] = []
    for w in cleaned:
        if w not in seen:
            seen.add(w)
            tags.append(w)
    return tags[:20]  # Cap at 20 tags
