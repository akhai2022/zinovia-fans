from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.modules.collections.models import Collection, CollectionPost

logger = logging.getLogger(__name__)


async def create_collection(
    session: AsyncSession,
    creator_user_id: UUID,
    *,
    title: str,
    description: str | None = None,
    cover_asset_id: UUID | None = None,
    visibility: str = "PUBLIC",
) -> Collection:
    collection = Collection(
        creator_user_id=creator_user_id,
        title=title,
        description=description,
        cover_asset_id=cover_asset_id,
        visibility=visibility,
    )
    session.add(collection)
    await session.commit()
    await session.refresh(collection)
    return collection


async def list_collections(
    session: AsyncSession,
    creator_user_id: UUID,
) -> tuple[list[tuple[Collection, int]], int]:
    """List all collections for a creator with post counts."""
    post_count_subq = (
        select(func.count(CollectionPost.id))
        .where(CollectionPost.collection_id == Collection.id)
        .scalar_subquery()
    )
    query = (
        select(Collection, post_count_subq)
        .where(Collection.creator_user_id == creator_user_id)
        .order_by(Collection.position.asc(), Collection.created_at.desc())
    )
    rows = (await session.execute(query)).all()
    total = len(rows)
    items = [(row[0], row[1] or 0) for row in rows]
    return items, total


async def get_collection(
    session: AsyncSession,
    collection_id: UUID,
    creator_user_id: UUID,
) -> Collection:
    result = await session.execute(
        select(Collection)
        .where(Collection.id == collection_id, Collection.creator_user_id == creator_user_id)
        .options(selectinload(Collection.posts))
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise AppError(status_code=404, detail="collection_not_found")
    return collection


async def update_collection(
    session: AsyncSession,
    collection_id: UUID,
    creator_user_id: UUID,
    *,
    title: str | None = None,
    description: str | None = ...,  # type: ignore[assignment]
    cover_asset_id: UUID | None = ...,  # type: ignore[assignment]
    visibility: str | None = None,
    position: int | None = None,
) -> Collection:
    collection = await get_collection(session, collection_id, creator_user_id)
    if title is not None:
        collection.title = title
    if description is not ...:
        collection.description = description
    if cover_asset_id is not ...:
        collection.cover_asset_id = cover_asset_id
    if visibility is not None:
        collection.visibility = visibility
    if position is not None:
        collection.position = position
    await session.commit()
    await session.refresh(collection)
    return collection


async def delete_collection(
    session: AsyncSession,
    collection_id: UUID,
    creator_user_id: UUID,
) -> None:
    collection = await get_collection(session, collection_id, creator_user_id)
    await session.delete(collection)
    await session.commit()


async def add_post_to_collection(
    session: AsyncSession,
    collection_id: UUID,
    creator_user_id: UUID,
    post_id: UUID,
    position: int = 0,
) -> CollectionPost:
    # Verify collection ownership
    await get_collection(session, collection_id, creator_user_id)
    cp = CollectionPost(
        collection_id=collection_id,
        post_id=post_id,
        position=position,
    )
    session.add(cp)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AppError(status_code=400, detail="post_already_in_collection") from exc
    await session.refresh(cp)
    return cp


async def remove_post_from_collection(
    session: AsyncSession,
    collection_id: UUID,
    creator_user_id: UUID,
    post_id: UUID,
) -> None:
    await get_collection(session, collection_id, creator_user_id)
    result = await session.execute(
        select(CollectionPost).where(
            CollectionPost.collection_id == collection_id,
            CollectionPost.post_id == post_id,
        )
    )
    cp = result.scalar_one_or_none()
    if not cp:
        raise AppError(status_code=404, detail="post_not_in_collection")
    await session.delete(cp)
    await session.commit()


async def list_collection_posts(
    session: AsyncSession,
    collection_id: UUID,
    creator_user_id: UUID,
) -> list[CollectionPost]:
    await get_collection(session, collection_id, creator_user_id)
    result = await session.execute(
        select(CollectionPost)
        .where(CollectionPost.collection_id == collection_id)
        .order_by(CollectionPost.position.asc())
    )
    return list(result.scalars().all())
