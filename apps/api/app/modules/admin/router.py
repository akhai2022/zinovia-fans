from __future__ import annotations

from datetime import UTC, datetime
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import require_admin
from app.modules.auth.models import User
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
