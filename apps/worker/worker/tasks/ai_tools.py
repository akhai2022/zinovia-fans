"""AI tool worker tasks — remove background, cartoonize.

Pattern follows worker/tasks/media.py:
- _make_session_factory() for per-task DB sessions
- get_object_bytes / put_object_bytes for S3 I/O
- Idempotent: check job status before processing
- Try/except → update status="failed" with error_message
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from io import BytesIO

from celery import shared_task
from PIL import Image
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.settings import get_settings
from worker.storage_io import get_media_bucket, get_object_bytes, put_object_bytes

logger = logging.getLogger(__name__)

MAX_DIMENSION = 4096


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(str(get_settings().database_url), pool_pre_ping=True)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def _strip_exif(img: Image.Image) -> Image.Image:
    out = img.copy()
    out.info.clear()
    return out


def _result_object_key(job_id: str, ext: str = "png") -> str:
    return f"ai-tools/{job_id}/result.{ext}"


async def _load_job(job_id: str) -> dict | None:
    """Load job row as dict. Returns None if not found."""
    from app.modules.ai_tools.tool_models import AiToolJob

    async with _make_session_factory()() as session:
        r = await session.execute(
            select(AiToolJob).where(AiToolJob.id == uuid.UUID(job_id))
        )
        job = r.scalar_one_or_none()
        if not job:
            return None
        return {
            "id": job.id,
            "status": job.status,
            "input_object_key": job.input_object_key,
            "tool": job.tool,
        }


async def _update_job(
    job_id: str,
    status: str,
    result_object_key: str | None = None,
    error_message: str | None = None,
) -> None:
    from datetime import datetime, timezone

    from app.modules.ai_tools.tool_models import AiToolJob

    async with _make_session_factory()() as session:
        await session.execute(
            update(AiToolJob)
            .where(AiToolJob.id == uuid.UUID(job_id))
            .values(
                status=status,
                result_object_key=result_object_key,
                error_message=error_message,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()


@shared_task(name="ai_tools.remove_background")
def remove_background(job_id: str) -> str | None:
    """Remove background from an image using rembg (ONNX CPU).

    1. Load job from DB, check idempotency
    2. Download input image from S3
    3. Validate dimensions (max 4096x4096)
    4. Run rembg.remove()
    5. Strip EXIF, upload PNG result to S3
    6. Update job status
    """
    logger.info("remove_background START", extra={"job_id": job_id})

    # Load job
    job = asyncio.run(_load_job(job_id))
    if not job:
        logger.warning("Job not found", extra={"job_id": job_id})
        return None

    # Idempotent: skip if already processed
    if job["status"] in ("ready", "processing"):
        logger.info("Job already %s, skipping", job["status"], extra={"job_id": job_id})
        return None

    # Mark as processing
    asyncio.run(_update_job(job_id, "processing"))

    try:
        bucket = get_media_bucket()
        raw = get_object_bytes(bucket, job["input_object_key"])
        img = Image.open(BytesIO(raw)).convert("RGBA")

        # Validate dimensions
        w, h = img.size
        if w > MAX_DIMENSION or h > MAX_DIMENSION:
            raise ValueError(f"Image too large: {w}x{h} (max {MAX_DIMENSION}x{MAX_DIMENSION})")

        # Run background removal
        from rembg import remove

        result_img = remove(img)
        result_img = _strip_exif(result_img)

        # Encode as PNG (preserves alpha)
        buf = BytesIO()
        result_img.save(buf, format="PNG")
        buf.seek(0)

        result_key = _result_object_key(job_id)
        put_object_bytes(bucket, result_key, buf.getvalue(), "image/png")

        asyncio.run(_update_job(job_id, "ready", result_object_key=result_key))
        logger.info("remove_background DONE", extra={"job_id": job_id, "result_key": result_key})
        return result_key

    except Exception as e:
        logger.exception("remove_background FAILED", extra={"job_id": job_id})
        asyncio.run(_update_job(job_id, "failed", error_message=str(e)[:500]))
        return None


# ---------------------------------------------------------------------------
# Cartoonize (OpenCV edge-preserving filter — CPU-only, no ML model)
# ---------------------------------------------------------------------------

# Downscale large images before processing to limit CPU time.
CARTOON_MAX_DIM = 2048


def _cartoonize_image(img: Image.Image) -> Image.Image:
    """Apply cartoon effect using OpenCV bilateral filter + adaptive threshold edges.

    Pipeline:
    1. Downscale if needed (cap at CARTOON_MAX_DIM)
    2. Bilateral filter for flat colour regions (preserves edges)
    3. Adaptive threshold on grayscale for bold edges
    4. Combine: colour * edge mask
    """
    import cv2
    import numpy as np

    # Convert PIL → OpenCV BGR
    rgb = img.convert("RGB")
    arr = np.array(rgb)
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

    # Downscale if needed
    h, w = bgr.shape[:2]
    scale = 1.0
    if max(h, w) > CARTOON_MAX_DIM:
        scale = CARTOON_MAX_DIM / max(h, w)
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # 1. Bilateral filter: smooth colour while preserving edges
    #    Apply multiple passes for stronger cartoon effect
    colour = bgr
    for _ in range(3):
        colour = cv2.bilateralFilter(colour, d=9, sigmaColor=75, sigmaSpace=75)

    # 2. Edge detection via adaptive threshold on grayscale
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 7)
    edges = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, blockSize=9, C=2
    )
    # Convert edges to 3-channel mask
    edges_3ch = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)

    # 3. Combine: colour AND edges (edges are white=255 where no edge, black=0 at edges)
    cartoon = cv2.bitwise_and(colour, edges_3ch)

    # Convert back to PIL RGB
    result_rgb = cv2.cvtColor(cartoon, cv2.COLOR_BGR2RGB)
    return Image.fromarray(result_rgb)


@shared_task(name="ai_tools.cartoonize")
def cartoonize(job_id: str) -> str | None:
    """Apply cartoon effect to an image using OpenCV (CPU-only).

    1. Load job from DB, check idempotency
    2. Download input image from S3
    3. Validate dimensions (max 4096x4096)
    4. Apply cartoon effect (bilateral filter + edge detection)
    5. Strip EXIF, upload JPEG result to S3
    6. Update job status
    """
    logger.info("cartoonize START", extra={"job_id": job_id})

    job = asyncio.run(_load_job(job_id))
    if not job:
        logger.warning("Job not found", extra={"job_id": job_id})
        return None

    if job["status"] in ("ready", "processing"):
        logger.info("Job already %s, skipping", job["status"], extra={"job_id": job_id})
        return None

    asyncio.run(_update_job(job_id, "processing"))

    try:
        bucket = get_media_bucket()
        raw = get_object_bytes(bucket, job["input_object_key"])
        img = Image.open(BytesIO(raw)).convert("RGB")

        w, h = img.size
        if w > MAX_DIMENSION or h > MAX_DIMENSION:
            raise ValueError(f"Image too large: {w}x{h} (max {MAX_DIMENSION}x{MAX_DIMENSION})")

        result_img = _cartoonize_image(img)
        result_img = _strip_exif(result_img)

        buf = BytesIO()
        result_img.save(buf, format="JPEG", quality=90)
        buf.seek(0)

        result_key = _result_object_key(job_id, ext="jpg")
        put_object_bytes(bucket, result_key, buf.getvalue(), "image/jpeg")

        asyncio.run(_update_job(job_id, "ready", result_object_key=result_key))
        logger.info("cartoonize DONE", extra={"job_id": job_id, "result_key": result_key})
        return result_key

    except Exception as e:
        logger.exception("cartoonize FAILED", extra={"job_id": job_id})
        asyncio.run(_update_job(job_id, "failed", error_message=str(e)[:500]))
        return None
