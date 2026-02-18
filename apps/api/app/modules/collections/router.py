from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.modules.auth.models import User
from app.modules.creators.deps import require_creator_with_profile
from app.modules.collections.schemas import (
    CollectionCreate,
    CollectionOut,
    CollectionPage,
    CollectionPostAdd,
    CollectionPostOut,
    CollectionUpdate,
)
from app.modules.collections.service import (
    add_post_to_collection,
    create_collection,
    delete_collection,
    get_collection,
    list_collection_posts,
    list_collections,
    remove_post_from_collection,
    update_collection,
)

router = APIRouter()


@router.post("", response_model=CollectionOut, status_code=201, operation_id="collections_create")
async def create(
    payload: CollectionCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> CollectionOut:
    collection = await create_collection(
        session,
        current_user.id,
        title=payload.title,
        description=payload.description,
        cover_asset_id=payload.cover_asset_id,
        visibility=payload.visibility,
    )
    return CollectionOut(
        id=collection.id,
        creator_user_id=collection.creator_user_id,
        title=collection.title,
        description=collection.description,
        cover_asset_id=collection.cover_asset_id,
        visibility=collection.visibility,
        position=collection.position,
        post_count=0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.get("", response_model=CollectionPage, operation_id="collections_list")
async def list_all(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> CollectionPage:
    items_tuples, total = await list_collections(session, current_user.id)
    items = [
        CollectionOut(
            id=c.id,
            creator_user_id=c.creator_user_id,
            title=c.title,
            description=c.description,
            cover_asset_id=c.cover_asset_id,
            visibility=c.visibility,
            position=c.position,
            post_count=count,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c, count in items_tuples
    ]
    return CollectionPage(items=items, total=total)


@router.get("/{collection_id}", response_model=CollectionOut, operation_id="collections_get")
async def get(
    collection_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> CollectionOut:
    collection = await get_collection(session, collection_id, current_user.id)
    return CollectionOut(
        id=collection.id,
        creator_user_id=collection.creator_user_id,
        title=collection.title,
        description=collection.description,
        cover_asset_id=collection.cover_asset_id,
        visibility=collection.visibility,
        position=collection.position,
        post_count=len(collection.posts),
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.patch("/{collection_id}", response_model=CollectionOut, operation_id="collections_update")
async def update(
    collection_id: UUID,
    payload: CollectionUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> CollectionOut:
    update_kwargs = {}
    data = payload.model_dump(exclude_unset=True)
    for key in ("title", "visibility", "position"):
        if key in data:
            update_kwargs[key] = data[key]
    if "description" in data:
        update_kwargs["description"] = data["description"]
    if "cover_asset_id" in data:
        update_kwargs["cover_asset_id"] = data["cover_asset_id"]
    collection = await update_collection(session, collection_id, current_user.id, **update_kwargs)
    return CollectionOut(
        id=collection.id,
        creator_user_id=collection.creator_user_id,
        title=collection.title,
        description=collection.description,
        cover_asset_id=collection.cover_asset_id,
        visibility=collection.visibility,
        position=collection.position,
        post_count=len(collection.posts) if collection.posts else 0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.delete("/{collection_id}", status_code=204, operation_id="collections_delete")
async def delete(
    collection_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> None:
    await delete_collection(session, collection_id, current_user.id)


@router.post(
    "/{collection_id}/posts",
    response_model=CollectionPostOut,
    status_code=201,
    operation_id="collections_add_post",
)
async def add_post(
    collection_id: UUID,
    payload: CollectionPostAdd,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> CollectionPostOut:
    cp = await add_post_to_collection(
        session, collection_id, current_user.id, payload.post_id, payload.position
    )
    return CollectionPostOut(
        id=cp.id,
        collection_id=cp.collection_id,
        post_id=cp.post_id,
        position=cp.position,
    )


@router.get(
    "/{collection_id}/posts",
    response_model=list[CollectionPostOut],
    operation_id="collections_list_posts",
)
async def list_posts(
    collection_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> list[CollectionPostOut]:
    posts = await list_collection_posts(session, collection_id, current_user.id)
    return [
        CollectionPostOut(
            id=cp.id,
            collection_id=cp.collection_id,
            post_id=cp.post_id,
            position=cp.position,
        )
        for cp in posts
    ]


@router.delete(
    "/{collection_id}/posts/{post_id}",
    status_code=204,
    operation_id="collections_remove_post",
)
async def remove_post(
    collection_id: UUID,
    post_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> None:
    await remove_post_from_collection(session, collection_id, current_user.id, post_id)
