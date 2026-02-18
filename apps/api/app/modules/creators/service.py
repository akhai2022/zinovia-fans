from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.auth.models import Profile, User
from app.modules.creators.constants import (
    CREATOR_ROLE,
    DEFAULT_PAGE_SIZE,
    HANDLE_MAX_LENGTH,
    HANDLE_MIN_LENGTH,
    HANDLE_REGEX,
    MAX_PAGE_SIZE,
    RESERVED_HANDLES,
)
from app.modules.creators.models import Follow
from app.shared.pagination import normalize_pagination
from app.modules.posts.models import Post


def normalize_handle(handle: str) -> str:
    return handle.strip().lower()


def validate_handle(handle: str) -> None:
    normalized = normalize_handle(handle)
    if len(normalized) < HANDLE_MIN_LENGTH or len(normalized) > HANDLE_MAX_LENGTH:
        raise AppError(status_code=400, detail="handle_length_invalid")
    if not HANDLE_REGEX.match(handle):
        raise AppError(status_code=400, detail="handle_format_invalid")
    if normalized in RESERVED_HANDLES:
        raise AppError(status_code=400, detail="handle_reserved")


async def _get_creator_by_handle_inner(
    session: AsyncSession,
    handle: str,
    *,
    discoverable_only: bool = True,
    current_user_id: UUID | None = None,
) -> tuple[User, Profile, int, bool]:
    normalized = normalize_handle(handle)
    q = (
        select(Profile, User)
        .join(User, User.id == Profile.user_id)
        .where(
            Profile.handle_normalized == normalized,
            User.role == CREATOR_ROLE,
        )
    )
    if discoverable_only:
        q = q.where(Profile.discoverable.is_(True))
    profile_result = await session.execute(q)
    row = profile_result.one_or_none()
    if not row:
        raise AppError(status_code=404, detail="creator_not_found")
    profile, user = row
    if not profile.handle or not profile.handle_normalized:
        raise AppError(status_code=404, detail="creator_not_found")
    followers_count_result = await session.execute(
        select(func.count(Follow.id)).where(Follow.creator_user_id == user.id)
    )
    followers_count = followers_count_result.scalar_one() or 0
    is_following = False
    if current_user_id and current_user_id != user.id:
        follow_result = await session.execute(
            select(Follow.id).where(
                Follow.fan_user_id == current_user_id,
                Follow.creator_user_id == user.id,
            )
        )
        is_following = follow_result.scalar_one_or_none() is not None
    return user, profile, followers_count, is_following


async def get_posts_count(session: AsyncSession, creator_user_id: UUID) -> int:
    """Count posts for a creator. Does not load post rows."""
    result = await session.execute(
        select(func.count(Post.id)).where(Post.creator_user_id == creator_user_id)
    )
    return result.scalar_one() or 0


def _discoverable_where() -> tuple:
    """Base conditions for discoverable creators (role, handle set, discoverable)."""
    return (
        User.role == CREATOR_ROLE,
        Profile.discoverable.is_(True),
        Profile.handle.isnot(None),
        Profile.handle_normalized.isnot(None),
    )


