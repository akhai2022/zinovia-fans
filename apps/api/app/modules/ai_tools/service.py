"""DB service functions for promo suggestions."""

from __future__ import annotations

import uuid
from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai_tools.models import PostPromoSuggestion
from app.modules.ai_tools.promo_engine import PromoResult


async def upsert_promo_suggestion(
    session: AsyncSession,
    post_id: UUID,
    tone: str,
    result: PromoResult,
    source_caption: str | None,
) -> PostPromoSuggestion:
    """Insert or replace a promo suggestion for (post_id, tone)."""
    # Delete existing for this post+tone
    await session.execute(
        delete(PostPromoSuggestion).where(
            PostPromoSuggestion.post_id == post_id,
            PostPromoSuggestion.tone == tone,
        )
    )

    row = PostPromoSuggestion(
        id=uuid.uuid4(),
        post_id=post_id,
        tone=tone,
        title=result.title,
        description=result.description,
        cta_lines=result.cta_lines,
        hashtags=result.hashtags,
        source_caption=source_caption,
    )
    session.add(row)
    await session.flush()
    return row


async def get_promo_suggestions(
    session: AsyncSession,
    post_id: UUID,
) -> list[PostPromoSuggestion]:
    """Return all promo suggestions for a post (all tones)."""
    r = await session.execute(
        select(PostPromoSuggestion)
        .where(PostPromoSuggestion.post_id == post_id)
        .order_by(PostPromoSuggestion.tone)
    )
    return list(r.scalars().all())
