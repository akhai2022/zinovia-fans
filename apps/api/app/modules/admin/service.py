from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import delete, or_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.auth.constants import ADMIN_ROLE
from app.modules.auth.models import Profile, User
from app.modules.billing.models import Subscription
from app.modules.ledger.models import LedgerEvent
from app.modules.media.models import MediaObject
from app.modules.posts.models import Post, PostMedia
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
    """Admin: list all posts for moderation, including media thumbnails."""
    from app.modules.media.service import generate_signed_download
    from app.modules.media.storage import get_storage_client

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

    # Collect post IDs to batch-fetch media
    post_ids = [post.id for post, _ in rows]
    media_map: dict[str, list[dict]] = {}
    if post_ids:
        mq = (
            select(PostMedia.post_id, MediaObject.id, MediaObject.object_key, MediaObject.content_type)
            .join(MediaObject, MediaObject.id == PostMedia.media_asset_id)
            .where(PostMedia.post_id.in_(post_ids))
            .order_by(PostMedia.post_id, PostMedia.position)
        )
        media_rows = (await session.execute(mq)).all()
        storage = get_storage_client()
        for pm_post_id, mo_id, obj_key, ctype in media_rows:
            pid = str(pm_post_id)
            if pid not in media_map:
                media_map[pid] = []
            media_map[pid].append({
                "media_id": str(mo_id),
                "content_type": ctype,
                "download_url": generate_signed_download(storage, obj_key),
            })

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
            "media": media_map.get(str(post.id), []),
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


