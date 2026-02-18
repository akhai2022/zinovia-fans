from __future__ import annotations

from typing import Any
from uuid import UUID
from datetime import datetime, timezone
import logging

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.auth.rate_limit import check_rate_limit_custom
from app.modules.auth.models import Profile, User
from app.modules.billing.service import is_active_subscriber, get_subscribed_creator_ids
from app.modules.creators.models import Follow
from app.modules.creators.service import get_creator_by_handle_any
from app.modules.media.models import MediaObject
from app.modules.posts.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    POST_TYPE_IMAGE,
    POST_STATUS_DRAFT,
    POST_STATUS_PUBLISHED,
    POST_STATUS_SCHEDULED,
    POST_TYPE_TEXT,
    POST_TYPE_VIDEO,
    VISIBILITY_FOLLOWERS,
    VISIBILITY_PUBLIC,
    VISIBILITY_SUBSCRIBERS,
)
from app.modules.posts.models import Post, PostComment, PostLike, PostMedia
from app.shared.pagination import normalize_pagination

logger = logging.getLogger(__name__)

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
    publish_at: datetime | None = None,
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

    now = datetime.now(timezone.utc)
    post_status = POST_STATUS_PUBLISHED
    normalized_publish_at = publish_at
    if publish_at and publish_at > now:
        post_status = POST_STATUS_SCHEDULED
    elif publish_at and publish_at <= now:
        post_status = POST_STATUS_PUBLISHED
        normalized_publish_at = now
    post = Post(
        creator_user_id=creator_user_id,
        type=type_,
        caption=caption,
        visibility=visibility,
        nsfw=nsfw,
        publish_at=normalized_publish_at,
        status=post_status,
    )
    session.add(post)
    await session.flush()
    for i, mid in enumerate(asset_ids):
        session.add(PostMedia(post_id=post.id, media_asset_id=mid, position=i))
    await session.commit()
    if type_ == POST_TYPE_IMAGE and asset_ids:
        try:
            owner_handle_result = await session.execute(
                select(Profile.handle).where(Profile.user_id == creator_user_id).limit(1)
            )
            owner_handle = owner_handle_result.scalar_one_or_none()
            assets_result = await session.execute(
                select(MediaObject.id, MediaObject.object_key, MediaObject.content_type).where(
                    MediaObject.id.in_(asset_ids),
                    MediaObject.owner_user_id == creator_user_id,
                )
            )
            from app.celery_client import enqueue_generate_derived_variants

            for media_id, object_key, content_type in assets_result.all():
                if content_type and content_type.lower().startswith("image/"):
                    enqueue_generate_derived_variants(
                        str(media_id),
                        object_key,
                        content_type,
                        owner_handle=owner_handle,
                    )
        except Exception:
            pass
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
        "publish_at": post.publish_at,
        "status": post.status,
        "is_locked": False,
        "locked_reason": None,
    }


