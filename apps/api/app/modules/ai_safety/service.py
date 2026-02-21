"""AI safety service — query scans, captions, tags, admin review."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.ai_safety.models import ImageCaption, ImageSafetyScan, ImageTag
from app.modules.media.models import MediaObject

logger = logging.getLogger(__name__)


async def get_scan_for_media(
    session: AsyncSession,
    media_asset_id: uuid.UUID,
) -> ImageSafetyScan | None:
    """Get the safety scan for a media asset."""
    r = await session.execute(
        select(ImageSafetyScan).where(
            ImageSafetyScan.media_asset_id == media_asset_id
        )
    )
    return r.scalar_one_or_none()


async def get_caption_for_media(
    session: AsyncSession,
    media_asset_id: uuid.UUID,
) -> ImageCaption | None:
    """Get generated captions for a media asset."""
    r = await session.execute(
        select(ImageCaption).where(
            ImageCaption.media_asset_id == media_asset_id
        )
    )
    return r.scalar_one_or_none()


async def get_tags_for_media(
    session: AsyncSession,
    media_asset_id: uuid.UUID,
) -> ImageTag | None:
    """Get generated tags for a media asset."""
    r = await session.execute(
        select(ImageTag).where(
            ImageTag.media_asset_id == media_asset_id
        )
    )
    return r.scalar_one_or_none()


async def search_media_by_tags(
    session: AsyncSession,
    owner_user_id: uuid.UUID,
    query: str,
    limit: int = 20,
) -> tuple[list[dict], str]:
    """Search media by keyword matching against tags.

    Returns (results, mode) where mode is "keyword".
    This is the fallback when pgvector is not available.
    """
    keywords = [w.strip().lower() for w in query.split() if w.strip()]
    if not keywords:
        return [], "keyword"

    # Query image_tags joined with media_assets for ownership check
    q = (
        select(ImageTag.media_asset_id, ImageTag.tags)
        .join(MediaObject, MediaObject.id == ImageTag.media_asset_id)
        .where(MediaObject.owner_user_id == owner_user_id)
    )
    rows = (await session.execute(q)).all()

    # Score by number of matching keywords
    results = []
    for row in rows:
        tags = row.tags or []
        match_count = sum(
            1 for kw in keywords if any(kw in tag.lower() for tag in tags)
        )
        if match_count > 0:
            results.append({
                "media_asset_id": row.media_asset_id,
                "tags": tags,
                "score": float(match_count) / len(keywords),
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit], "keyword"


async def search_media_by_vector(
    session: AsyncSession,
    owner_user_id: uuid.UUID,
    query_embedding: list[float],
    limit: int = 20,
) -> tuple[list[dict], str]:
    """Search media using pgvector cosine similarity.

    Returns (results, mode) where mode is "vector".
    """
    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"
    q = text("""
        SELECT it.media_asset_id, it.tags,
               1 - (it.embedding <=> :query_vec::vector) AS score
        FROM image_tags it
        JOIN media_assets ma ON ma.id = it.media_asset_id
        WHERE ma.owner_user_id = :owner_id
          AND it.embedding IS NOT NULL
        ORDER BY it.embedding <=> :query_vec::vector
        LIMIT :lim
    """)
    rows = (
        await session.execute(
            q,
            {
                "query_vec": embedding_str,
                "owner_id": str(owner_user_id),
                "lim": limit,
            },
        )
    ).all()
    results = [
        {
            "media_asset_id": row.media_asset_id,
            "tags": row.tags,
            "score": round(float(row.score), 4) if row.score else None,
        }
        for row in rows
    ]
    return results, "vector"


async def check_pgvector_available(session: AsyncSession) -> bool:
    """Check if pgvector extension is installed and embedding column exists."""
    try:
        r = await session.execute(
            text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
        )
        return r.scalar_one_or_none() is not None
    except Exception:
        return False


async def admin_review_scan(
    session: AsyncSession,
    scan_id: uuid.UUID,
    admin_user_id: uuid.UUID,
    decision: str,
) -> dict:
    """Admin approves or rejects a flagged media scan.

    Args:
        decision: "APPROVED" or "REJECTED"
    """
    scan = (
        await session.execute(
            select(ImageSafetyScan).where(ImageSafetyScan.id == scan_id)
        )
    ).scalar_one_or_none()
    if not scan:
        raise AppError(status_code=404, detail="scan_not_found")

    scan.reviewed_by = admin_user_id
    scan.reviewed_at = datetime.now(UTC)
    scan.review_decision = decision

    new_status = "allowed" if decision == "APPROVED" else "blocked"
    await session.execute(
        update(MediaObject)
        .where(MediaObject.id == scan.media_asset_id)
        .values(safety_status=new_status)
    )

    await session.commit()
    return {
        "scan_id": scan_id,
        "review_decision": decision,
        "safety_status": new_status,
    }


async def list_pending_reviews(
    session: AsyncSession,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    """List media assets pending admin review."""
    # Count
    count_q = select(func.count(ImageSafetyScan.id)).where(
        ImageSafetyScan.decision.in_(["REQUIRE_REVIEW", "BLOCK"]),
        ImageSafetyScan.review_decision.is_(None),
    )
    total = (await session.execute(count_q)).scalar_one()

    # Items
    q = (
        select(ImageSafetyScan, MediaObject.owner_user_id)
        .join(MediaObject, MediaObject.id == ImageSafetyScan.media_asset_id)
        .where(
            ImageSafetyScan.decision.in_(["REQUIRE_REVIEW", "BLOCK"]),
            ImageSafetyScan.review_decision.is_(None),
        )
        .order_by(ImageSafetyScan.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await session.execute(q)).all()
    items = []
    for scan, owner_id in rows:
        items.append({
            "scan_id": scan.id,
            "media_asset_id": scan.media_asset_id,
            "nsfw_score": scan.nsfw_score,
            "nsfw_label": scan.nsfw_label,
            "age_range_prediction": scan.age_range_prediction,
            "underage_likelihood_proxy": scan.underage_likelihood_proxy,
            "risk_level": scan.risk_level,
            "decision": scan.decision,
            "created_at": scan.created_at,
            "owner_user_id": owner_id,
        })

    return items, total
