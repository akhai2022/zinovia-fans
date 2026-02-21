"""DB service functions for post translations."""

from __future__ import annotations

import uuid
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai_tools.translation_models import PostTranslation


async def get_or_create_translation(
    session: AsyncSession,
    post_id: UUID,
    source_text: str,
    target_language: str,
) -> tuple[PostTranslation, bool]:
    """Get existing translation or create a new pending one.

    Returns (translation, is_new).
    """
    r = await session.execute(
        select(PostTranslation).where(
            PostTranslation.post_id == post_id,
            PostTranslation.target_language == target_language,
        ).limit(1)
    )
    existing = r.scalar_one_or_none()
    if existing:
        return existing, False

    row = PostTranslation(
        id=uuid.uuid4(),
        post_id=post_id,
        source_text=source_text,
        source_language="en",
        target_language=target_language,
        status="pending",
    )
    session.add(row)
    await session.flush()
    return row, True


async def get_translations_for_post(
    session: AsyncSession,
    post_id: UUID,
) -> list[PostTranslation]:
    """Return all translations for a post."""
    r = await session.execute(
        select(PostTranslation)
        .where(PostTranslation.post_id == post_id)
        .order_by(PostTranslation.target_language)
    )
    return list(r.scalars().all())
