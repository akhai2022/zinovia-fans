"""AI images and brand assets API."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import get_async_session
from app.modules.ai.schemas import (
    AiImageApplyIn,
    AiImageApplyOut,
    AiImageGenerateIn,
    AiImageGenerateOut,
    AiImageJobOut,
)
from app.modules.ai.service import (
    apply_ai_image,
    create_ai_image_job,
    get_brand_assets_urls,
    get_job,
    list_jobs,
)
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.auth.rate_limit import check_rate_limit_custom
from app.modules.media.service import generate_signed_download
from app.modules.media.storage import get_storage_client

router = APIRouter()

AI_GENERATE_RATE_LIMIT_PER_MIN = 5


@router.get("", operation_id="ai_images_list")
async def list_ai_jobs(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> list[AiImageJobOut]:
    """List last 50 jobs for current user."""
    jobs = await list_jobs(session, current_user.id, limit=50)
    storage = get_storage_client()
    out: list[AiImageJobOut] = []
    for job in jobs:
        result_urls: list[str] = []
        if job.status == "READY" and job.result_object_keys:
            result_urls = [
                generate_signed_download(storage, k)
                for k in job.result_object_keys
            ]
        out.append(
            AiImageJobOut(
                id=job.id,
                status=job.status,
                image_type=job.image_type,
                prompt_preview=(job.prompt[:200] + "..." if job.prompt and len(job.prompt) > 200 else job.prompt) if job.prompt else None,
                result_urls=result_urls,
            )
        )
    return out


@router.post("/generate", response_model=AiImageGenerateOut, operation_id="ai_images_generate")
async def generate(
    payload: AiImageGenerateIn,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> AiImageGenerateOut:
    """Create AI image job, enqueue worker. Rate limited."""
    rate_key = f"ai:generate:{current_user.id}"
    await check_rate_limit_custom(
        rate_key,
        max_count=AI_GENERATE_RATE_LIMIT_PER_MIN,
        window_seconds=60,
    )
    job = await create_ai_image_job(
        session,
        current_user.id,
        image_type=payload.image_type,
        preset=payload.preset,
        subject=payload.subject,
        vibe=payload.vibe,
        accent_color=payload.accent_color,
        count=payload.count,
    )
    from app.celery_client import enqueue_ai_generate_images
    enqueue_ai_generate_images(str(job.id))
    return AiImageGenerateOut(job_id=job.id)


@router.get("/{job_id}", response_model=AiImageJobOut, operation_id="ai_images_get")
async def get_job_detail(
    job_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> AiImageJobOut:
    """Get job status; when READY, includes presigned result URLs."""
    job = await get_job(session, job_id, current_user.id)
    if not job:
        raise AppError(status_code=404, detail="job_not_found")
    result_urls: list[str] = []
    if job.status == "READY" and job.result_object_keys:
        storage = get_storage_client()
        result_urls = [
            generate_signed_download(storage, k)
            for k in job.result_object_keys
        ]
    return AiImageJobOut(
        id=job.id,
        status=job.status,
        image_type=job.image_type,
        prompt_preview=(job.prompt[:200] + "..." if job.prompt and len(job.prompt) > 200 else job.prompt) if job.prompt else None,
        result_urls=result_urls,
    )


@router.post("/{job_id}/apply", response_model=AiImageApplyOut, operation_id="ai_images_apply")
async def apply(
    job_id: UUID,
    payload: AiImageApplyIn,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> AiImageApplyOut:
    """Apply generated image to landing.hero, creator.avatar, or creator.banner."""
    job = await get_job(session, job_id, current_user.id)
    if not job:
        raise AppError(status_code=404, detail="job_not_found")
    applied_to, object_key, public_url = await apply_ai_image(
        session,
        job,
        current_user,
        apply_to=payload.apply_to,
        result_index=payload.result_index,
    )
    return AiImageApplyOut(
        applied_to=applied_to,
        object_key=object_key,
        public_url=public_url,
    )
