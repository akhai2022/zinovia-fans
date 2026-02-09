from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.creators.deps import require_creator_with_profile
from app.modules.posts.schemas import FeedPage, PostCreate, PostOut, PostWithCreator
from app.modules.posts.service import (
    create_post,
    get_feed_page,
    _post_to_out,
)
from app.modules.posts.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

router = APIRouter()


feed_router = APIRouter()


@feed_router.get("/feed", response_model=FeedPage, operation_id="feed_list")
async def feed(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
) -> FeedPage:
    items_tuples, total = await get_feed_page(
        session, current_user.id, page=page, page_size=page_size
    )
    items = []
    for post, user, profile in items_tuples:
        from app.modules.posts.schemas import CreatorSummary

        data = _post_to_out(post)
        items.append(
            PostWithCreator(
                **data,
                creator=CreatorSummary(
                    user_id=user.id,
                    handle=profile.handle or "",
                    display_name=profile.display_name,
                    avatar_asset_id=profile.avatar_asset_id,
                ),
            )
        )
    return FeedPage(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=PostOut, status_code=201, operation_id="posts_create")
async def create(
    payload: PostCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator_with_profile),
) -> PostOut:
    post = await create_post(
        session,
        current_user.id,
        type_=payload.type,
        caption=payload.caption,
        visibility=payload.visibility,
        nsfw=payload.nsfw,
        asset_ids=payload.asset_ids or [],
    )
    data = _post_to_out(post)
    return PostOut(**data)


