from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user, get_optional_user
from app.modules.auth.models import User
from app.modules.creators.deps import require_creator
from app.modules.creators.models import Follow
from app.modules.creators.schemas import (
    CreatorDiscoverItem,
    CreatorDiscoverPage,
    CreatorFollowedItem,
    CreatorFollowingPage,
    CreatorProfilePublic,
    CreatorProfileUpdate,
)
from app.modules.creators.service import (
    follow_creator,
    get_creator_by_handle,
    get_discoverable_creators_page,
    get_following_page,
    get_posts_count,
    get_profile_by_user_id,
    unfollow_creator,
    update_creator_profile,
)
from app.modules.posts.schemas import PostOut, PostPage
from app.modules.posts.service import get_creator_posts_page, _post_to_out, _post_to_out_locked

router = APIRouter()


@router.get("", response_model=CreatorDiscoverPage, operation_id="creators_list")
async def list_creators(
    session: AsyncSession = Depends(get_async_session),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, description="Search by handle or display name"),
) -> CreatorDiscoverPage:
    """List discoverable creators. Paginated. Optional search (handle/display_name ILIKE)."""
    items_tuples, total = await get_discoverable_creators_page(
        session, page=page, page_size=page_size, q=q
    )
    items = [
        CreatorDiscoverItem(
            creator_id=user_id,
            handle=handle,
            display_name=display_name,
            avatar_media_id=avatar_media_id,
            followers_count=followers_count,
            posts_count=posts_count,
        )
        for user_id, handle, display_name, avatar_media_id, followers_count, posts_count in items_tuples
    ]
    return CreatorDiscoverPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/me/following", response_model=CreatorFollowingPage, operation_id="creators_me_following")
async def me_following(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> CreatorFollowingPage:
    items_tuples, total = await get_following_page(session, current_user.id, page=page, page_size=page_size)
    items = [
        CreatorFollowedItem(
            user_id=user.id,
            handle=profile.handle or "",
            display_name=profile.display_name,
            avatar_media_id=profile.avatar_asset_id,
            created_at=profile.created_at,
        )
        for user, profile in items_tuples
    ]
    return CreatorFollowingPage(items=items, total=total, page=page, page_size=page_size)


@router.patch("/me", response_model=CreatorProfilePublic, operation_id="creators_update_me")
async def update_me(
    payload: CreatorProfileUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator),
) -> CreatorProfilePublic:
    update_data = payload.model_dump(exclude_unset=True)
    profile = await update_creator_profile(session, current_user.id, update_data)
    user = current_user
    followers_count_result = await session.execute(
        select(func.count(Follow.id)).where(Follow.creator_user_id == user.id)
    )
    followers_count = followers_count_result.scalar_one() or 0
    posts_count = await get_posts_count(session, user.id)
    return CreatorProfilePublic(
        user_id=user.id,
        handle=profile.handle or "",
        display_name=profile.display_name,
        bio=profile.bio,
        avatar_media_id=profile.avatar_asset_id,
        banner_media_id=profile.banner_asset_id,
        discoverable=profile.discoverable,
        nsfw=profile.nsfw,
        followers_count=followers_count,
        posts_count=posts_count,
        is_following=False,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get(
    "/me",
    response_model=CreatorProfilePublic,
    operation_id="creators_get_me",
    summary="Current creator profile",
    description="Creator role only. Returns the authenticated creator's profile (403 for fans).",
)
async def get_me(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator),
) -> CreatorProfilePublic:
    """Return current creator's profile for settings prefill. Registered before /{handle}."""
    profile = await get_profile_by_user_id(session, current_user.id)
    user = current_user
    followers_count_result = await session.execute(
        select(func.count(Follow.id)).where(Follow.creator_user_id == user.id)
    )
    followers_count = followers_count_result.scalar_one() or 0
    posts_count = await get_posts_count(session, user.id)
    return CreatorProfilePublic(
        user_id=user.id,
        handle=profile.handle or "",
        display_name=profile.display_name,
        bio=profile.bio,
        avatar_media_id=profile.avatar_asset_id,
        banner_media_id=profile.banner_asset_id,
        discoverable=profile.discoverable,
        nsfw=profile.nsfw,
        followers_count=followers_count,
        posts_count=posts_count,
        is_following=False,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get(
    "/{handle}/posts",
    response_model=PostPage,
    operation_id="creators_list_posts_by_handle",
)
async def list_creator_posts(
    handle: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User | None = Depends(get_optional_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    include_locked: bool = Query(True, description="Include locked posts as teasers (FOLLOW_REQUIRED / SUBSCRIPTION_REQUIRED)."),
) -> PostPage:
    posts_with_lock, total = await get_creator_posts_page(
        session,
        handle,
        page=page,
        page_size=page_size,
        current_user_id=current_user.id if current_user else None,
        include_locked=include_locked,
    )
    items = [
        PostOut(**(_post_to_out_locked(p, reason) if is_locked else _post_to_out(p)))
        for p, is_locked, reason in posts_with_lock
    ]
    return PostPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{handle}", response_model=CreatorProfilePublic, operation_id="creators_get_by_handle")
async def get_creator(
    handle: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User | None = Depends(get_optional_user),
) -> CreatorProfilePublic:
    current_user_id = current_user.id if current_user else None
    user, profile, followers_count, is_following = await get_creator_by_handle(
        session, handle, current_user_id=current_user_id
    )
    posts_count = await get_posts_count(session, user.id)
    return CreatorProfilePublic(
        user_id=user.id,
        handle=profile.handle or "",
        display_name=profile.display_name,
        bio=profile.bio,
        avatar_media_id=profile.avatar_asset_id,
        banner_media_id=profile.banner_asset_id,
        discoverable=profile.discoverable,
        nsfw=profile.nsfw,
        followers_count=followers_count,
        posts_count=posts_count,
        is_following=is_following,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.post("/{creator_id}/follow", status_code=200, operation_id="creators_follow")
async def follow(
    creator_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    created = await follow_creator(session, current_user.id, creator_id)
    return {"status": "following" if created else "already_following"}


@router.delete("/{creator_id}/follow", status_code=200, operation_id="creators_unfollow")
async def unfollow(
    creator_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    removed = await unfollow_creator(session, current_user.id, creator_id)
    return {"status": "unfollowed" if removed else "not_following"}
