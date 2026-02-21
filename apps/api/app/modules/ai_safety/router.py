"""AI safety API endpoints — scan results, captions, tags, search, admin review."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user, require_admin
from app.modules.auth.models import User
from app.modules.media.models import MediaObject
from app.modules.ai_safety.schemas import (
    AdminReviewOut,
    AdminReviewPayload,
    CaptionOut,
    PendingReviewItem,
    PendingReviewPage,
    SafetyScanOut,
    SearchResponse,
    SearchResultItem,
    TagsOut,
)
from app.modules.ai_safety.service import (
    admin_review_scan,
    check_pgvector_available,
    get_caption_for_media,
    get_scan_for_media,
    get_tags_for_media,
    list_pending_reviews,
    search_media_by_tags,
    search_media_by_vector,
)

from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_ai_safety() -> None:
    """Raise 404 if AI safety feature is disabled."""
    if not get_settings().enable_ai_safety:
        raise AppError(status_code=404, detail="feature_disabled")


async def _verify_media_ownership(
    session: AsyncSession, media_id: UUID, user: User
) -> None:
    """Check that the user owns the media asset, or is admin/super_admin."""
    from app.modules.auth.constants import ADMIN_ROLE, SUPER_ADMIN_ROLE

    if user.role in (ADMIN_ROLE, SUPER_ADMIN_ROLE):
        return
    r = await session.execute(
        select(MediaObject.owner_user_id).where(MediaObject.id == media_id)
    )
    owner = r.scalar_one_or_none()
    if owner != user.id:
        raise AppError(status_code=404, detail="media_not_found")


@router.get(
    "/media/{media_id}/scan",
    response_model=SafetyScanOut,
    operation_id="ai_safety_get_scan",
)
async def get_scan(
    media_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> SafetyScanOut:
    """Get safety scan result for a media asset."""
    _require_ai_safety()
    await _verify_media_ownership(session, media_id, user)
    scan = await get_scan_for_media(session, media_id)
    if not scan:
        raise AppError(status_code=404, detail="scan_not_found")
    return SafetyScanOut(
        id=scan.id,
        media_asset_id=scan.media_asset_id,
        nsfw_score=scan.nsfw_score,
        nsfw_label=scan.nsfw_label,
        age_range_prediction=scan.age_range_prediction,
        underage_likelihood_proxy=scan.underage_likelihood_proxy,
        risk_level=scan.risk_level,
        decision=scan.decision,
        model_versions=scan.model_versions,
        reviewed_by=scan.reviewed_by,
        reviewed_at=scan.reviewed_at,
        review_decision=scan.review_decision,
        created_at=scan.created_at,
    )


@router.get(
    "/media/{media_id}/captions",
    response_model=CaptionOut,
    operation_id="ai_safety_get_captions",
)
async def get_captions(
    media_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> CaptionOut:
    """Get generated captions for a media asset (creator who owns it)."""
    _require_ai_safety()
    await _verify_media_ownership(session, media_id, user)
    caption = await get_caption_for_media(session, media_id)
    if not caption:
        raise AppError(status_code=404, detail="caption_not_found")
    return CaptionOut(
        id=caption.id,
        media_asset_id=caption.media_asset_id,
        caption_short=caption.caption_short,
        caption_medium=caption.caption_medium,
        caption_promo=caption.caption_promo,
        raw_caption=caption.raw_caption,
        model_version=caption.model_version,
        created_at=caption.created_at,
    )


@router.get(
    "/media/{media_id}/tags",
    response_model=TagsOut,
    operation_id="ai_safety_get_tags",
)
async def get_tags(
    media_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> TagsOut:
    """Get generated tags for a media asset."""
    _require_ai_safety()
    await _verify_media_ownership(session, media_id, user)
    tags = await get_tags_for_media(session, media_id)
    if not tags:
        raise AppError(status_code=404, detail="tags_not_found")
    return TagsOut(
        id=tags.id,
        media_asset_id=tags.media_asset_id,
        tags=tags.tags,
        model_version=tags.model_version,
        created_at=tags.created_at,
    )


@router.get(
    "/search",
    response_model=SearchResponse,
    operation_id="ai_safety_search",
)
async def search_media(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> SearchResponse:
    """Search media by tags (keyword match).

    Uses pgvector similarity search when available and a query embedding
    is provided via worker task. Falls back to keyword matching on tags.
    """
    _require_ai_safety()

    # Check if pgvector is available for vector search
    has_vector = await check_pgvector_available(session)

    if has_vector:
        # For pgvector search, we need a query embedding.
        # The worker generates embeddings — to avoid loading sentence-transformers
        # in the API, we use a synchronous Celery task with a short timeout.
        try:
            from app.celery_client import _get_celery_app

            app = _get_celery_app()
            result = app.send_task(
                "ai_safety.embed_query",
                args=[q],
            )
            query_embedding = result.get(timeout=10)  # 10s timeout
            if query_embedding and isinstance(query_embedding, list):
                items, mode = await search_media_by_vector(
                    session, user.id, query_embedding, limit
                )
                return SearchResponse(
                    items=[SearchResultItem(**item) for item in items],
                    mode=mode,
                    total=len(items),
                )
        except Exception:
            logger.debug("Vector search failed, falling back to keyword search")

    # Fallback: keyword-based tag search
    items, mode = await search_media_by_tags(session, user.id, q, limit)
    return SearchResponse(
        items=[SearchResultItem(**item) for item in items],
        mode=mode,
        total=len(items),
    )


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/admin/review/{scan_id}",
    response_model=AdminReviewOut,
    operation_id="ai_safety_admin_review",
)
async def review_scan(
    scan_id: UUID,
    payload: AdminReviewPayload,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(require_admin),
) -> AdminReviewOut:
    """Admin approves or rejects a flagged media scan."""
    _require_ai_safety()
    result = await admin_review_scan(session, scan_id, admin.id, payload.decision)
    return AdminReviewOut(**result)


@router.get(
    "/admin/pending-reviews",
    response_model=PendingReviewPage,
    operation_id="ai_safety_pending_reviews",
)
async def pending_reviews(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> PendingReviewPage:
    """List media assets pending admin review (flagged by AI safety)."""
    _require_ai_safety()
    items, total = await list_pending_reviews(session, page, page_size)
    return PendingReviewPage(
        items=[PendingReviewItem(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