async def _hard_delete_user(session: AsyncSession, user_id: UUID) -> None:
    """Permanently delete a user and ALL related data. Irreversible."""
    from app.modules.ai.models import AiImageJob, BrandAsset
    from app.modules.ai_safety.models import ImageCaption, ImageSafetyScan, ImageTag
    from app.modules.audit.models import AuditEvent
    from app.modules.billing.models import CreatorPlan
    from app.modules.collections.models import Collection, CollectionPost
    from app.modules.creators.models import Follow
    from app.modules.media.models import MediaDerivedAsset, MediaObject
    from app.modules.messaging.models import Conversation, Message, MessageMedia
    from app.modules.notifications.models import Notification
    from app.modules.onboarding.models import (
        EmailVerificationToken,
        IdempotencyKey,
        KycSession,
        OnboardingAuditEvent,
    )
    from app.modules.payments.models import PostPurchase, PpvPurchase, Tip
    from app.modules.posts.models import PostComment, PostLike, PostMedia

    # Delete derived assets for media owned by this user
    owned_media_ids = select(MediaObject.id).where(MediaObject.owner_user_id == user_id)
    await session.execute(
        delete(MediaDerivedAsset).where(MediaDerivedAsset.parent_asset_id.in_(owned_media_ids))
    )

    # Delete messaging data (order matters: ppv_purchases → message_media → messages → conversations)
    user_convos = select(Conversation.id).where(
        or_(
            Conversation.creator_user_id == user_id,
            Conversation.fan_user_id == user_id,
        )
    )
    user_msgs = select(Message.id).where(Message.conversation_id.in_(user_convos))
    # PpvPurchase references message_media and conversations
    await session.execute(delete(PpvPurchase).where(
        or_(PpvPurchase.purchaser_id == user_id, PpvPurchase.creator_id == user_id)
    ))
    # Tip references conversations/messages (SET NULL FKs, but delete tips owned by user)
    await session.execute(delete(Tip).where(
        or_(Tip.tipper_id == user_id, Tip.creator_id == user_id)
    ))
    # MessageMedia → Messages → Conversations
    await session.execute(delete(MessageMedia).where(MessageMedia.message_id.in_(user_msgs)))
    await session.execute(delete(Message).where(Message.conversation_id.in_(user_convos)))
    await session.execute(
        delete(Conversation).where(
            or_(
                Conversation.creator_user_id == user_id,
                Conversation.fan_user_id == user_id,
            )
        )
    )

    # Delete collection posts for collections owned by this user
    user_collections = select(Collection.id).where(Collection.creator_user_id == user_id)
    await session.execute(
        delete(CollectionPost).where(CollectionPost.collection_id.in_(user_collections))
    )
    await session.execute(delete(Collection).where(Collection.creator_user_id == user_id))

    # Delete posts and related (purchases → likes → comments → post_media → posts)
    user_posts = select(Post.id).where(Post.creator_user_id == user_id)
    await session.execute(delete(PostPurchase).where(
        or_(PostPurchase.purchaser_id == user_id, PostPurchase.creator_id == user_id)
    ))
    await session.execute(delete(PostLike).where(
        or_(PostLike.post_id.in_(user_posts), PostLike.user_id == user_id)
    ))
    await session.execute(delete(PostComment).where(
        or_(PostComment.post_id.in_(user_posts), PostComment.user_id == user_id)
    ))
    await session.execute(delete(PostMedia).where(PostMedia.post_id.in_(user_posts)))
    await session.execute(delete(Post).where(Post.creator_user_id == user_id))

    # Billing
    await session.execute(delete(Subscription).where(
        or_(Subscription.fan_user_id == user_id, Subscription.creator_user_id == user_id)
    ))
    await session.execute(delete(CreatorPlan).where(CreatorPlan.creator_user_id == user_id))
    await session.execute(delete(LedgerEvent).where(LedgerEvent.creator_id == user_id))

    # Follows
    await session.execute(delete(Follow).where(
        or_(Follow.fan_user_id == user_id, Follow.creator_user_id == user_id)
    ))

    # Notifications
    await session.execute(delete(Notification).where(Notification.user_id == user_id))

    # Onboarding
    await session.execute(delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id))
    await session.execute(delete(OnboardingAuditEvent).where(OnboardingAuditEvent.creator_id == user_id))
    await session.execute(delete(IdempotencyKey).where(IdempotencyKey.creator_id == user_id))
    await session.execute(delete(KycSession).where(KycSession.creator_id == user_id))

    # AI
    await session.execute(delete(AiImageJob).where(AiImageJob.user_id == user_id))

    # SET NULL for shared references (don't delete other users' data)
    await session.execute(
        BrandAsset.__table__.update()
        .where(BrandAsset.updated_by_user_id == user_id)
        .values(updated_by_user_id=None)
    )
    await session.execute(
        ImageSafetyScan.__table__.update()
        .where(ImageSafetyScan.reviewed_by == user_id)
        .values(reviewed_by=None)
    )
    await session.execute(
        AuditEvent.__table__.update()
        .where(AuditEvent.actor_id == user_id)
        .values(actor_id=None)
    )

    # Media (after posts are deleted)
    # Clear profile avatar/banner FK references before deleting media
    await session.execute(
        Profile.__table__.update()
        .where(Profile.user_id == user_id)
        .values(avatar_asset_id=None, banner_asset_id=None)
    )
    # Nullify cross-user FK refs to this user's media (no CASCADE on these FKs)
    await session.execute(
        PostMedia.__table__.delete()
        .where(PostMedia.media_asset_id.in_(owned_media_ids))
    )
    await session.execute(
        MessageMedia.__table__.delete()
        .where(MessageMedia.media_asset_id.in_(owned_media_ids))
    )
    await session.execute(
        Collection.__table__.update()
        .where(Collection.cover_asset_id.in_(owned_media_ids))
        .values(cover_asset_id=None)
    )
    # Explicitly delete AI safety data (DB CASCADE should handle this, but belt-and-suspenders)
    await session.execute(delete(ImageSafetyScan).where(ImageSafetyScan.media_asset_id.in_(owned_media_ids)))
    await session.execute(delete(ImageCaption).where(ImageCaption.media_asset_id.in_(owned_media_ids)))
    await session.execute(delete(ImageTag).where(ImageTag.media_asset_id.in_(owned_media_ids)))
    await session.execute(delete(MediaObject).where(MediaObject.owner_user_id == user_id))

    # Profile + User
    await session.execute(delete(Profile).where(Profile.user_id == user_id))
    await session.execute(delete(User).where(User.id == user_id))


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

    if action == "hard_delete":
        logger.info("admin_hard_delete user_id=%s reason=%s", target_user_id, reason)
        try:
            await _hard_delete_user(session, target_user_id)
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("hard_delete FAILED for user_id=%s", target_user_id)
            raise AppError(
                status_code=500,
                detail="hard_delete_failed — check server logs for FK constraint details",
            )
        return {"status": "ok", "action": action, "user_id": str(target_user_id)}

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
    elif action == "promote_admin":
        user.role = ADMIN_ROLE
        logger.info("admin_promote user_id=%s reason=%s", target_user_id, reason)
    elif action == "demote_admin":
        user.role = "fan"
        logger.info("admin_demote user_id=%s reason=%s", target_user_id, reason)
    else:
        raise AppError(status_code=400, detail="invalid_action")

    await session.commit()
    return {"status": "ok", "action": action, "user_id": str(target_user_id)}
