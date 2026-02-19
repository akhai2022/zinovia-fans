"""AI image generation service."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.ai.models import AiImageJob, BrandAsset
from app.modules.ai.prompt_builder import build_prompt
from app.modules.auth.constants import ADMIN_ROLE
from app.modules.auth.models import Profile, User
from app.modules.auth.rate_limit import check_rate_limit_custom
from app.modules.creators.constants import CREATOR_ROLE
from app.modules.media.models import MediaObject
from app.modules.media.service import create_media_object, generate_signed_download
from app.modules.media.storage import get_storage_client

logger = logging.getLogger(__name__)

AI_GENERATE_RATE_LIMIT_PER_MIN = 5


def _preset_for_image_type(image_type: str) -> str:
    """Map image_type to default preset name."""
    return {
        "HERO": "hero_marketing",
        "AVATAR": "creator_avatar",
        "BANNER": "creator_banner",
    }.get(image_type, "creator_avatar")


async def create_ai_image_job(
    session: AsyncSession,
    user_id: UUID,
    *,
    image_type: str,
    preset: str,
    subject: str | None = None,
    vibe: str | None = None,
    accent_color: str | None = None,
    count: int = 1,
) -> AiImageJob:
    """Create QUEUED job, compose prompt from preset+inputs. Enqueue handled by router."""
    if preset not in ("hero_marketing", "creator_avatar", "creator_banner"):
        raise AppError(status_code=400, detail="unknown_preset")
    preset_used = preset or _preset_for_image_type(image_type)
    try:
        prompt, negative_prompt = build_prompt(
            preset_used,
            subject=subject,
            vibe=vibe,
            accent_color=accent_color,
        )
    except ValueError as e:
        raise AppError(status_code=400, detail=str(e)) from e

    job = AiImageJob(
        user_id=user_id,
        status="QUEUED",
        image_type=image_type,
        preset=preset_used,
        subject=subject,
        vibe=vibe,
        accent_color=accent_color,
        prompt=prompt,
        negative_prompt=negative_prompt,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


async def get_job(session: AsyncSession, job_id: UUID, user_id: UUID) -> AiImageJob | None:
    result = await session.execute(
        select(AiImageJob).where(
            AiImageJob.id == job_id,
            AiImageJob.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def list_jobs(session: AsyncSession, user_id: UUID, limit: int = 50) -> list[AiImageJob]:
    result = await session.execute(
        select(AiImageJob)
        .where(AiImageJob.user_id == user_id)
        .order_by(AiImageJob.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().unique().all())


async def get_brand_asset(session: AsyncSession, key: str) -> BrandAsset | None:
    result = await session.execute(select(BrandAsset).where(BrandAsset.key == key))
    return result.scalar_one_or_none()


def _can_apply_landing_hero(user: User) -> bool:
    settings = get_settings()
    return user.role == ADMIN_ROLE or settings.allow_brand_asset_write


async def apply_ai_image(
    session: AsyncSession,
    job: AiImageJob,
    user: User,
    apply_to: str,
    result_index: int,
) -> tuple[str, str, str]:
    """
    Apply AI result to placement. Returns (applied_to, object_key, public_url).
    Raises AppError on validation failure.
    """
    if job.status != "READY":
        raise AppError(status_code=400, detail="job_not_ready")
    keys = job.result_object_keys or []
    if result_index >= len(keys):
        raise AppError(status_code=400, detail="invalid_result_index")
    object_key = keys[result_index]

    storage = get_storage_client()
    public_url = generate_signed_download(storage, object_key)

    if apply_to == "landing.hero":
        if not _can_apply_landing_hero(user):
            raise AppError(status_code=403, detail="insufficient_role")
        asset = await get_brand_asset(session, "landing.hero")
        if not asset:
            asset = BrandAsset(key="landing.hero", value_object_key=None)
            session.add(asset)
        asset.value_object_key = object_key
        asset.updated_by_user_id = user.id
        await session.commit()
        return ("landing.hero", object_key, public_url)

    if apply_to in ("creator.avatar", "creator.banner"):
        if user.role not in (CREATOR_ROLE, "admin"):
            raise AppError(status_code=403, detail="creator_role_required")
        profile_result = await session.execute(
            select(Profile).where(Profile.user_id == user.id)
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            raise AppError(status_code=404, detail="profile_not_found")

        # Get or create MediaObject for AI image (object already in S3)
        existing = await session.execute(
            select(MediaObject).where(
                MediaObject.object_key == object_key,
                MediaObject.owner_user_id == user.id,
            ).limit(1)
        )
        media = existing.scalar_one_or_none()
        if not media:
            media = await create_media_object(
                session,
                owner_user_id=user.id,
                object_key=object_key,
                content_type="image/png",
                size_bytes=0,  # Not critical for display
            )
        if apply_to == "creator.avatar":
            profile.avatar_asset_id = media.id
        else:
            profile.banner_asset_id = media.id
        await session.commit()
        return (apply_to, object_key, public_url)

    raise AppError(status_code=400, detail="unknown_apply_to")


async def get_brand_assets_urls(session: AsyncSession) -> dict[str, str | None]:
    """Return {key: presigned_url or None} for known brand keys."""
    result = await session.execute(
        select(BrandAsset).where(BrandAsset.key.in_(["landing.hero"]))
    )
    rows = result.scalars().unique().all()
    assets = {r.key: r for r in rows}
    storage = get_storage_client()
    out: dict[str, str | None] = {}
    for key in ["landing.hero"]:
        asset = assets.get(key)
        if asset and asset.value_object_key:
            out[key] = generate_signed_download(storage, asset.value_object_key)
        else:
            out[key] = None
    return out
