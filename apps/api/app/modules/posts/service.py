from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.auth.models import Profile, User
from app.modules.billing.service import is_active_subscriber, get_subscribed_creator_ids
from app.modules.creators.models import Follow
from app.modules.creators.service import get_creator_by_handle_any
from app.modules.media.models import MediaObject
from app.modules.posts.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    POST_TYPE_IMAGE,
    POST_TYPE_TEXT,
    POST_TYPE_VIDEO,
    VISIBILITY_FOLLOWERS,
    VISIBILITY_PUBLIC,
    VISIBILITY_SUBSCRIBERS,
)
from app.modules.posts.models import Post, PostMedia
from app.shared.pagination import normalize_pagination


async def _check_media_owned_by_creator(
    session: AsyncSession, media_object_ids: list[UUID], creator_user_id: UUID
) -> None:
    """Ensure all media objects exist and are owned by the creator."""
    if not media_object_ids:
        return
    result = await session.execute(
        select(MediaObject.id).where(
            MediaObject.id.in_(media_object_ids),
            MediaObject.owner_user_id == creator_user_id,
        )
    )
    found = {row[0] for row in result.all()}
    missing = set(media_object_ids) - found
    if missing:
        raise AppError(status_code=400, detail="media_not_owned_or_missing")


CONTENT_TYPE_VIDEO_MP4 = "video/mp4"


async def _check_video_asset(session: AsyncSession, asset_id: UUID, creator_user_id: UUID) -> None:
    """Ensure the asset exists, is owned by creator, and is video/mp4."""
    result = await session.execute(
        select(MediaObject).where(
            MediaObject.id == asset_id,
            MediaObject.owner_user_id == creator_user_id,
        )
    )
    media = result.scalar_one_or_none()
    if not media:
        raise AppError(status_code=400, detail="media_not_owned_or_missing")
    if media.content_type != CONTENT_TYPE_VIDEO_MP4:
        raise AppError(status_code=400, detail="video_post_requires_mp4_asset")


async def create_post(
    session: AsyncSession,
    creator_user_id: UUID,
    *,
    type_: str,
    caption: str | None = None,
    visibility: str = VISIBILITY_PUBLIC,
    nsfw: bool = False,
    asset_ids: list[UUID] | None = None,
) -> Post:
    """Create a post. TEXT: asset_ids empty. IMAGE: 1..N assets. VIDEO: 1 asset (video/mp4), owned by creator."""
    asset_ids = asset_ids or []
    if type_ == POST_TYPE_TEXT:
        if asset_ids:
            raise AppError(status_code=400, detail="text_post_no_assets")
    elif type_ == POST_TYPE_IMAGE:
        if len(asset_ids) < 1:
            raise AppError(status_code=400, detail="image_post_requires_assets")
        await _check_media_owned_by_creator(session, asset_ids, creator_user_id)
    elif type_ == POST_TYPE_VIDEO:
        if len(asset_ids) < 1:
            raise AppError(status_code=400, detail="video_post_requires_assets")
        await _check_video_asset(session, asset_ids[0], creator_user_id)
        await _check_media_owned_by_creator(session, asset_ids, creator_user_id)
    else:
        raise AppError(status_code=400, detail="invalid_post_type")

    post = Post(
        creator_user_id=creator_user_id,
        type=type_,
        caption=caption,
        visibility=visibility,
        nsfw=nsfw,
    )
    session.add(post)
    await session.flush()
    for i, mid in enumerate(asset_ids):
        session.add(PostMedia(post_id=post.id, media_asset_id=mid, position=i))
    await session.commit()
    if type_ == POST_TYPE_VIDEO and get_settings().media_video_poster_enabled and asset_ids:
        try:
            from app.celery_client import enqueue_video_poster
            enqueue_video_poster(str(asset_ids[0]))
        except Exception:
            pass
    result = await session.execute(
        select(Post).where(Post.id == post.id).options(selectinload(Post.media))
    )
    return result.scalar_one()


def _post_to_out(post: Post) -> dict:
    return {
        "id": post.id,
        "creator_user_id": post.creator_user_id,
        "type": post.type,
        "caption": post.caption,
        "visibility": post.visibility,
        "nsfw": post.nsfw,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "asset_ids": [pm.media_asset_id for pm in sorted(post.media, key=lambda m: m.position)],
        "is_locked": False,
        "locked_reason": None,
    }


def _post_to_out_locked(post: Post, locked_reason: str) -> dict:
    """Teaser payload for posts viewer cannot access: no caption, no asset_ids."""
    return {
        "id": post.id,
        "creator_user_id": post.creator_user_id,
        "type": post.type,
        "caption": None,
        "visibility": post.visibility,
        "nsfw": post.nsfw,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "asset_ids": [],
        "is_locked": True,
        "locked_reason": locked_reason,
    }


