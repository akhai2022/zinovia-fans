from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.auth.models import Profile, User
from app.modules.posts.models import Post
from app.shared.pagination import normalize_pagination

logger = logging.getLogger(__name__)

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


async def list_creators_admin(
    session: AsyncSession,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    *,
    role_filter: str | None = None,
    discoverable_filter: bool | None = None,
) -> tuple[list[dict], int]:
    """Admin: list all creators with profile info for moderation."""
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=True,
    )

    where = []
    if role_filter:
        where.append(User.role == role_filter)
    if discoverable_filter is not None:
        where.append(Profile.discoverable.is_(discoverable_filter))

    count_q = (
        select(func.count(User.id))
        .join(Profile, Profile.user_id == User.id)
    )
    if where:
        count_q = count_q.where(*where)
    total = (await session.execute(count_q)).scalar_one() or 0

    q = (
        select(User, Profile)
        .join(Profile, Profile.user_id == User.id)
    )
    if where:
        q = q.where(*where)
    q = q.order_by(User.created_at.desc()).offset(offset).limit(limit)

    rows = (await session.execute(q)).all()
    items = []
    for user, profile in rows:
        items.append({
            "user_id": user.id,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "onboarding_state": user.onboarding_state,
            "handle": profile.handle,
            "display_name": profile.display_name,
            "bio": profile.bio,
            "discoverable": profile.discoverable,
            "featured": getattr(profile, "featured", False),
            "created_at": user.created_at,
        })
    return items, total


async def admin_action_creator(
    session: AsyncSession,
    target_user_id: UUID,
    action: str,
    reason: str | None = None,
) -> dict:
    """Perform an admin action on a creator."""
    result = await session.execute(
        select(User, Profile)
        .join(Profile, Profile.user_id == User.id)
        .where(User.id == target_user_id)
    )
    row = result.one_or_none()
    if not row:
        raise AppError(status_code=404, detail="user_not_found")
    user, profile = row

    if action == "approve":
        profile.discoverable = True
        logger.info("admin_approve user_id=%s reason=%s", target_user_id, reason)
    elif action == "reject":
        profile.discoverable = False
        logger.info("admin_reject user_id=%s reason=%s", target_user_id, reason)
    elif action == "feature":
        if hasattr(profile, "featured"):
            profile.featured = True
        logger.info("admin_feature user_id=%s", target_user_id)
    elif action == "unfeature":
        if hasattr(profile, "featured"):
            profile.featured = False
        logger.info("admin_unfeature user_id=%s", target_user_id)
    elif action == "suspend":
        user.is_active = False
        logger.info("admin_suspend user_id=%s reason=%s", target_user_id, reason)
    elif action == "activate":
        user.is_active = True
        logger.info("admin_activate user_id=%s", target_user_id)
    else:
        raise AppError(status_code=400, detail="invalid_action")

    await session.commit()
    return {"status": "ok", "action": action, "user_id": str(target_user_id)}


async def list_posts_admin(
    session: AsyncSession,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[dict], int]:
    """Admin: list all posts for moderation."""
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=True,
    )
    total = (
        await session.execute(select(func.count(Post.id)))
    ).scalar_one() or 0

    q = (
        select(Post, Profile)
        .join(User, User.id == Post.creator_user_id)
        .join(Profile, Profile.user_id == User.id)
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await session.execute(q)).all()
    items = []
    for post, profile in rows:
        items.append({
            "id": post.id,
            "creator_user_id": str(post.creator_user_id),
            "creator_handle": profile.handle,
            "type": post.type,
            "caption": post.caption,
            "visibility": post.visibility,
            "nsfw": post.nsfw,
            "status": post.status,
            "created_at": post.created_at,
        })
    return items, total


async def admin_action_post(
    session: AsyncSession,
    post_id: UUID,
    action: str,
    reason: str | None = None,
) -> dict:
    """Remove or restore a post (admin moderation)."""
    post = (
        await session.execute(select(Post).where(Post.id == post_id))
    ).scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")

    if action == "remove":
        post.status = "REMOVED"
        logger.info("admin_remove_post post_id=%s reason=%s", post_id, reason)
    elif action == "restore":
        post.status = "PUBLISHED"
        logger.info("admin_restore_post post_id=%s", post_id)
    else:
        raise AppError(status_code=400, detail="invalid_action")

    await session.commit()
    return {"status": "ok", "action": action, "post_id": str(post_id)}
