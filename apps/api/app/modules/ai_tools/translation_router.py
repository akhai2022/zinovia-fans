"""AI tools API endpoints — caption translation."""

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
from app.modules.posts.models import Post
from app.modules.ai_tools.translation_schemas import (
    SUPPORTED_LANGUAGES,
    TranslateRequest,
    TranslationListOut,
    TranslationOut,
)
from app.modules.ai_tools.translation_service import (
    get_or_create_translation,
    get_translations_for_post,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_translations() -> None:
    if not get_settings().enable_translations:
        raise AppError(status_code=404, detail="feature_disabled")


async def _verify_post_ownership(
    session: AsyncSession, post_id: UUID, user: User
) -> Post:
    r = await session.execute(
        select(Post).where(Post.id == post_id).limit(1)
    )
    post = r.scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")
    if user.role not in (ADMIN_ROLE, SUPER_ADMIN_ROLE) and post.creator_user_id != user.id:
        raise AppError(status_code=404, detail="post_not_found")
    return post


def _to_out(t) -> TranslationOut:
    return TranslationOut(
        id=t.id,
        post_id=t.post_id,
        source_language=t.source_language,
        target_language=t.target_language,
        translated_text=t.translated_text,
        status=t.status,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.post(
    "/translate",
    response_model=TranslationListOut,
    operation_id="ai_tools_translate",
)
async def translate_caption(
    body: TranslateRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> TranslationListOut:
    """Request async translation of a post's caption into target languages."""
    _require_translations()
    post = await _verify_post_ownership(session, body.post_id, user)

    if not post.caption:
        raise AppError(status_code=400, detail="post_has_no_caption")

    # Validate languages
    for lang in body.target_languages:
        if lang not in SUPPORTED_LANGUAGES:
            raise AppError(
                status_code=400,
                detail=f"unsupported_language: {lang}. Supported: {', '.join(sorted(SUPPORTED_LANGUAGES))}",
            )

    results: list[TranslationOut] = []
    new_ids: list[tuple[str, str, str, str]] = []

    for lang in body.target_languages:
        translation, is_new = await get_or_create_translation(
            session, body.post_id, post.caption, lang
        )
        results.append(_to_out(translation))
        if is_new:
            new_ids.append((str(translation.id), post.caption, "en", lang))

    await session.commit()

    # Enqueue Celery tasks for new translations
    if new_ids:
        from app.celery_client import enqueue_translate_caption

        for tid, text, src, tgt in new_ids:
            enqueue_translate_caption(tid, text, src, tgt)

    return TranslationListOut(items=results)


@router.get(
    "/posts/{post_id}/translations",
    response_model=TranslationListOut,
    operation_id="ai_tools_get_translations",
)
async def get_translations(
    post_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> TranslationListOut:
    """Get all translations for a post."""
    _require_translations()
    await _verify_post_ownership(session, post_id, user)

    rows = await get_translations_for_post(session, post_id)
    return TranslationListOut(items=[_to_out(r) for r in rows])
