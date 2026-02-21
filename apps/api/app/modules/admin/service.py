from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import or_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.auth.models import Profile, User
from app.modules.billing.models import Subscription
from app.modules.ledger.models import LedgerEvent
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
        .outerjoin(Profile, Profile.user_id == User.id)
    )
    if where:
        count_q = count_q.where(*where)
    total = (await session.execute(count_q)).scalar_one() or 0

    q = (
        select(User, Profile)
        .outerjoin(Profile, Profile.user_id == User.id)
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
            "handle": profile.handle if profile else None,
            "display_name": profile.display_name if profile else user.email.split("@")[0],
            "bio": profile.bio if profile else None,
            "phone": user.phone,
            "country": user.country,
            "discoverable": profile.discoverable if profile else False,
            "featured": getattr(profile, "featured", False) if profile else False,
            "verified": profile.verified if profile else False,
            "signup_ip": user.signup_ip,
            "last_login_ip": user.last_login_ip,
            "last_login_at": user.last_login_at,
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
    elif action == "verify":
        profile.verified = True
        logger.info("admin_verify user_id=%s reason=%s", target_user_id, reason)
    elif action == "unverify":
        profile.verified = False
        logger.info("admin_unverify user_id=%s reason=%s", target_user_id, reason)
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


async def list_transactions_admin(
    session: AsyncSession,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    *,
    type_filter: str | None = None,
) -> tuple[list[dict], int]:
    """Admin: list all ledger events (transactions) for the platform."""
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=True,
    )

    where = []
    if type_filter:
        where.append(LedgerEvent.type == type_filter)

    count_q = select(func.count(LedgerEvent.id))
    if where:
        count_q = count_q.where(*where)
    total = (await session.execute(count_q)).scalar_one() or 0

    q = (
        select(LedgerEvent, Profile)
        .outerjoin(User, User.id == LedgerEvent.creator_id)
        .outerjoin(Profile, Profile.user_id == User.id)
    )
    if where:
        q = q.where(*where)
    q = q.order_by(LedgerEvent.created_at.desc()).offset(offset).limit(limit)

    rows = (await session.execute(q)).all()
    items = []
    for event, profile in rows:
        items.append({
            "id": event.id,
            "type": event.type,
            "creator_user_id": event.creator_id,
            "creator_handle": profile.handle if profile else None,
            "creator_display_name": profile.display_name if profile else None,
            "gross_cents": event.gross_cents,
            "fee_cents": event.fee_cents,
            "net_cents": event.net_cents,
            "currency": event.currency,
            "reference_type": event.reference_type,
            "reference_id": event.reference_id,
            "created_at": event.created_at,
        })
    return items, total


# ---------------------------------------------------------------------------
# Users (all roles) — list, detail, posts, subscribers, actions
# ---------------------------------------------------------------------------


def _user_to_dict(user: User, profile: Profile | None) -> dict:
    """Convert a (User, Profile?) row to a flat dict for AdminUserOut."""
    return {
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "onboarding_state": user.onboarding_state,
        "handle": profile.handle if profile else None,
        "display_name": profile.display_name if profile else user.email.split("@")[0],
        "bio": profile.bio if profile else None,
        "phone": user.phone,
        "country": user.country,
        "discoverable": profile.discoverable if profile else False,
        "featured": getattr(profile, "featured", False) if profile else False,
        "verified": profile.verified if profile else False,
        "signup_ip": user.signup_ip,
        "last_login_ip": user.last_login_ip,
        "last_login_at": user.last_login_at,
        "last_activity_at": user.last_activity_at,
        "created_at": user.created_at,
    }


async def list_users_admin(
    session: AsyncSession,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    *,
    search: str | None = None,
    role_filter: str | None = None,
) -> tuple[list[dict], int]:
    """Admin: list all users (fans, creators, admins) with optional search."""
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=True,
    )

    where = []
    if role_filter:
        where.append(User.role == role_filter)
    else:
        # Hide soft-deleted users by default; admins can see them via role=deleted filter
        where.append(User.role != "deleted")
    if search:
        pattern = f"%{search}%"
        where.append(
            or_(
                User.email.ilike(pattern),
                Profile.handle.ilike(pattern),
                Profile.display_name.ilike(pattern),
            )
        )

    count_q = (
        select(func.count(User.id))
        .outerjoin(Profile, Profile.user_id == User.id)
    )
    if where:
        count_q = count_q.where(*where)
    total = (await session.execute(count_q)).scalar_one() or 0

    q = (
        select(User, Profile)
        .outerjoin(Profile, Profile.user_id == User.id)
    )
    if where:
        q = q.where(*where)
    q = q.order_by(User.created_at.desc()).offset(offset).limit(limit)

    rows = (await session.execute(q)).all()
    items = [_user_to_dict(user, profile) for user, profile in rows]
    return items, total


