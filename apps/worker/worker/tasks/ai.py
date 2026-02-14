"""AI image generation tasks."""

from __future__ import annotations

import asyncio
import logging
import uuid
from io import BytesIO

from PIL import Image
from celery import shared_task
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.modules.ai.models import AiImageJob
from worker.storage_io import get_media_bucket, put_object_bytes

logger = logging.getLogger(__name__)


def _mock_generate_images(prompt: str, negative_prompt: str, count: int) -> list[bytes]:
    """
    Mock provider: returns count placeholder PNG bytes.
    Replace with real AI provider adapter (e.g. Replicate, Stability) later.
    """
    images: list[bytes] = []
    for i in range(count):
        img = Image.new("RGB", (512, 512), color=(40 + i * 20, 60, 80))
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        images.append(buf.read())
    return images


async def _update_job_status(
    job_id: uuid.UUID,
    status: str,
    result_object_keys: list[str] | None = None,
) -> None:
    async with async_session_factory() as session:
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
        async with async_session_factory() as session:
            result = await session.execute(
                select(AiImageJob).where(AiImageJob.id == job_uuid).limit(1)
            )
            job = result.scalar_one_or_none()
        if not job:
            logger.warning("Job not found", extra={"job_id": job_id})
            return {"status": "FAILED", "error": "job_not_found"}

        await _update_job_status(job_uuid, "GENERATING")

        prompt = job.prompt or ""
        negative_prompt = job.negative_prompt or ""
        count = 1
        try:
            images = _mock_generate_images(prompt, negative_prompt, count)
        except Exception as e:
            logger.exception("Provider failed", extra={"job_id": job_id})
            asyncio.run(_update_job_status(job_uuid, "FAILED"))
            return {"status": "FAILED", "error": str(e)}

        bucket = get_media_bucket()
        user_id = str(job.user_id)
        prefix = f"ai/{user_id}/{job_id}"
        result_keys: list[str] = []
        for i, img_bytes in enumerate(images):
            obj_key = f"{prefix}/{i}.png"
            put_object_bytes(bucket, obj_key, img_bytes, "image/png")
            result_keys.append(obj_key)

        asyncio.run(_update_job_status(job_uuid, "READY", result_object_keys=result_keys))
        logger.info("AI images ready", extra={"job_id": job_id, "count": len(result_keys)})
        return {"status": "READY", "result_object_keys": result_keys}

    return asyncio.run(_run())
