from __future__ import annotations

from datetime import UTC, datetime
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import require_admin
from app.modules.auth.models import Profile, User
from app.modules.auth.service import _generate_unique_handle, _sanitize_handle
from app.modules.admin.schemas import (
    AdminCreatorAction,
    AdminCreatorPage,
    AdminCreatorOut,
    AdminPostAction,
    AdminPostOut,
    AdminPostPage,
    AdminTransactionOut,
    AdminTransactionPage,
    AdminUserAction,
    AdminUserDetailOut,
    AdminUserOut,
    AdminUserPage,
    AdminUserPostOut,
    AdminUserPostPage,
    AdminUserSubscriberOut,
    AdminUserSubscriberPage,
)
from app.modules.admin.service import (
    admin_action_creator,
    admin_action_post,
    admin_action_user,
    get_user_detail_admin,
    list_creators_admin,
    list_posts_admin,
    list_transactions_admin,
    list_user_posts_admin,
    list_user_subscribers_admin,
    list_users_admin,
)

router = APIRouter()


@router.get("/creators", response_model=AdminCreatorPage, operation_id="admin_list_creators")
async def list_creators(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: str | None = Query(None),
    discoverable: bool | None = Query(None),
) -> AdminCreatorPage:
    items, total = await list_creators_admin(
        session,
        page=page,
        page_size=page_size,
        role_filter=role,
        discoverable_filter=discoverable,
    )
    return AdminCreatorPage(
        items=[AdminCreatorOut(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/creators/{user_id}/action",
    operation_id="admin_action_creator",
)
async def action_creator(
    user_id: UUID,
    payload: AdminCreatorAction,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    return await admin_action_creator(session, user_id, payload.action, payload.reason)


@router.get("/posts", response_model=AdminPostPage, operation_id="admin_list_posts")
async def list_posts(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> AdminPostPage:
    items, total = await list_posts_admin(session, page=page, page_size=page_size)
    return AdminPostPage(
        items=[AdminPostOut(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/posts/{post_id}/action",
    operation_id="admin_action_post",
)
async def action_post(
    post_id: UUID,
    payload: AdminPostAction,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    return await admin_action_post(session, post_id, payload.action, payload.reason)


@router.get("/transactions", response_model=AdminTransactionPage, operation_id="admin_list_transactions")
async def list_transactions(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None, alias="type"),
) -> AdminTransactionPage:
    items, total = await list_transactions_admin(
        session,
        page=page,
        page_size=page_size,
        type_filter=type,
    )
    return AdminTransactionPage(
        items=[AdminTransactionOut(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Users (all roles) — list, detail, actions, posts, subscribers
# ---------------------------------------------------------------------------


@router.get("/users", response_model=AdminUserPage, operation_id="admin_list_users")
async def list_users(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    role: str | None = Query(None),
) -> AdminUserPage:
    items, total = await list_users_admin(
        session,
        page=page,
        page_size=page_size,
        search=search,
        role_filter=role,
    )
    return AdminUserPage(
        items=[AdminUserOut(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/users/{user_id}",
    response_model=AdminUserDetailOut,
    operation_id="admin_get_user",
)
async def get_user(
    user_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> AdminUserDetailOut:
    data = await get_user_detail_admin(session, user_id)
    return AdminUserDetailOut(**data)


@router.post(
    "/users/{user_id}/action",
    operation_id="admin_action_user",
)
async def action_user(
    user_id: UUID,
    payload: AdminUserAction,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    return await admin_action_user(session, user_id, payload.action, payload.reason)


@router.get(
    "/users/{user_id}/posts",
    response_model=AdminUserPostPage,
    operation_id="admin_list_user_posts",
)
async def list_user_posts(
    user_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> AdminUserPostPage:
    items, total = await list_user_posts_admin(
        session, user_id, page=page, page_size=page_size,
    )
    return AdminUserPostPage(
        items=[AdminUserPostOut(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/users/{user_id}/subscribers",
    response_model=AdminUserSubscriberPage,
    operation_id="admin_list_user_subscribers",
)
async def list_user_subscribers(
    user_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> AdminUserSubscriberPage:
    items, total = await list_user_subscribers_admin(
        session, user_id, page=page, page_size=page_size,
    )
    return AdminUserSubscriberPage(
        items=[AdminUserSubscriberOut(**item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Admin: token lookup & force-verify (for when SES isn't working)
# ---------------------------------------------------------------------------

@router.get(
    "/tokens",
    operation_id="admin_get_tokens",
    summary="Get pending verification/reset tokens for a user by email",
    description=(
        "Returns the latest email verification token and password reset token "
        "for the given email. Requires admin role. Use this when SES is not "
        "delivering emails and you need to complete the onboarding flow manually."
    ),
)
async def get_tokens(
    email: str = Query(..., description="User email to look up"),
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    from app.modules.onboarding.models import EmailVerificationToken

    user_result = await session.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if not user:
        raise AppError(status_code=404, detail="user_not_found")

    settings = get_settings()
    base = (settings.public_web_base_url or settings.app_base_url).rstrip("/")

    # Latest email verification token
    token_result = await session.execute(
        select(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.expires_at > datetime.now(UTC),
        )
        .order_by(EmailVerificationToken.created_at.desc())
        .limit(1)
    )
    verification = token_result.scalar_one_or_none()
    verify_link = (
        f"{base}/verify-email?token={quote(verification.token)}"
        if verification
        else None
    )

    # Password reset token
    reset_link = None
    reset_token = None
    if (
        user.password_reset_token
        and user.password_reset_expires
        and user.password_reset_expires > datetime.now(UTC)
    ):
        reset_token = user.password_reset_token
        reset_link = f"{base}/reset-password?token={reset_token}"

    return {
        "email": email,
        "user_id": str(user.id),
        "role": user.role,
        "onboarding_state": user.onboarding_state,
        "verification_token": verification.token if verification else None,
        "verification_link": verify_link,
        "verification_expires_at": (
            verification.expires_at.isoformat() if verification else None
        ),
        "password_reset_token": reset_token,
        "password_reset_link": reset_link,
        "password_reset_expires_at": (
            user.password_reset_expires.isoformat()
            if user.password_reset_expires
            and user.password_reset_expires > datetime.now(UTC)
            else None
        ),
    }


@router.post(
    "/force-verify-email",
    operation_id="admin_force_verify_email",
    summary="Force-verify a creator's email (skip email delivery)",
    description=(
        "Consumes the latest verification token and transitions the creator's "
        "onboarding state to EMAIL_VERIFIED. Use this when SES is not working "
        "and you need to unblock a creator."
    ),
)
async def force_verify_email(
    email: str = Query(..., description="Creator email to verify"),
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    from app.modules.onboarding.models import EmailVerificationToken
    from app.modules.onboarding.service import transition_creator_state

    user_result = await session.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if not user:
        raise AppError(status_code=404, detail="user_not_found")

    if user.onboarding_state != "CREATED":
        return {
            "status": "already_verified",
            "email": email,
            "onboarding_state": user.onboarding_state,
        }

    # Delete any pending verification tokens (cleanup)
    tokens_result = await session.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.id
        )
    )
    for token_row in tokens_result.scalars().all():
        await session.delete(token_row)

    # Transition state
    await transition_creator_state(
        session,
        user.id,
        "EMAIL_VERIFIED",
        "admin_force_verify",
        {"admin_action": True},
    )

    return {
        "status": "verified",
        "email": email,
        "user_id": str(user.id),
        "onboarding_state": "EMAIL_VERIFIED",
    }


@router.post(
    "/backfill-handles",
    operation_id="admin_backfill_handles",
    summary="Auto-generate handles for creators who don't have one",
)
async def backfill_handles(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    """Find all creators without a handle and generate one from their display name or email."""
    result = await session.execute(
        select(User, Profile)
        .join(Profile, Profile.user_id == User.id)
        .where(
            User.role == "creator",
            Profile.handle.is_(None),
        )
    )
    rows = result.all()
    updated = []
    for user, profile in rows:
        base = _sanitize_handle(profile.display_name or user.email.split("@")[0])
        handle = await _generate_unique_handle(session, base)
        profile.handle = handle
        profile.handle_normalized = handle.lower()
        updated.append({"user_id": str(user.id), "email": user.email, "handle": handle})
    await session.commit()
    return {"updated_count": len(updated), "creators": updated}


# ---------------------------------------------------------------------------
# Support Messages (contact form submissions)
# ---------------------------------------------------------------------------


@router.get("/support-messages", operation_id="admin_list_support_messages")
async def list_support_messages(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    category: str | None = Query(None),
    resolved: bool | None = Query(None),
) -> dict:
    """List contact form submissions for admin review."""
    from app.modules.contact.models import ContactSubmission

    where = []
    if category:
        where.append(ContactSubmission.category == category)
    if resolved is not None:
        where.append(ContactSubmission.resolved.is_(resolved))

    count_q = select(func.count(ContactSubmission.id))
    if where:
        count_q = count_q.where(*where)
    total = (await session.execute(count_q)).scalar_one() or 0

    unread_count = (await session.execute(
        select(func.count(ContactSubmission.id)).where(ContactSubmission.is_read.is_(False))
    )).scalar_one() or 0

    offset = (page - 1) * page_size
    q = select(ContactSubmission)
    if where:
        q = q.where(*where)
    q = q.order_by(ContactSubmission.created_at.desc()).offset(offset).limit(page_size)
    rows = (await session.execute(q)).scalars().all()

    items = [
        {
            "id": str(s.id),
            "email": s.email,
            "category": s.category,
            "subject": s.subject,
            "message": s.message,
            "ip_address": s.ip_address,
            "is_read": s.is_read,
            "resolved": s.resolved,
            "admin_notes": s.admin_notes,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in rows
    ]
    return {"items": items, "total": total, "unread_count": unread_count}


@router.post("/support-messages/{message_id}/read", operation_id="admin_mark_support_read")
async def mark_support_message_read(
    message_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    from app.modules.contact.models import ContactSubmission

    await session.execute(
        update(ContactSubmission)
        .where(ContactSubmission.id == message_id)
        .values(is_read=True)
    )
    await session.commit()
    return {"status": "ok"}


@router.post("/support-messages/{message_id}/resolve", operation_id="admin_resolve_support")
async def resolve_support_message(
    message_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    notes: str | None = Body(None),
) -> dict:
    from app.modules.contact.models import ContactSubmission

    values: dict = {"resolved": True, "is_read": True}
    if notes:
        values["admin_notes"] = notes
    await session.execute(
        update(ContactSubmission)
        .where(ContactSubmission.id == message_id)
        .values(**values)
    )
    await session.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# KYC Sessions (super_admin only)
# ---------------------------------------------------------------------------


@router.get("/kyc/sessions", operation_id="admin_list_kyc_sessions")
async def list_kyc_sessions(
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(require_admin),
) -> dict:
    """List all KYC sessions with creator info. Super_admin sees document URLs."""
    from app.modules.media.models import MediaObject
    from app.modules.media.storage import get_storage_client
    from app.modules.onboarding.models import KycSession

    query = select(KycSession).order_by(KycSession.created_at.desc())
    count_query = select(func.count(KycSession.id))

    if status_filter:
        query = query.where(KycSession.status == status_filter.upper())
        count_query = count_query.where(KycSession.status == status_filter.upper())

    total = (await session.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await session.execute(query.offset(offset).limit(page_size))
    sessions = result.scalars().all()

    is_super = admin.role == "super_admin"
    storage = get_storage_client() if is_super else None

    # Gather creator IDs and fetch profiles in bulk
    creator_ids = list({s.creator_id for s in sessions})
    creator_map: dict[UUID, dict] = {}
    if creator_ids:
        users_result = await session.execute(
            select(User, Profile)
            .outerjoin(Profile, User.id == Profile.user_id)
            .where(User.id.in_(creator_ids))
        )
        for u, p in users_result.all():
            creator_map[u.id] = {
                "user_id": str(u.id),
                "email": u.email,
                "display_name": p.display_name if p else u.email,
                "handle": p.handle if p else None,
                "avatar_url": p.avatar_url if p else None,
            }

    items = []
    for s in sessions:
        id_doc_url = None
        selfie_url = None

        if is_super and storage:
            if s.id_document_media_id:
                media = (
                    await session.execute(
                        select(MediaObject).where(
                            MediaObject.id == s.id_document_media_id
                        )
                    )
                ).scalar_one_or_none()
                if media:
                    id_doc_url = storage.create_signed_download_url(media.object_key)

            if s.selfie_media_id:
                media = (
                    await session.execute(
                        select(MediaObject).where(
                            MediaObject.id == s.selfie_media_id
                        )
                    )
                ).scalar_one_or_none()
                if media:
                    selfie_url = storage.create_signed_download_url(media.object_key)

        creator = creator_map.get(s.creator_id, {})
        items.append(
            {
                "id": str(s.id),
                "status": s.status,
                "date_of_birth": s.date_of_birth.isoformat() if s.date_of_birth else None,
                "id_document_url": id_doc_url,
                "selfie_url": selfie_url,
                "admin_notes": s.admin_notes,
                "reviewed_by": str(s.reviewed_by) if s.reviewed_by else None,
                "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "creator": creator,
            }
        )

    return {"items": items, "total": total}


@router.get("/users/{user_id}/kyc", operation_id="admin_get_user_kyc")
async def get_user_kyc(
    user_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    """Get KYC sessions for a user. Includes document URLs for super_admin."""
    from app.modules.media.models import MediaObject
    from app.modules.media.storage import get_storage_client
    from app.modules.onboarding.models import KycSession

    result = await session.execute(
        select(KycSession)
        .where(KycSession.creator_id == user_id)
        .order_by(KycSession.created_at.desc())
    )
    sessions = result.scalars().all()

    is_super = _admin.role == "super_admin"
    storage = get_storage_client() if is_super else None

    items = []
    for s in sessions:
        id_doc_url = None
        selfie_url = None

        if is_super and storage:
            if s.id_document_media_id:
                media = (
                    await session.execute(
                        select(MediaObject).where(
                            MediaObject.id == s.id_document_media_id
                        )
                    )
                ).scalar_one_or_none()
                if media:
                    id_doc_url = storage.create_signed_download_url(media.object_key)

            if s.selfie_media_id:
                media = (
                    await session.execute(
                        select(MediaObject).where(
                            MediaObject.id == s.selfie_media_id
                        )
                    )
                ).scalar_one_or_none()
                if media:
                    selfie_url = storage.create_signed_download_url(media.object_key)

        items.append(
            {
                "id": str(s.id),
                "status": s.status,
                "date_of_birth": s.date_of_birth.isoformat() if s.date_of_birth else None,
                "id_document_url": id_doc_url,
                "selfie_url": selfie_url,
                "admin_notes": s.admin_notes,
                "reviewed_by": str(s.reviewed_by) if s.reviewed_by else None,
                "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
                "redirect_url": s.redirect_url,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
        )

    return {"items": items, "total": len(items)}


class _KycReviewRequest(BaseModel):
    action: str
    notes: str | None = None


@router.post("/kyc/{session_id}/review", operation_id="admin_review_kyc")
async def review_kyc(
    session_id: UUID,
    payload: _KycReviewRequest,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(require_admin),
) -> dict:
    """Approve or reject a KYC session. Super_admin only."""
    if admin.role != "super_admin":
        raise AppError(status_code=403, detail="super_admin_required")
    if payload.action not in ("approve", "reject"):
        raise AppError(status_code=400, detail="action must be approve or reject")

    from app.modules.onboarding.constants import KYC_APPROVED, KYC_REJECTED
    from app.modules.onboarding.models import KycSession
    from app.modules.onboarding.service import transition_creator_state

    kyc = (
        await session.execute(select(KycSession).where(KycSession.id == session_id))
    ).scalar_one_or_none()
    if not kyc:
        raise AppError(status_code=404, detail="kyc_session_not_found")
    if kyc.status not in ("SUBMITTED", "CREATED"):
        raise AppError(status_code=400, detail="session_not_reviewable")

    now = datetime.now(UTC)
    kyc.admin_notes = payload.notes
    kyc.reviewed_by = admin.id
    kyc.reviewed_at = now

    if payload.action == "approve":
        kyc.status = "APPROVED"
        await transition_creator_state(
            session,
            kyc.creator_id,
            KYC_APPROVED,
            "admin_kyc_approved",
            {"session_id": str(kyc.id), "admin_id": str(admin.id)},
        )
    else:
        kyc.status = "REJECTED"
        await transition_creator_state(
            session,
            kyc.creator_id,
            KYC_REJECTED,
            "admin_kyc_rejected",
            {"session_id": str(kyc.id), "admin_id": str(admin.id), "notes": payload.notes},
        )

    await session.commit()
    return {"status": "ok", "action": payload.action, "session_id": str(session_id)}


# ---------------------------------------------------------------------------
# User Media (admin content management)
# ---------------------------------------------------------------------------


@router.get("/users/{user_id}/media", operation_id="admin_list_user_media")
async def list_user_media(
    user_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> dict:
    """List all media assets uploaded by a user."""
    from app.modules.media.models import MediaObject

    total = (await session.execute(
        select(func.count(MediaObject.id)).where(MediaObject.owner_user_id == user_id)
    )).scalar_one() or 0

    offset = (page - 1) * page_size
    q = (
        select(MediaObject)
        .where(MediaObject.owner_user_id == user_id)
        .order_by(MediaObject.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = (await session.execute(q)).scalars().all()

    from app.modules.media.service import generate_signed_download
    from app.modules.media.storage import get_storage_client

    storage = get_storage_client()
    items = [
        {
            "id": str(m.id),
            "object_key": m.object_key,
            "content_type": m.content_type,
            "size_bytes": m.size_bytes,
            "download_url": generate_signed_download(storage, m.object_key),
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in rows
    ]
    return {"items": items, "total": total}


@router.delete("/media/{media_id}", operation_id="admin_delete_media")
async def delete_media(
    media_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    """Delete a media asset and its derived variants. Removes from DB (S3 cleanup is separate)."""
    from app.modules.media.models import MediaDerivedAsset, MediaObject
    from app.modules.posts.models import PostMedia

    media = (await session.execute(
        select(MediaObject).where(MediaObject.id == media_id)
    )).scalar_one_or_none()
    if not media:
        raise AppError(status_code=404, detail="media_not_found")

    # Remove references
    await session.execute(delete(PostMedia).where(PostMedia.media_asset_id == media_id))
    await session.execute(delete(MediaDerivedAsset).where(MediaDerivedAsset.parent_asset_id == media_id))
    await session.execute(delete(MediaObject).where(MediaObject.id == media_id))
    await session.commit()
    return {"status": "ok", "media_id": str(media_id)}
