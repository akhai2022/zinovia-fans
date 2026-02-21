"""AI image generation tasks."""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from io import BytesIO

from PIL import Image
from celery import shared_task
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.settings import get_settings
from app.modules.ai.models import AiImageJob
from worker.storage_io import get_media_bucket, put_object_bytes

logger = logging.getLogger(__name__)

# Aspect ratios per image type (Imagen 4 uses aspect_ratio, not width/height)
ASPECT_RATIOS: dict[str, str] = {
    "HERO": "16:9",
    "AVATAR": "1:1",
    "BANNER": "16:9",
}

DEFAULT_ASPECT_RATIO = "1:1"

# Fallback pixel sizes for mock provider
IMAGE_SIZES: dict[str, tuple[int, int]] = {
    "HERO": (1792, 1024),
    "AVATAR": (1024, 1024),
    "BANNER": (1792, 1024),
}

DEFAULT_SIZE = (1024, 1024)


def _mock_generate_images(
    prompt: str, negative_prompt: str, count: int, width: int, height: int
) -> list[bytes]:
    """Mock provider: returns placeholder PNGs. Used when AI_PROVIDER=mock."""
    images: list[bytes] = []
    for i in range(count):
        img = Image.new("RGB", (width, height), color=(40 + i * 20, 60, 80))
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        images.append(buf.read())
    return images


def _replicate_generate_images(
    prompt: str, negative_prompt: str, count: int, aspect_ratio: str
) -> list[bytes]:
    """Generate images via Replicate (Google Imagen 4). Returns list of PNG bytes."""
    import httpx
    import replicate

    token = os.environ.get("REPLICATE_API_TOKEN", "")
    if not token:
        raise RuntimeError("REPLICATE_API_TOKEN not set")

    os.environ["REPLICATE_API_TOKEN"] = token

    images: list[bytes] = []
    for _ in range(count):
        output = replicate.run(
            "google/imagen-4",
            input={
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "safety_filter_level": "block_medium_and_above",
            },
        )

        # Imagen 4 returns a single FileOutput or URL
        if isinstance(output, (list, tuple)):
            url = output[0] if output else None
        else:
            url = output

        if not url:
            raise RuntimeError("Replicate returned no image")

        with httpx.Client(timeout=120) as client:
            r = client.get(str(url))
            r.raise_for_status()
            images.append(r.content)

    return images


def _make_session_factory() -> async_sessionmaker[AsyncSession]:
    """Create a fresh async session factory per task invocation.

    Avoids the 'Future attached to a different loop' error that occurs when
    a module-level engine is reused across separate asyncio.run() calls in
    Celery forked worker processes.
    """
    engine = create_async_engine(str(get_settings().database_url), pool_pre_ping=True)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def _update_job_status(
    session_factory: async_sessionmaker[AsyncSession],
    job_id: uuid.UUID,
    status: str,
    result_object_keys: list[str] | None = None,
) -> None:
    async with session_factory() as session:
        values: dict = {"status": status}
        if result_object_keys is not None:
            values["result_object_keys"] = result_object_keys
        await session.execute(
            update(AiImageJob).where(AiImageJob.id == job_id).values(**values)
        )
        await session.commit()


@shared_task(name="ai.generate_images")
def generate_images(job_id: str) -> dict[str, str | list[str]]:
    """
    Generate AI images for job, upload to S3, set READY.
    On error set FAILED.
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        logger.warning("Invalid job_id", extra={"job_id": job_id})
        return {"status": "FAILED", "error": "invalid_job_id"}

    async def _run() -> dict[str, str | list[str]]:
        sf = _make_session_factory()
        async with sf() as session:
            result = await session.execute(
                select(AiImageJob).where(AiImageJob.id == job_uuid).limit(1)
            )
            job = result.scalar_one_or_none()
        if not job:
            logger.warning("Job not found", extra={"job_id": job_id})
            return {"status": "FAILED", "error": "job_not_found"}

        await _update_job_status(sf, job_uuid, "GENERATING")

        prompt = job.prompt or ""
        negative_prompt = job.negative_prompt or ""
        image_type = (job.image_type or "").upper()
        aspect_ratio = ASPECT_RATIOS.get(image_type, DEFAULT_ASPECT_RATIO)
        width, height = IMAGE_SIZES.get(image_type, DEFAULT_SIZE)
        count = 1

        try:
            provider = os.environ.get("AI_PROVIDER", "mock")
            if provider == "replicate":
                images = _replicate_generate_images(
                    prompt, negative_prompt, count, aspect_ratio
                )
            else:
                images = _mock_generate_images(
                    prompt, negative_prompt, count, width, height
                )
        except Exception as e:
            logger.exception("Provider failed", extra={"job_id": job_id})
            await _update_job_status(sf, job_uuid, "FAILED")
            return {"status": "FAILED", "error": str(e)[:500]}

        bucket = get_media_bucket()
        user_id = str(job.user_id)
        prefix = f"ai/{user_id}/{job_id}"
        result_keys: list[str] = []
        for i, img_bytes in enumerate(images):
            obj_key = f"{prefix}/{i}.png"
            put_object_bytes(bucket, obj_key, img_bytes, "image/png")
            result_keys.append(obj_key)

        await _update_job_status(sf, job_uuid, "READY", result_object_keys=result_keys)
        logger.info("AI images ready", extra={"job_id": job_id, "count": len(result_keys)})
        return {"status": "READY", "result_object_keys": result_keys}

    return asyncio.run(_run())