def _post_to_out_locked(post: Post, locked_reason: str) -> dict:
    """Teaser payload for inaccessible posts: no caption, media IDs kept for teaser variants."""
    return {
        "id": post.id,
        "creator_user_id": post.creator_user_id,
        "type": post.type,
        "caption": None,
        "visibility": post.visibility,
        "nsfw": post.nsfw,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "asset_ids": [pm.media_asset_id for pm in sorted(post.media, key=lambda m: m.position)],
        "publish_at": post.publish_at,
        "status": post.status,
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
    now = datetime.now(timezone.utc)
    include_unpublished = current_user_id == creator_id
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=False,
    )

    where_conditions: list[Any] = [Post.creator_user_id == creator_id]
    if not include_unpublished:
        where_conditions.extend(
            [
                Post.status == POST_STATUS_PUBLISHED,
                or_(Post.publish_at.is_(None), Post.publish_at <= now),
            ]
        )
    query = (
        select(Post)
        .where(*where_conditions)
        .options(selectinload(Post.media))
        .order_by(Post.created_at.desc(), Post.id.desc())
    )
    count_result = await session.execute(
        select(func.count(Post.id)).where(*where_conditions)
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


def _feed_visibility_filter(
    current_user_id: UUID, subscribed_creator_ids: set[UUID]
) -> Any:
    """Visibility in feed: PUBLIC and FOLLOWERS; SUBSCRIBERS when viewer is creator or active subscriber."""
    now = datetime.now(timezone.utc)
    return or_(
        and_(
            Post.status == POST_STATUS_PUBLISHED,
            or_(Post.publish_at.is_(None), Post.publish_at <= now),
            or_(
                Post.visibility.in_([VISIBILITY_PUBLIC, VISIBILITY_FOLLOWERS]),
                and_(
                    Post.visibility == VISIBILITY_SUBSCRIBERS,
                    or_(
                        Post.creator_user_id == current_user_id,
                        Post.creator_user_id.in_(subscribed_creator_ids),
                    ),
                ),
            ),
        ),
    )


def _feed_cursor_encode(created_at: datetime, post_id: UUID) -> str:
    return f"{created_at.isoformat()}|{post_id}"


def _feed_cursor_decode(cursor: str) -> tuple[datetime, UUID]:
    try:
        created_at_s, post_id_s = cursor.split("|", 1)
        return datetime.fromisoformat(created_at_s), UUID(post_id_s)
    except Exception as exc:
        raise AppError(status_code=400, detail="invalid_cursor") from exc


async def get_feed_page(
    session: AsyncSession,
    current_user_id: UUID,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    *,
    cursor: str | None = None,
) -> tuple[list[tuple[Post, User, Profile, bool, str | None]], int, str | None]:
    """
    Feed: latest posts from creators the user follows, plus the user's own posts.

    Returns (items, total, next_cursor).
    Each item is (post, user, profile, is_locked, locked_reason).
    Posts the user is not entitled to see are returned as locked teasers.
    Supports cursor-based pagination for infinite scroll.
    """
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=False,
    )

    subscribed_ids = await get_subscribed_creator_ids(session, current_user_id)
    followed_result = await session.execute(
        select(Follow.creator_user_id).where(Follow.fan_user_id == current_user_id)
    )
    followed_ids = {row[0] for row in followed_result.all()}

    now = datetime.now(timezone.utc)

    # Base filter: published posts from followed creators or own posts
    base_filter = and_(
        Post.status == POST_STATUS_PUBLISHED,
        or_(Post.publish_at.is_(None), Post.publish_at <= now),
        or_(
            Post.creator_user_id.in_(followed_ids) if followed_ids else func.false(),
            Post.creator_user_id == current_user_id,
        ),
    )

    count_stmt = select(func.count(Post.id)).select_from(Post).where(base_filter)
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one() or 0

    ids_stmt = (
        select(Post.id)
        .where(base_filter)
        .order_by(Post.created_at.desc(), Post.id.desc())
    )

    # Cursor-based pagination (preferred for infinite scroll)
    if cursor:
        cursor_dt, cursor_id = _feed_cursor_decode(cursor)
        ids_stmt = ids_stmt.where(
            (Post.created_at < cursor_dt)
            | ((Post.created_at == cursor_dt) & (Post.id < cursor_id))
        )
    else:
        ids_stmt = ids_stmt.offset(offset)

    ids_stmt = ids_stmt.limit(limit + 1)
    ids_result = await session.execute(ids_stmt)
    post_ids = [row[0] for row in ids_result.all()]

    next_cursor = None
    if len(post_ids) > limit:
        post_ids = post_ids[:limit]

    if not post_ids:
        return [], total, None

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

    items: list[tuple[Post, User, Profile, bool, str | None]] = []
    for pid in post_ids:
        if pid not in order_map:
            continue
        post, user, profile = order_map[pid]
        is_own = post.creator_user_id == current_user_id
        is_subscriber = post.creator_user_id in subscribed_ids
        is_follower = post.creator_user_id in followed_ids

        if post.visibility == VISIBILITY_PUBLIC or is_own:
            items.append((post, user, profile, False, None))
        elif post.visibility == VISIBILITY_FOLLOWERS and is_follower:
            items.append((post, user, profile, False, None))
        elif post.visibility == VISIBILITY_SUBSCRIBERS and is_subscriber:
            items.append((post, user, profile, False, None))
        elif post.visibility == VISIBILITY_SUBSCRIBERS:
            items.append((post, user, profile, True, "SUBSCRIPTION_REQUIRED"))
        elif post.visibility == VISIBILITY_FOLLOWERS:
            items.append((post, user, profile, True, "FOLLOW_REQUIRED"))

    # Generate next_cursor from the last item
    if items and len(post_ids) >= limit:
        last_post = items[-1][0]
        next_cursor = _feed_cursor_encode(last_post.created_at, last_post.id)

    return items, total, next_cursor


def _comment_cursor_encode(created_at: datetime, comment_id: UUID) -> str:
    return f"{created_at.isoformat()}|{comment_id}"


