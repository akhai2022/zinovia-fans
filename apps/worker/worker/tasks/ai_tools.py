"""AI tool worker tasks — remove background, (cartoonize in follow-up PR).

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
