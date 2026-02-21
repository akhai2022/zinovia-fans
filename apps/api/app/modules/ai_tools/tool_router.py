"""AI tool endpoints — remove-bg, image-ref, (cartoonize in follow-up PR)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.auth.rate_limit import check_rate_limit_custom
from app.modules.media.models import MediaObject
from app.modules.media.service import generate_signed_download
from app.modules.media.storage import get_storage_client
from app.modules.ai_tools.tool_models import AiToolJob
from app.modules.ai_tools.tool_schemas import (
    ImageRefCreateRequest,
    ImageRefCreateResponse,
    ImageRefResolveResponse,
    RemoveBgRequest,
    RemoveBgResponse,
    RemoveBgStatusOut,
)
from app.modules.ai_tools.tool_service import (
    create_image_ref,
    create_tool_job,
    get_tool_job,
    resolve_image_ref,
)
from app.modules.audit.service import (
    ACTION_AI_IMAGE_REF_CREATE,
    ACTION_AI_TOOL_REMOVE_BG,
    log_audit_event,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_ai_tools() -> None:
    if not get_settings().enable_ai_tools:
        raise AppError(status_code=404, detail="feature_disabled")


async def _verify_media_ownership(
    session: AsyncSession, media_asset_id: UUID, user: User
) -> MediaObject:
    r = await session.execute(
        select(MediaObject).where(
            MediaObject.id == media_asset_id,
            MediaObject.owner_user_id == user.id,
        )
    )
    media = r.scalar_one_or_none()
    if not media:
        raise AppError(status_code=404, detail="media_not_found")
    return media


# ---------------------------------------------------------------------------
# Remove Background
# ---------------------------------------------------------------------------


@router.post(
    "/remove-bg",
    response_model=RemoveBgResponse,
    operation_id="ai_tools_remove_bg",
)
async def remove_bg(
    body: RemoveBgRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> RemoveBgResponse:
    """Submit a remove-background job. Rate limited per day."""
    _require_ai_tools()
    settings = get_settings()
    await check_rate_limit_custom(
        f"ai:tool:rmbg:{user.id}",
        max_count=settings.ai_tool_rmbg_daily_limit,
        window_seconds=86400,
    )
    media = await _verify_media_ownership(session, body.media_asset_id, user)

    job = await create_tool_job(
        session,
        user_id=user.id,
        tool="remove_bg",
        input_object_key=media.object_key,
        input_media_asset_id=media.id,
    )
    await session.commit()

    from app.celery_client import enqueue_remove_background

    enqueue_remove_background(str(job.id))

    await log_audit_event(
        session,
        action=ACTION_AI_TOOL_REMOVE_BG,
        actor_id=user.id,
        resource_type="ai_tool_job",
        resource_id=str(job.id),
        metadata={"tool": "remove_bg", "media_asset_id": str(media.id)},
    )

    return RemoveBgResponse(job_id=job.id, status="processing")


@router.get(
    "/remove-bg/{job_id}",
    response_model=RemoveBgStatusOut,
    operation_id="ai_tools_remove_bg_status",
)
async def remove_bg_status(
    job_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> RemoveBgStatusOut:
    """Poll job status. When ready, includes presigned result URL."""
    _require_ai_tools()
    job = await get_tool_job(session, job_id, user.id)
    if not job:
        raise AppError(status_code=404, detail="job_not_found")

    result_url: str | None = None
    if job.status == "ready" and job.result_object_key:
        storage = get_storage_client()
        result_url = generate_signed_download(storage, job.result_object_key)

    return RemoveBgStatusOut(
        job_id=job.id,
        status=job.status,
        result_url=result_url,
        error=job.error_message,
    )


# ---------------------------------------------------------------------------
# Image Ref (deep-link tokens)
# ---------------------------------------------------------------------------


@router.post(
    "/image-ref",
    response_model=ImageRefCreateResponse,
    operation_id="ai_tools_create_image_ref",
)
async def create_image_ref_endpoint(
    body: ImageRefCreateRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> ImageRefCreateResponse:
    """Create an ephemeral token to deep-link an image into an AI tool page."""
    _require_ai_tools()
    await _verify_media_ownership(session, body.media_asset_id, user)

    ref = await create_image_ref(session, user.id, body.media_asset_id)
    await session.commit()

    await log_audit_event(
        session,
        action=ACTION_AI_IMAGE_REF_CREATE,
        actor_id=user.id,
        resource_type="ai_image_ref",
        resource_id=str(ref.id),
        metadata={"media_asset_id": str(body.media_asset_id)},
    )

    return ImageRefCreateResponse(token=ref.token, expires_at=ref.expires_at)


@router.get(
    "/image-ref/{token}",
    response_model=ImageRefResolveResponse,
    operation_id="ai_tools_resolve_image_ref",
)
async def resolve_image_ref_endpoint(
    token: str,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> ImageRefResolveResponse:
    """Resolve an image-ref token to a presigned download URL."""
    _require_ai_tools()
    ref = await resolve_image_ref(session, token, user.id)
    if not ref:
        raise AppError(status_code=404, detail="ref_not_found")

    now = datetime.now(timezone.utc)
    if ref.expires_at < now:
        raise AppError(status_code=410, detail="ref_expired")

    # Look up the media to get its object_key
    r = await session.execute(
        select(MediaObject).where(MediaObject.id == ref.media_asset_id)
    )
    media = r.scalar_one_or_none()
    if not media:
        raise AppError(status_code=404, detail="media_not_found")

    storage = get_storage_client()
    download_url = generate_signed_download(storage, media.object_key)

    return ImageRefResolveResponse(
        media_asset_id=str(ref.media_asset_id),
        download_url=download_url,
    )