def _comment_cursor_decode(cursor: str) -> tuple[datetime, UUID]:
    try:
        created_at_s, comment_id_s = cursor.split("|", 1)
        return datetime.fromisoformat(created_at_s), UUID(comment_id_s)
    except Exception as exc:
        raise AppError(status_code=400, detail="invalid_cursor") from exc


def sanitize_comment_body(body: str) -> str:
    """Stub profanity filter hook for future stronger moderation."""
    return body.strip()


async def like_post(session: AsyncSession, post_id: UUID, user_id: UUID) -> None:
    settings = get_settings()
    await check_rate_limit_custom(f"rl:like:{user_id}", settings.rate_limit_likes_per_min, 60)
    post = (await session.execute(select(Post.id).where(Post.id == post_id))).scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")
    session.add(
        PostLike(
            post_id=post_id,
            user_id=user_id,
            created_at=datetime.now(timezone.utc),
        )
    )
    try:
        await session.commit()
        logger.info("post_liked post_id=%s user_id=%s", post_id, user_id)
    except IntegrityError:
        await session.rollback()


async def unlike_post(session: AsyncSession, post_id: UUID, user_id: UUID) -> None:
    like = (
        await session.execute(
            select(PostLike).where(
                PostLike.post_id == post_id,
                PostLike.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if like:
        await session.delete(like)
        await session.commit()


async def get_post_like_summary(session: AsyncSession, post_id: UUID, user_id: UUID) -> tuple[int, bool]:
    post_exists = (await session.execute(select(Post.id).where(Post.id == post_id))).scalar_one_or_none()
    if not post_exists:
        raise AppError(status_code=404, detail="post_not_found")
    count = (
        await session.execute(select(func.count(PostLike.post_id)).where(PostLike.post_id == post_id))
    ).scalar_one() or 0
    viewer_liked = (
        await session.execute(
            select(PostLike.post_id).where(PostLike.post_id == post_id, PostLike.user_id == user_id)
        )
    ).scalar_one_or_none() is not None
    return count, viewer_liked


async def create_comment(
    session: AsyncSession, post_id: UUID, user_id: UUID, body: str
) -> PostComment:
    settings = get_settings()
    await check_rate_limit_custom(
        f"rl:comment:{user_id}",
        settings.rate_limit_comments_per_min,
        60,
    )
    post = (await session.execute(select(Post).where(Post.id == post_id))).scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")
    clean_body = sanitize_comment_body(body)
    if not clean_body:
        raise AppError(status_code=400, detail="comment_body_required")
    comment = PostComment(
        post_id=post_id,
        user_id=user_id,
        body=clean_body,
        created_at=datetime.now(timezone.utc),
    )
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    logger.info("post_commented post_id=%s comment_id=%s user_id=%s", post_id, comment.id, user_id)
    if settings.enable_notifications and post.creator_user_id != user_id:
        try:
            from app.celery_client import enqueue_create_notification

            enqueue_create_notification(
                str(post.creator_user_id),
                "COMMENT_ON_POST",
                {
                    "post_id": str(post_id),
                    "comment_id": str(comment.id),
                    "actor_user_id": str(user_id),
                },
            )
        except Exception:
            pass
    return comment


async def list_comments_page(
    session: AsyncSession,
    post_id: UUID,
    *,
    cursor: str | None = None,
    page_size: int = 30,
) -> tuple[list[PostComment], str | None, int]:
    total = (
        await session.execute(
            select(func.count(PostComment.id)).where(
                PostComment.post_id == post_id,
                PostComment.deleted_at.is_(None),
            )
        )
    ).scalar_one() or 0
    q = (
        select(PostComment)
        .where(
            PostComment.post_id == post_id,
            PostComment.deleted_at.is_(None),
        )
        .order_by(PostComment.created_at.desc(), PostComment.id.desc())
    )
    if cursor:
        cursor_dt, cursor_id = _comment_cursor_decode(cursor)
        q = q.where(
            (PostComment.created_at < cursor_dt)
            | ((PostComment.created_at == cursor_dt) & (PostComment.id < cursor_id))
        )
    rows = list((await session.execute(q.limit(page_size + 1))).scalars().all())
    next_cursor = None
    if len(rows) > page_size:
        rows = rows[:page_size]
        last = rows[-1]
        next_cursor = _comment_cursor_encode(last.created_at, last.id)
    return rows, next_cursor, total


async def delete_comment(session: AsyncSession, comment_id: UUID, requester_id: UUID) -> None:
    row = (
        await session.execute(
            select(PostComment, Post).join(Post, Post.id == PostComment.post_id).where(PostComment.id == comment_id)
        )
    ).one_or_none()
    if not row:
        raise AppError(status_code=404, detail="comment_not_found")
    comment, post = row
    if requester_id not in {comment.user_id, post.creator_user_id}:
        raise AppError(status_code=403, detail="forbidden_comment_delete")
    if comment.deleted_at is None:
        comment.deleted_at = datetime.now(timezone.utc)
        await session.commit()


async def delete_post(session: AsyncSession, post_id: UUID, creator_user_id: UUID) -> None:
    """Delete a post and all its associations. Creator-only."""
    post = (
        await session.execute(
            select(Post).where(Post.id == post_id, Post.creator_user_id == creator_user_id)
            .options(selectinload(Post.media))
        )
    ).scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")
    from sqlalchemy import delete as sa_delete
    for pm in list(post.media):
        await session.delete(pm)
    await session.execute(sa_delete(PostLike).where(PostLike.post_id == post_id))
    await session.execute(sa_delete(PostComment).where(PostComment.post_id == post_id))
    await session.delete(post)
    await session.commit()
    logger.info("post_deleted post_id=%s creator=%s", post_id, creator_user_id)


async def update_post(
    session: AsyncSession,
    post_id: UUID,
    creator_user_id: UUID,
    *,
    caption: str | None = ...,  # type: ignore[assignment]
    visibility: str | None = None,
) -> Post:
    """Update mutable fields of a post (caption, visibility). Creator-only."""
    post = (
        await session.execute(
            select(Post).where(Post.id == post_id, Post.creator_user_id == creator_user_id)
            .options(selectinload(Post.media))
        )
    ).scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")
    if caption is not ...:
        post.caption = caption
    if visibility is not None:
        if visibility not in (VISIBILITY_PUBLIC, VISIBILITY_FOLLOWERS, VISIBILITY_SUBSCRIBERS):
            raise AppError(status_code=400, detail="invalid_visibility")
        post.visibility = visibility
    await session.commit()
    result = await session.execute(
        select(Post).where(Post.id == post.id).options(selectinload(Post.media))
    )
    return result.scalar_one()


async def publish_post_now(session: AsyncSession, post_id: UUID, creator_user_id: UUID) -> Post:
    post = (
        await session.execute(
            select(Post).where(
                Post.id == post_id,
                Post.creator_user_id == creator_user_id,
            )
        )
    ).scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")
    post.status = POST_STATUS_PUBLISHED
    post.publish_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(post)
    return post


async def publish_due_scheduled_posts(session: AsyncSession) -> int:
    now = datetime.now(timezone.utc)
    due_posts = list(
        (
            await session.execute(
                select(Post).where(
                    Post.status == POST_STATUS_SCHEDULED,
                    Post.publish_at.is_not(None),
                    Post.publish_at <= now,
                )
            )
        ).scalars().all()
    )
    for post in due_posts:
        post.status = POST_STATUS_PUBLISHED
    if due_posts:
        await session.commit()
        logger.info("scheduled_posts_published count=%s", len(due_posts))
    return len(due_posts)


async def search_posts(
    session: AsyncSession,
    q: str,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[tuple[Post, User, Profile]], int]:
    """
    Search public published posts by caption using pg_trgm GIN index.
    Returns (items, total) where items is list of (post, user, profile).
    """
    from sqlalchemy import text as sa_text
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=True,
    )
    search_term = q.strip()
    if not search_term:
        return [], 0

    pattern = f"%{search_term}%"
    now = datetime.now(timezone.utc)

    base_where = [
        Post.status == POST_STATUS_PUBLISHED,
        Post.visibility == VISIBILITY_PUBLIC,
        or_(Post.publish_at.is_(None), Post.publish_at <= now),
        Post.caption.ilike(pattern),
    ]

    count_result = await session.execute(
        select(func.count(Post.id)).where(*base_where)
    )
    total = count_result.scalar_one() or 0

    query = (
        select(Post, User, Profile)
        .join(User, User.id == Post.creator_user_id)
        .join(Profile, Profile.user_id == User.id)
        .where(*base_where)
        .options(selectinload(Post.media))
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await session.execute(query)).all()
    items = [(post, user, profile) for post, user, profile in rows]
    return items, total