async def get_discoverable_creators_page(
    session: AsyncSession,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    q: str | None = None,
) -> tuple[list[tuple[UUID, str, str, UUID | None, int, int]], int]:
    """
    Paginated discoverable creators with followers_count and posts_count.
    Optional search: q filters by handle or display_name (ILIKE).
    Single query with scalar subqueries to avoid N+1.
    """
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=True,
    )

    search_term = q.strip() if q else None
    search_filter = None
    if search_term:
        pattern = f"%{search_term}%"
        search_filter = or_(
            Profile.handle.ilike(pattern),
            Profile.display_name.ilike(pattern),
        )

    followers_subq = (
        select(func.count(Follow.id))
        .where(Follow.creator_user_id == Profile.user_id)
        .scalar_subquery()
    )
    posts_subq = (
        select(func.count(Post.id))
        .where(Post.creator_user_id == Profile.user_id)
        .scalar_subquery()
    )

    count_where = list(_discoverable_where())
    if search_filter is not None:
        count_where.append(search_filter)
    count_q = (
        select(func.count(Profile.user_id))
        .join(User, User.id == Profile.user_id)
        .where(*count_where)
    )
    total_result = await session.execute(count_q)
    total = total_result.scalar_one() or 0

    main_where = list(_discoverable_where())
    if search_filter is not None:
        main_where.append(search_filter)
    query = (
        select(
            Profile.user_id,
            Profile.handle,
            Profile.display_name,
            Profile.avatar_asset_id,
            followers_subq,
            posts_subq,
            Profile.verified,
        )
        .join(User, User.id == Profile.user_id)
        .where(*main_where)
        .order_by(Profile.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await session.execute(query)).all()
    # Each row: (user_id, handle, display_name, avatar_asset_id, followers_count, posts_count, verified)
    items = [
        (r[0], r[1] or "", r[2], r[3], r[4] or 0, r[5] or 0, r[6] or False)
        for r in rows
    ]
    return items, total


async def get_profile_by_user_id(session: AsyncSession, user_id: UUID) -> Profile:
    """Load profile for a user. Raises 404 if not found."""
    result = await session.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise AppError(status_code=404, detail="profile_not_found")
    return profile


async def get_creator_by_handle(
    session: AsyncSession,
    handle: str,
    *,
    current_user_id: UUID | None = None,
) -> tuple[User, Profile, int, bool]:
    """Resolve discoverable creator by handle (for profile page)."""
    return await _get_creator_by_handle_inner(
        session, handle, discoverable_only=True, current_user_id=current_user_id
    )


async def get_creator_by_handle_any(
    session: AsyncSession,
    handle: str,
    *,
    current_user_id: UUID | None = None,
) -> tuple[User, Profile, int, bool]:
    """Resolve creator by handle regardless of discoverable (e.g. for posts list)."""
    return await _get_creator_by_handle_inner(
        session, handle, discoverable_only=False, current_user_id=current_user_id
    )


async def update_creator_profile(
    session: AsyncSession, user_id: UUID, payload: dict
) -> Profile:
    result = await session.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise AppError(status_code=404, detail="profile_not_found")
    if "handle" in payload and payload["handle"] is not None:
        validate_handle(payload["handle"])
        profile.handle = payload["handle"].strip()
        profile.handle_normalized = normalize_handle(payload["handle"])
    for key in ("display_name", "bio", "discoverable", "nsfw"):
        if key in payload and payload[key] is not None:
            setattr(profile, key, payload[key])
    if "avatar_media_id" in payload and payload["avatar_media_id"] is not None:
        profile.avatar_asset_id = payload["avatar_media_id"]
    if "banner_media_id" in payload and payload["banner_media_id"] is not None:
        profile.banner_asset_id = payload["banner_media_id"]
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise AppError(status_code=400, detail="handle_taken")
    await session.refresh(profile)
    return profile


async def get_sitemap_creators(
    session: AsyncSession,
) -> list[tuple[str, str]]:
    """Return (handle, updated_at) for all discoverable creators. Used by sitemap generation."""
    query = (
        select(Profile.handle, Profile.updated_at)
        .join(User, User.id == Profile.user_id)
        .where(*_discoverable_where())
        .order_by(Profile.updated_at.desc())
    )
    rows = (await session.execute(query)).all()
    return [(r[0] or "", r[1].isoformat() if r[1] else "") for r in rows]


async def follow_creator(
    session: AsyncSession, fan_user_id: UUID, creator_user_id: UUID
) -> bool:
    if fan_user_id == creator_user_id:
        raise AppError(status_code=400, detail="cannot_follow_self")
    existing = await session.execute(
        select(Follow).where(
            Follow.fan_user_id == fan_user_id,
            Follow.creator_user_id == creator_user_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return False
    follow = Follow(fan_user_id=fan_user_id, creator_user_id=creator_user_id)
    session.add(follow)
    await session.commit()
    return True


async def unfollow_creator(
    session: AsyncSession, fan_user_id: UUID, creator_user_id: UUID
) -> bool:
    result = await session.execute(
        select(Follow).where(
            Follow.fan_user_id == fan_user_id,
            Follow.creator_user_id == creator_user_id,
        )
    )
    follow = result.scalar_one_or_none()
    if not follow:
        return False
    await session.delete(follow)
    await session.commit()
    return True


async def get_following_page(
    session: AsyncSession,
    fan_user_id: UUID,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[tuple[User, Profile]], int]:
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=True,
    )
    total_result = await session.execute(
        select(func.count(Follow.id)).where(Follow.fan_user_id == fan_user_id)
    )
    total = total_result.scalar_one() or 0
    rows_result = await session.execute(
        select(User, Profile)
        .join(Profile, Profile.user_id == User.id)
        .join(Follow, Follow.creator_user_id == User.id)
        .where(Follow.fan_user_id == fan_user_id)
        .order_by(Follow.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = rows_result.all()
    items = [(row[0], row[1]) for row in rows]
    return items, total
