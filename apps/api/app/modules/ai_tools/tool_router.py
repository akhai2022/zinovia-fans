"""AI tool endpoints — remove-bg, cartoonize, animate-image, auto-caption, virtual-tryon, image-ref."""

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
    AnimateImageRequest,
    AnimateImageResponse,
    AnimateImageStatusOut,
    AutoCaptionRequest,
    AutoCaptionResponse,
    AutoCaptionStatusOut,
    CartoonizeRequest,
    CartoonizeResponse,
    CartoonizeStatusOut,
    ImageRefCreateRequest,
    ImageRefCreateResponse,
    ImageRefResolveResponse,
    RemoveBgRequest,
    RemoveBgResponse,
    RemoveBgStatusOut,
    VirtualTryOnRequest,
    VirtualTryOnResponse,
    VirtualTryOnStatusOut,
)
from app.modules.ai_tools.tool_service import (
    create_image_ref,
    create_tool_job,
    get_tool_job,
    resolve_image_ref,
)
from app.modules.audit.service import (
    ACTION_AI_IMAGE_REF_CREATE,
    ACTION_AI_TOOL_ANIMATE_IMAGE,
    ACTION_AI_TOOL_AUTO_CAPTION,
    ACTION_AI_TOOL_CARTOONIZE,
    ACTION_AI_TOOL_REMOVE_BG,
    ACTION_AI_TOOL_VIRTUAL_TRYON,
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
# Cartoon Avatar
# ---------------------------------------------------------------------------


def _require_cartoon_avatar() -> None:
    settings = get_settings()
    if not settings.enable_ai_tools or not settings.enable_cartoon_avatar:
        raise AppError(status_code=404, detail="feature_disabled")


@router.post(
    "/cartoonize",
    response_model=CartoonizeResponse,
    operation_id="ai_tools_cartoonize",
)
async def cartoonize(
    body: CartoonizeRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> CartoonizeResponse:
    """Submit a cartoon-avatar job. Rate limited per day."""
    _require_cartoon_avatar()
    settings = get_settings()
    await check_rate_limit_custom(
        f"ai:tool:cartoon:{user.id}",
        max_count=settings.ai_tool_cartoon_daily_limit,
        window_seconds=86400,
    )
    media = await _verify_media_ownership(session, body.media_asset_id, user)

    job = await create_tool_job(
        session,
        user_id=user.id,
        tool="cartoonize",
        input_object_key=media.object_key,
        input_media_asset_id=media.id,
    )
    await session.commit()

    from app.celery_client import enqueue_cartoonize

    enqueue_cartoonize(str(job.id))

    await log_audit_event(
        session,
        action=ACTION_AI_TOOL_CARTOONIZE,
        actor_id=user.id,
        resource_type="ai_tool_job",
        resource_id=str(job.id),
        metadata={"tool": "cartoonize", "media_asset_id": str(media.id)},
    )

    return CartoonizeResponse(job_id=job.id, status="processing")


@router.get(
    "/cartoonize/{job_id}",
    response_model=CartoonizeStatusOut,
    operation_id="ai_tools_cartoonize_status",
)
async def cartoonize_status(
    job_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> CartoonizeStatusOut:
    """Poll cartoon-avatar job status. When ready, includes presigned result URL."""
    _require_cartoon_avatar()
    job = await get_tool_job(session, job_id, user.id)
    if not job:
        raise AppError(status_code=404, detail="job_not_found")

    result_url: str | None = None
    if job.status == "ready" and job.result_object_key:
        storage = get_storage_client()
        result_url = generate_signed_download(storage, job.result_object_key)

    return CartoonizeStatusOut(
        job_id=job.id,
        status=job.status,
        result_url=result_url,
        error=job.error_message,
    )


# ---------------------------------------------------------------------------
# Animate Image
# ---------------------------------------------------------------------------


def _require_animate_image() -> None:
    settings = get_settings()
    if not settings.enable_ai_tools or not settings.enable_animate_image:
        raise AppError(status_code=404, detail="feature_disabled")


VALID_MOTION_PRESETS = {"gentle", "dynamic", "zoom"}
VALID_OUTPUT_FORMATS = {"mp4", "gif"}


@router.post(
    "/animate-image",
    response_model=AnimateImageResponse,
    operation_id="ai_tools_animate_image",
)
async def animate_image(
    body: AnimateImageRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> AnimateImageResponse:
    """Submit an animate-image job. Rate limited per day."""
    _require_animate_image()
    settings = get_settings()
    await check_rate_limit_custom(
        f"ai:tool:animate:{user.id}",
        max_count=settings.ai_tool_animate_daily_limit,
        window_seconds=86400,
    )
    media = await _verify_media_ownership(session, body.media_asset_id, user)

    # Validate params
    if body.motion_preset not in VALID_MOTION_PRESETS:
        raise AppError(status_code=422, detail="invalid_motion_preset")
    if body.num_frames < 7 or body.num_frames > 25:
        raise AppError(status_code=422, detail="num_frames must be 7-25")
    if body.fps not in (4, 7, 12):
        raise AppError(status_code=422, detail="fps must be 4, 7, or 12")
    if body.output_format not in VALID_OUTPUT_FORMATS:
        raise AppError(status_code=422, detail="invalid_output_format")

    params = {
        "motion_preset": body.motion_preset,
        "num_frames": body.num_frames,
        "fps": body.fps,
        "output_format": body.output_format,
    }

    job = await create_tool_job(
        session,
        user_id=user.id,
        tool="animate_image",
        input_object_key=media.object_key,
        input_media_asset_id=media.id,
        params=params,
    )
    await session.commit()

    from app.celery_client import enqueue_animate_image

    enqueue_animate_image(str(job.id))

    await log_audit_event(
        session,
        action=ACTION_AI_TOOL_ANIMATE_IMAGE,
        actor_id=user.id,
        resource_type="ai_tool_job",
        resource_id=str(job.id),
        metadata={"tool": "animate_image", "media_asset_id": str(media.id), **params},
    )

    return AnimateImageResponse(job_id=job.id, status="processing")


@router.get(
    "/animate-image/{job_id}",
    response_model=AnimateImageStatusOut,
    operation_id="ai_tools_animate_image_status",
)
async def animate_image_status(
    job_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> AnimateImageStatusOut:
    """Poll animate-image job status. When ready, includes presigned result URL."""
    _require_animate_image()
    job = await get_tool_job(session, job_id, user.id)
    if not job:
        raise AppError(status_code=404, detail="job_not_found")

    result_url: str | None = None
    if job.status == "ready" and job.result_object_key:
        storage = get_storage_client()
        result_url = generate_signed_download(storage, job.result_object_key)

    return AnimateImageStatusOut(
        job_id=job.id,
        status=job.status,
        result_url=result_url,
        error=job.error_message,
    )


# ---------------------------------------------------------------------------
# Auto Caption
# ---------------------------------------------------------------------------


def _require_auto_caption() -> None:
    settings = get_settings()
    if not settings.enable_ai_tools or not settings.enable_auto_caption:
        raise AppError(status_code=404, detail="feature_disabled")


VALID_CAPTION_MODES = {"short", "detailed", "alt_text"}
VALID_CAPTION_TONES = {"neutral", "playful", "flirty", "professional"}
VALID_CAPTION_QUALITY = {"fast", "better"}
VALID_CAPTION_LANGUAGES = {"en", "fr"}


@router.post(
    "/auto-caption",
    response_model=AutoCaptionResponse,
    operation_id="ai_tools_auto_caption",
)
async def auto_caption(
    body: AutoCaptionRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> AutoCaptionResponse:
    """Submit an auto-caption job. Rate limited per day."""
    _require_auto_caption()
    settings = get_settings()
    await check_rate_limit_custom(
        f"ai:tool:caption:{user.id}",
        max_count=settings.ai_tool_caption_daily_limit,
        window_seconds=86400,
    )
    media = await _verify_media_ownership(session, body.media_asset_id, user)

    # Validate params
    if body.mode not in VALID_CAPTION_MODES:
        raise AppError(status_code=422, detail="invalid_mode")
    if body.tone not in VALID_CAPTION_TONES:
        raise AppError(status_code=422, detail="invalid_tone")
    if body.quality not in VALID_CAPTION_QUALITY:
        raise AppError(status_code=422, detail="invalid_quality")
    if body.language not in VALID_CAPTION_LANGUAGES:
        raise AppError(status_code=422, detail="invalid_language")

    # Validate image content type
    if not media.content_type or not media.content_type.startswith("image/"):
        raise AppError(status_code=422, detail="image_required")

    params = {
        "mode": body.mode,
        "tone": body.tone,
        "quality": body.quality,
        "include_keywords": body.include_keywords,
        "language": body.language,
    }

    job = await create_tool_job(
        session,
        user_id=user.id,
        tool="auto_caption",
        input_object_key=media.object_key,
        input_media_asset_id=media.id,
        params=params,
    )
    await session.commit()

    from app.celery_client import enqueue_auto_caption

    enqueue_auto_caption(str(job.id))

    await log_audit_event(
        session,
        action=ACTION_AI_TOOL_AUTO_CAPTION,
        actor_id=user.id,
        resource_type="ai_tool_job",
        resource_id=str(job.id),
        metadata={"tool": "auto_caption", "media_asset_id": str(media.id), **params},
    )

    return AutoCaptionResponse(job_id=job.id, status="processing")


@router.get(
    "/auto-caption/{job_id}",
    response_model=AutoCaptionStatusOut,
    operation_id="ai_tools_auto_caption_status",
)
async def auto_caption_status(
    job_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> AutoCaptionStatusOut:
    """Poll auto-caption job status. When ready, includes caption result."""
    _require_auto_caption()
    job = await get_tool_job(session, job_id, user.id)
    if not job:
        raise AppError(status_code=404, detail="job_not_found")

    result: dict | None = None
    if job.status == "ready" and job.params and "result" in job.params:
        result = job.params["result"]

    return AutoCaptionStatusOut(
        job_id=job.id,
        status=job.status,
        result=result,
        error=job.error_message,
    )


# ---------------------------------------------------------------------------
# Virtual Try-On
# ---------------------------------------------------------------------------


def _require_virtual_tryon() -> None:
    settings = get_settings()
    if not settings.enable_ai_tools or not settings.enable_virtual_tryon:
        raise AppError(status_code=404, detail="feature_disabled")


VALID_TRYON_CATEGORIES = {"upper_body", "lower_body", "full_body"}


@router.post(
    "/virtual-tryon",
    response_model=VirtualTryOnResponse,
    operation_id="ai_tools_virtual_tryon",
)
async def virtual_tryon(
    body: VirtualTryOnRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> VirtualTryOnResponse:
    """Submit a virtual try-on job. Requires person photo + garment image. Rate limited per day."""
    _require_virtual_tryon()
    settings = get_settings()
    await check_rate_limit_custom(
        f"ai:tool:tryon:{user.id}",
        max_count=settings.ai_tool_tryon_daily_limit,
        window_seconds=86400,
    )

    if body.category not in VALID_TRYON_CATEGORIES:
        raise AppError(status_code=422, detail="invalid_category")

    person_media = await _verify_media_ownership(session, body.person_media_asset_id, user)
    garment_media = await _verify_media_ownership(session, body.garment_media_asset_id, user)

    params = {
        "garment_object_key": garment_media.object_key,
        "garment_media_asset_id": str(garment_media.id),
        "category": body.category,
    }

    job = await create_tool_job(
        session,
        user_id=user.id,
        tool="virtual_tryon",
        input_object_key=person_media.object_key,
        input_media_asset_id=person_media.id,
        params=params,
    )
    await session.commit()

    from app.celery_client import enqueue_virtual_tryon

    enqueue_virtual_tryon(str(job.id))

    await log_audit_event(
        session,
        action=ACTION_AI_TOOL_VIRTUAL_TRYON,
        actor_id=user.id,
        resource_type="ai_tool_job",
        resource_id=str(job.id),
        metadata={
            "tool": "virtual_tryon",
            "person_media_asset_id": str(person_media.id),
            "garment_media_asset_id": str(garment_media.id),
            "category": body.category,
        },
    )

    return VirtualTryOnResponse(job_id=job.id, status="processing")


@router.get(
    "/virtual-tryon/{job_id}",
    response_model=VirtualTryOnStatusOut,
    operation_id="ai_tools_virtual_tryon_status",
)
async def virtual_tryon_status(
    job_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> VirtualTryOnStatusOut:
    """Poll virtual try-on job status. When ready, includes presigned result URL."""
    _require_virtual_tryon()
    job = await get_tool_job(session, job_id, user.id)
    if not job:
        raise AppError(status_code=404, detail="job_not_found")

    result_url: str | None = None
    if job.status == "ready" and job.result_object_key:
        storage = get_storage_client()
        result_url = generate_signed_download(storage, job.result_object_key)

    return VirtualTryOnStatusOut(
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