async def get_user_detail_admin(
    session: AsyncSession,
    user_id: UUID,
) -> dict:
    """Admin: get a single user with aggregate stats."""
    result = await session.execute(
        select(User, Profile)
        .outerjoin(Profile, Profile.user_id == User.id)
        .where(User.id == user_id)
    )
    row = result.one_or_none()
    if not row:
        raise AppError(status_code=404, detail="user_not_found")
    user, profile = row

    post_count = (await session.execute(
        select(func.count(Post.id)).where(Post.creator_user_id == user_id)
    )).scalar_one() or 0

    subscriber_count = (await session.execute(
        select(func.count(Subscription.id)).where(
            Subscription.creator_user_id == user_id,
            Subscription.status == "active",
        )
    )).scalar_one() or 0

    total_earned = (await session.execute(
        select(func.coalesce(func.sum(LedgerEvent.net_cents), 0)).where(
            LedgerEvent.creator_id == user_id
        )
    )).scalar_one() or 0

    data = _user_to_dict(user, profile)
    data["post_count"] = post_count
    data["subscriber_count"] = subscriber_count
    data["total_earned_cents"] = total_earned
    return data


async def list_user_posts_admin(
    session: AsyncSession,
    user_id: UUID,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[dict], int]:
    """Admin: list posts by a specific user."""
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=True,
    )
    total = (await session.execute(
        select(func.count(Post.id)).where(Post.creator_user_id == user_id)
    )).scalar_one() or 0

    q = (
        select(Post)
        .where(Post.creator_user_id == user_id)
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await session.execute(q)).scalars().all()
    items = [
        {
            "id": p.id,
            "type": p.type,
            "caption": p.caption,
            "visibility": p.visibility,
            "nsfw": p.nsfw,
            "status": p.status,
            "price_cents": p.price_cents,
            "currency": p.currency,
            "created_at": p.created_at,
        }
        for p in rows
    ]
    return items, total


async def list_user_subscribers_admin(
    session: AsyncSession,
    user_id: UUID,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[dict], int]:
    """Admin: list subscribers (fans) of a specific creator."""
    page, page_size, offset, limit = normalize_pagination(
        page, page_size,
        default_size=DEFAULT_PAGE_SIZE,
        max_size=MAX_PAGE_SIZE,
        invalid_page_size_use_default=True,
    )

    base_where = Subscription.creator_user_id == user_id
    total = (await session.execute(
        select(func.count(Subscription.id)).where(base_where)
    )).scalar_one() or 0

    fan_user = User.__table__.alias("fan_user")
    fan_profile = Profile.__table__.alias("fan_profile")

    q = (
        select(
            Subscription,
            fan_user.c.email.label("fan_email"),
            fan_profile.c.display_name.label("fan_display_name"),
        )
        .join(fan_user, fan_user.c.id == Subscription.fan_user_id)
        .outerjoin(fan_profile, fan_profile.c.user_id == Subscription.fan_user_id)
        .where(base_where)
        .order_by(Subscription.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await session.execute(q)).all()
    items = [
        {
            "fan_user_id": sub.fan_user_id,
            "fan_email": fan_email,
            "fan_display_name": fan_display_name or fan_email.split("@")[0],
            "status": sub.status,
            "created_at": sub.created_at,
        }
        for sub, fan_email, fan_display_name in rows
    ]
    return items, total


async def admin_action_user(
    session: AsyncSession,
    target_user_id: UUID,
    action: str,
    reason: str | None = None,
) -> dict:
    """Perform an admin action on any user (fan, creator, admin)."""
    result = await session.execute(
        select(User, Profile)
        .outerjoin(Profile, Profile.user_id == User.id)
        .where(User.id == target_user_id)
    )
    row = result.one_or_none()
    if not row:
        raise AppError(status_code=404, detail="user_not_found")
    user, profile = row

    if action == "delete":
        user.is_active = False
        user.role = "deleted"
        if profile:
            profile.discoverable = False
        logger.info("admin_delete user_id=%s reason=%s", target_user_id, reason)
    elif action == "suspend":
        user.is_active = False
        logger.info("admin_suspend user_id=%s reason=%s", target_user_id, reason)
    elif action == "activate":
        user.is_active = True
        logger.info("admin_activate user_id=%s", target_user_id)
    elif action == "approve":
        if profile:
            profile.discoverable = True
        logger.info("admin_approve user_id=%s reason=%s", target_user_id, reason)
    elif action == "reject":
        if profile:
            profile.discoverable = False
        logger.info("admin_reject user_id=%s reason=%s", target_user_id, reason)
    elif action == "feature":
        if profile and hasattr(profile, "featured"):
            profile.featured = True
        logger.info("admin_feature user_id=%s", target_user_id)
    elif action == "unfeature":
        if profile and hasattr(profile, "featured"):
            profile.featured = False
        logger.info("admin_unfeature user_id=%s", target_user_id)
    elif action == "verify":
        if profile:
            profile.verified = True
        logger.info("admin_verify user_id=%s reason=%s", target_user_id, reason)
    elif action == "unverify":
        if profile:
            profile.verified = False
        logger.info("admin_unverify user_id=%s reason=%s", target_user_id, reason)
    else:
        raise AppError(status_code=400, detail="invalid_action")

    await session.commit()
    return {"status": "ok", "action": action, "user_id": str(target_user_id)}