async def _can_see_post(
    session: AsyncSession,
    post: Post,
    *,
    viewer_user_id: UUID | None,
    is_follower: bool = False,
    is_subscriber: bool = False,
) -> bool:
    """Visibility: PUBLIC all; FOLLOWERS follower or creator; SUBSCRIBERS active subscribers + creator."""
    if post.visibility == VISIBILITY_PUBLIC:
        return True
    if not viewer_user_id:
        return False
    if post.creator_user_id == viewer_user_id:
        return True
    if post.visibility == VISIBILITY_FOLLOWERS and is_follower:
        return True
    if post.visibility == VISIBILITY_SUBSCRIBERS and is_subscriber:
        return True
    return False


async def get_creator_posts_page(
    session: AsyncSession,
    handle: str,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    *,
    current_user_id: UUID | None = None,
    include_locked: bool = True,
) -> tuple[list[tuple[Post, bool, str | None]], int]:
    """
    Paginated posts for creator by handle. Each item is (post, is_locked, locked_reason).
    When include_locked=True (default), FOLLOWERS/SUBSCRIBERS posts the viewer cannot
    access are included as locked teasers with locked_reason for UI copy.
    """
    try:
        user, profile, _, is_following = await get_creator_by_handle_any(
            session, handle, current_user_id=current_user_id
        )
    except AppError:
        raise
    creator_id = user.id
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=False,
    )

    query = (
        select(Post)
        .where(Post.creator_user_id == creator_id)
        .options(selectinload(Post.media))
        .order_by(Post.created_at.desc(), Post.id.desc())
    )
    count_result = await session.execute(
        select(func.count(Post.id)).where(Post.creator_user_id == creator_id)
    )
    total = count_result.scalar_one() or 0
    result = await session.execute(query.offset(offset).limit(limit))
    posts = list(result.scalars().unique().all())

    is_sub = (
        await is_active_subscriber(session, current_user_id, creator_id)
        if current_user_id else False
    )
    items: list[tuple[Post, bool, str | None]] = []
    for post in posts:
        can_see = await _can_see_post(
            session, post,
            viewer_user_id=current_user_id,
            is_follower=is_following,
            is_subscriber=is_sub,
        )
        if can_see:
            items.append((post, False, None))
        elif include_locked and post.visibility == VISIBILITY_SUBSCRIBERS:
            items.append((post, True, "SUBSCRIPTION_REQUIRED"))
        elif include_locked and post.visibility == VISIBILITY_FOLLOWERS:
            items.append((post, True, "FOLLOW_REQUIRED"))
    return items, total


def _feed_visibility_filter(current_user_id: UUID, subscribed_creator_ids: set[UUID]):
    """Visibility in feed: PUBLIC and FOLLOWERS; SUBSCRIBERS when viewer is creator or active subscriber."""
    return or_(
        Post.visibility.in_([VISIBILITY_PUBLIC, VISIBILITY_FOLLOWERS]),
        and_(
            Post.visibility == VISIBILITY_SUBSCRIBERS,
            or_(
                Post.creator_user_id == current_user_id,
                Post.creator_user_id.in_(subscribed_creator_ids),
            ),
        ),
    )


async def get_feed_page(
    session: AsyncSession,
    current_user_id: UUID,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[tuple[Post, User, Profile]], int]:
    """
    Feed: latest posts from creators the user follows, plus the user's own posts.
    Visibility: PUBLIC + FOLLOWERS (when following) + SUBSCRIBERS only when viewer is creator.
    Two queries with joins to avoid N+1; stable ordering (created_at desc, id desc).
    """
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=False,
    )

    subscribed_ids = await get_subscribed_creator_ids(session, current_user_id)
    visibility_filter = _feed_visibility_filter(current_user_id, subscribed_ids)
    followed_result = await session.execute(
        select(Follow.creator_user_id).where(Follow.fan_user_id == current_user_id)
    )
    followed_ids = {row[0] for row in followed_result.all()}

    # Posts from followed creators (visible) OR own posts (creator sees all own)
    feed_filter = or_(
        and_(
            Post.creator_user_id.in_(followed_ids),
            visibility_filter,
        ),
        Post.creator_user_id == current_user_id,
    )

    count_stmt = select(func.count(Post.id)).select_from(Post).where(feed_filter)
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one() or 0

    ids_stmt = (
        select(Post.id)
        .where(feed_filter)
        .order_by(Post.created_at.desc(), Post.id.desc())
        .offset(offset)
        .limit(limit)
    )
    ids_result = await session.execute(ids_stmt)
    post_ids = [row[0] for row in ids_result.all()]
    if not post_ids:
        return [], total

    # Single query for posts + creator (User, Profile) + media (selectinload)
    posts_query = (
        select(Post, User, Profile)
        .select_from(Post)
        .join(User, User.id == Post.creator_user_id)
        .join(Profile, Profile.user_id == User.id)
        .where(Post.id.in_(post_ids))
        .options(selectinload(Post.media))
    )
    rows = (await session.execute(posts_query)).all()
    order_map = {p.id: (p, u, prof) for p, u, prof in rows}
    ordered = [order_map[pid] for pid in post_ids if pid in order_map]
    return ordered, total