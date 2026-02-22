"""AI tools API endpoints — promo copy generator."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.auth.constants import ADMIN_ROLE, SUPER_ADMIN_ROLE
from app.modules.posts.models import Post, PostMedia
from app.modules.media.models import MediaObject
from app.modules.ai_tools.models import PostPromoSuggestion
from app.modules.ai_tools.schemas import (
    PromoGenerateRequest,
    PromoListOut,
    PromoPreviewOut,
    PromoPreviewRequest,
    PromoSuggestionOut,
)
from app.modules.ai_tools.service import get_promo_suggestions, upsert_promo_suggestion
from app.modules.ai_tools.promo_engine import generate_promo

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_promo_generator() -> None:
    if not get_settings().enable_promo_generator:
        raise AppError(status_code=404, detail="feature_disabled")


async def _verify_post_ownership(
    session: AsyncSession, post_id: UUID, user: User
) -> Post:
    """Check that the user owns the post, or is admin. Returns the post."""
    r = await session.execute(
        select(Post).where(Post.id == post_id).limit(1)
    )
    post = r.scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")
    if user.role not in (ADMIN_ROLE, SUPER_ADMIN_ROLE) and post.creator_user_id != user.id:
        raise AppError(status_code=404, detail="post_not_found")
    return post


async def _get_post_tags(session: AsyncSession, post_id: UUID) -> list[str]:
    """Fetch AI-extracted tags for the first media asset of a post (if any)."""
    try:
        from app.modules.ai_safety.models import ImageTag

        # Get first media asset
        r = await session.execute(
            select(PostMedia.media_asset_id)
            .where(PostMedia.post_id == post_id)
            .order_by(PostMedia.position)
            .limit(1)
        )
        media_id = r.scalar_one_or_none()
        if not media_id:
            return []

        r2 = await session.execute(
            select(ImageTag.tags).where(ImageTag.media_asset_id == media_id).limit(1)
        )
        tags_json = r2.scalar_one_or_none()
        if tags_json and isinstance(tags_json, list):
            return tags_json
    except Exception:
        pass
    return []


@router.post(
    "/promo/generate",
    response_model=PromoSuggestionOut,
    operation_id="ai_tools_generate_promo",
)
async def generate_promo_endpoint(
    body: PromoGenerateRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> PromoSuggestionOut:
    """Generate promotional copy for a post using templates + tone presets."""
    _require_promo_generator()
    post = await _verify_post_ownership(session, body.post_id, user)

    caption = post.caption or ""
    tags = await _get_post_tags(session, body.post_id)

    result = generate_promo(caption=caption, tone=body.tone, tags=tags)

    row = await upsert_promo_suggestion(
        session, body.post_id, body.tone, result, caption or None
    )
    await session.commit()

    return PromoSuggestionOut(
        id=row.id,
        post_id=row.post_id,
        tone=row.tone,
        title=row.title,
        description=row.description,
        cta_lines=row.cta_lines,
        hashtags=row.hashtags,
        source_caption=row.source_caption,
        created_at=row.created_at,
    )


@router.get(
    "/promo/{post_id}",
    response_model=PromoListOut,
    operation_id="ai_tools_get_promos",
)
async def get_promos(
    post_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> PromoListOut:
    """Get all saved promo suggestions for a post."""
    _require_promo_generator()
    await _verify_post_ownership(session, post_id, user)

    rows = await get_promo_suggestions(session, post_id)
    return PromoListOut(
        items=[
            PromoSuggestionOut(
                id=r.id,
                post_id=r.post_id,
                tone=r.tone,
                title=r.title,
                description=r.description,
                cta_lines=r.cta_lines,
                hashtags=r.hashtags,
                source_caption=r.source_caption,
                created_at=r.created_at,
            )
            for r in rows
        ]
    )


@router.post(
    "/promo/preview",
    response_model=PromoPreviewOut,
    operation_id="ai_tools_promo_preview",
)
async def promo_preview(
    body: PromoPreviewRequest,
    user: User = Depends(get_current_user),
) -> PromoPreviewOut:
    """Generate promo copy from raw caption text without saving to DB.

    Useful for previewing promo suggestions before a post is created.
    """
    _require_promo_generator()
    result = generate_promo(caption=body.caption, tone=body.tone, tags=[])
    return PromoPreviewOut(
        tone=body.tone,
        title=result.title,
        description=result.description,
        cta_lines=result.cta_lines,
        hashtags=result.hashtags,
    )
