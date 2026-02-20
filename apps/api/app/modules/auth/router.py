from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.auth.rate_limit import check_rate_limit
from app.modules.auth.schemas import ChangePasswordRequest, ForgotPasswordRequest, ProfileOut, ResetPasswordRequest, TokenResponse, UserCreate, UserLogin, UserOut
from app.modules.auth.service import (
    authenticate_user,
    change_password,
    create_token_for_user,
    create_user,
    register_creator,
)
from app.modules.onboarding.constants import CREATED
from app.modules.onboarding.deps import require_idempotency_key
from app.modules.onboarding.schemas import (
    CreatorRegisterRequest,
    CreatorRegisterResponse,
    ResendVerificationEmailRequest,
    VerifyEmailRequest,
)
from app.modules.onboarding.service import (
    consume_email_verification_token,
    create_email_verification_token,
    get_or_create_idempotency_response,
    transition_creator_state,
)
from app.modules.onboarding.mail import (
    VerificationEmailDeliveryError,
    send_verification_email,
)
from app.modules.audit.service import (
    log_audit_event,
    ACTION_LOGIN,
    ACTION_LOGOUT,
    ACTION_PASSWORD_CHANGE,
    ACTION_PASSWORD_RESET,
    ACTION_PASSWORD_RESET_REQUEST,
    ACTION_SIGNUP,
    ACTION_VERIFY_EMAIL,
)

router = APIRouter()


def _get_client_ip(request: Request) -> str | None:
    """Extract real client IP from X-Forwarded-For (set by ALB/CloudFront) or fall back to direct connection."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # X-Forwarded-For: client, proxy1, proxy2 — first entry is the real client
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _cookie_settings() -> dict[str, object]:
    settings = get_settings()
    cookie_settings: dict[str, object] = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "path": "/",
        "max_age": settings.jwt_expire_minutes * 60,
    }
    if settings.cookie_domain:
        cookie_settings["domain"] = settings.cookie_domain
    return cookie_settings


@router.post(
    "/register",
    response_model=CreatorRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="auth_register",
)
async def register(
    payload: CreatorRegisterRequest,
    request: Request,
    idempotency_key: str = Depends(require_idempotency_key),
    session: AsyncSession = Depends(get_async_session),
) -> CreatorRegisterResponse:
    client_ip = _get_client_ip(request)

    async def _do() -> dict:
        user = await register_creator(session, payload.email, payload.password)
        if client_ip:
            user.signup_ip = client_ip
        token = await create_email_verification_token(session, user.id)
        email_delivery_status = "sent"
        email_delivery_error_code: str | None = None
        try:
            await send_verification_email(payload.email, token)
        except VerificationEmailDeliveryError as exc:
            email_delivery_status = "failed"
            email_delivery_error_code = exc.reason_code
        return {
            "creator_id": str(user.id),
            "email_delivery_status": email_delivery_status,
            "email_delivery_error_code": email_delivery_error_code,
        }
    result, created = await get_or_create_idempotency_response(
        session=session,
        key=idempotency_key,
        creator_id=None,
        endpoint="auth/register",
        request_body=payload.model_dump_json(),
        create_response=_do,
    )
    if created and result.get("creator_id"):
        await log_audit_event(
            session,
            action=ACTION_SIGNUP,
            actor_id=UUID(result["creator_id"]),
            resource_type="user",
            resource_id=result["creator_id"],
            metadata={"role": "creator"},
            ip_address=client_ip,
        )
    return CreatorRegisterResponse(**result)


@router.post(
    "/resend-verification-email",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    operation_id="auth_resend_verification_email",
    summary="Resend verification email (safe)",
    description=(
        "Requests a new verification email. Always returns 200 to avoid user enumeration. "
        "Rate-limited by IP+email."
    ),
)
async def resend_verification_email(
    payload: ResendVerificationEmailRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    client_ip = _get_client_ip(request) or "unknown"
    rate_limit_key = f"resend_verify:{client_ip}:{payload.email}"
    if not await check_rate_limit(rate_limit_key):
        raise AppError(status_code=429, detail="rate_limit_exceeded")

    # Default response: do not reveal whether email exists.
    email_delivery_status = "sent"
    email_delivery_error_code: str | None = None

    result = await session.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user:
        return {
            "email_delivery_status": email_delivery_status,
            "email_delivery_error_code": email_delivery_error_code,
        }
    if user.onboarding_state != CREATED:
        # Already verified or not in a resendable state.
        return {
            "email_delivery_status": email_delivery_status,
            "email_delivery_error_code": email_delivery_error_code,
        }

    token = await create_email_verification_token(session, user.id)
    try:
        await send_verification_email(payload.email, token)
    except VerificationEmailDeliveryError as exc:
        email_delivery_status = "failed"
        email_delivery_error_code = exc.reason_code
    return {
        "email_delivery_status": email_delivery_status,
        "email_delivery_error_code": email_delivery_error_code,
    }


@router.post(
    "/verify-email",
    status_code=status.HTTP_200_OK,
    operation_id="auth_verify_email",
)
async def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    response: Response,
    idempotency_key: str = Depends(require_idempotency_key),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    import secrets as _secrets

    client_ip = _get_client_ip(request)

    async def _do() -> dict:
        user = await consume_email_verification_token(session, payload.token)
        if not user:
            raise AppError(status_code=400, detail="invalid_or_expired_token")
        if user.onboarding_state != CREATED:
            raise AppError(status_code=400, detail="invalid_state_for_verification")
        await transition_creator_state(
            session,
            user.id,
            "EMAIL_VERIFIED",
            "email_verified",
            {"token_consumed": True},
        )
        await log_audit_event(
            session,
            action=ACTION_VERIFY_EMAIL,
            actor_id=user.id,
            resource_type="user",
            resource_id=str(user.id),
            ip_address=client_ip,
            auto_commit=False,
        )
        # Auto-login: set session cookie so user doesn't have to sign in again
        from datetime import UTC, datetime as _dt
        user.last_login_at = _dt.now(UTC)
        user.last_login_ip = client_ip
        token = create_token_for_user(user)
        response.set_cookie("access_token", token, **_cookie_settings())  # type: ignore[arg-type]
        csrf_token = _secrets.token_urlsafe(32)
        settings = get_settings()
        csrf_cookie_kwargs: dict[str, object] = {
            "httponly": False,
            "secure": settings.cookie_secure,
            "samesite": settings.cookie_samesite,
            "path": "/",
            "max_age": settings.jwt_expire_minutes * 60,
        }
        if settings.cookie_domain:
            csrf_cookie_kwargs["domain"] = settings.cookie_domain
        response.set_cookie("csrf_token", csrf_token, **csrf_cookie_kwargs)  # type: ignore[arg-type]
        return {"creator_id": str(user.id), "state": "EMAIL_VERIFIED", "role": user.role}
    result, _ = await get_or_create_idempotency_response(
        session=session,
        key=idempotency_key,
        creator_id=None,
        endpoint="auth/verify-email",
        request_body=payload.model_dump_json(),
        create_response=_do,
    )
    return dict(result)


@router.post(
    "/signup",
    status_code=status.HTTP_201_CREATED,
    operation_id="auth_signup",
)
async def signup(
    payload: UserCreate, request: Request, session: AsyncSession = Depends(get_async_session)
) -> dict:
    client_ip = _get_client_ip(request)
    user = await create_user(session, payload.email, payload.password, payload.display_name)
    if client_ip:
        user.signup_ip = client_ip
        await session.commit()
    # Send verification email (same as creator flow)
    token = await create_email_verification_token(session, user.id)
    email_delivery_status = "sent"
    email_delivery_error_code: str | None = None
    try:
        await send_verification_email(payload.email, token)
    except VerificationEmailDeliveryError as exc:
        email_delivery_status = "failed"
        email_delivery_error_code = exc.reason_code
    await log_audit_event(
        session,
        action=ACTION_SIGNUP,
        actor_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        metadata={"role": "fan"},
        ip_address=client_ip,
    )
    return {
        "user_id": str(user.id),
        "email_delivery_status": email_delivery_status,
        "email_delivery_error_code": email_delivery_error_code,
    }


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    operation_id="auth_forgot_password",
    summary="Request password reset",
    description="Sends a reset email if the address is registered. Always returns 200 to prevent user enumeration.",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    import logging as _logging
    _logger = _logging.getLogger(__name__)

    from app.modules.auth.password_reset import create_password_reset_token

    client_ip = _get_client_ip(request) or "unknown"
    rate_limit_key = f"password_reset:{client_ip}:{payload.email}"
    if not await check_rate_limit(rate_limit_key):
        raise AppError(status_code=429, detail="rate_limited")

    token = await create_password_reset_token(session, payload.email)
    if not token:
        _logger.info("forgot_password: no user found for email (not revealing to client)")
        return {"status": "ok", "message": "If an account exists with that email, a reset link has been sent."}

    settings = get_settings()
    reset_url = f"{settings.public_web_base_url}/reset-password?token={token}"
    _logger.info("forgot_password: sending reset email via %s", settings.mail_provider)
    try:
        from app.modules.onboarding.mail import send_password_reset_email
        await send_password_reset_email(payload.email, reset_url)
        _logger.info("forgot_password: reset email sent successfully")
    except Exception as exc:
        _logger.error("forgot_password: failed to send reset email: %s: %s", type(exc).__name__, exc)
    await log_audit_event(
        session,
        action=ACTION_PASSWORD_RESET_REQUEST,
        resource_type="user",
        metadata={"email_hash": str(hash(payload.email))},
        ip_address=client_ip,
    )
    return {"status": "ok", "message": "If an account exists with that email, a reset link has been sent."}


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    operation_id="auth_reset_password",
    summary="Reset password using token",
)
async def reset_password(
    payload: ResetPasswordRequest,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    from app.modules.auth.password_reset import consume_password_reset_token

    await consume_password_reset_token(session, payload.token, payload.new_password)
    await log_audit_event(
        session,
        action=ACTION_PASSWORD_RESET,
        resource_type="user",
    )
    return {"status": "ok", "message": "Password has been reset. You can now sign in."}


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    operation_id="auth_change_password",
    summary="Change password (authenticated)",
    description="Requires current password. New password must be at least 10 characters.",
)
async def change_password_endpoint(
    payload: ChangePasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> dict:
    await change_password(session, user, payload.current_password, payload.new_password)
    client_ip = _get_client_ip(request)
    await log_audit_event(
        session,
        action=ACTION_PASSWORD_CHANGE,
        actor_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=client_ip,
    )
    return {"status": "ok"}


@router.post("/login", response_model=TokenResponse, operation_id="auth_login")
async def login(
    payload: UserLogin,
    response: Response,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> TokenResponse:
    import secrets as _secrets

    client_ip = _get_client_ip(request) or "unknown"
    rate_limit_key = f"login:{client_ip}:{payload.email}"
    if not await check_rate_limit(rate_limit_key):
        raise AppError(status_code=429, detail="rate_limit_exceeded")
    from datetime import UTC, datetime as _dt

    user = await authenticate_user(session, payload.email, payload.password)
    user.last_login_ip = client_ip
    user.last_login_at = _dt.now(UTC)
    await session.commit()
    token = create_token_for_user(user)
    await log_audit_event(
        session,
        action=ACTION_LOGIN,
        actor_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=client_ip,
    )
    settings = get_settings()
    response.set_cookie("access_token", token, **_cookie_settings())  # type: ignore[arg-type]
    # Set CSRF double-submit cookie (readable by JS, not httponly)
    csrf_token = _secrets.token_urlsafe(32)
    csrf_cookie_kwargs: dict[str, object] = {
        "httponly": False,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "path": "/",
        "max_age": settings.jwt_expire_minutes * 60,
    }
    if settings.cookie_domain:
        csrf_cookie_kwargs["domain"] = settings.cookie_domain
    response.set_cookie("csrf_token", csrf_token, **csrf_cookie_kwargs)  # type: ignore[arg-type]
    return TokenResponse(access_token=token)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    operation_id="auth_logout",
    summary="Logout",
    description="Clears the session cookie. Frontend should call this then setUser(null).",
)
async def logout(
    response: Response,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> dict:
    client_ip = _get_client_ip(request)
    await log_audit_event(
        session,
        action=ACTION_LOGOUT,
        actor_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=client_ip,
    )
    settings = get_settings()
    delete_kwargs: dict[str, object] = {"path": "/"}
    if settings.cookie_domain:
        delete_kwargs["domain"] = settings.cookie_domain
    response.delete_cookie("access_token", **delete_kwargs)  # type: ignore[arg-type]
    response.delete_cookie("csrf_token", **delete_kwargs)  # type: ignore[arg-type]
    return {"status": "ok"}


@router.get(
    "/me",
    response_model=UserOut,
    operation_id="auth_me",
    summary="Current user",
    description="Returns the current authenticated user (any role). Use cookie or Bearer token.",
)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        profile=ProfileOut.model_validate(user.profile) if user.profile else None,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get(
    "/session",
    response_model=UserOut,
    operation_id="auth_session",
    summary="Current session",
    description="Alias of /auth/me for frontend session checks.",
)
async def session(user: User = Depends(get_current_user)) -> UserOut:
    return await me(user)


@router.get(
    "/dev/tokens",
    status_code=status.HTTP_200_OK,
    operation_id="auth_dev_tokens",
    summary="[DEV ONLY] Get verification/reset tokens for a user",
    description=(
        "Returns the latest email verification and password reset tokens for a given email. "
        "Only available in local/staging environments. Disabled in production."
    ),
)
async def dev_tokens(
    request: Request,
    email: str = "",
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Dev-only: retrieve tokens by email so you can test the flow without SES."""
    settings = get_settings()
    if settings.environment in ("production", "prod"):
        raise AppError(status_code=404, detail="not_found")
    if not email:
        raise AppError(status_code=400, detail="email_required")

    user_result = await session.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if not user:
        return {"email": email, "verification_token": None, "password_reset_token": None}

    # Latest email verification token
    from app.modules.onboarding.models import EmailVerificationToken
    from datetime import datetime, UTC

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

    # Build the verify link for convenience
    verify_link = None
    if verification:
        from urllib.parse import quote
        base = (settings.public_web_base_url or settings.app_base_url).rstrip("/")
        verify_link = f"{base}/verify-email?token={quote(verification.token)}"

    # Password reset token
    reset_link = None
    if user.password_reset_token and user.password_reset_expires and user.password_reset_expires > datetime.now(UTC):
        base = (settings.public_web_base_url or settings.app_base_url).rstrip("/")
        reset_link = f"{base}/reset-password?token={user.password_reset_token}"

    return {
        "email": email,
        "user_id": str(user.id),
        "onboarding_state": user.onboarding_state,
        "verification_token": verification.token if verification else None,
        "verification_link": verify_link,
        "password_reset_token": user.password_reset_token if user.password_reset_expires and user.password_reset_expires > datetime.now(UTC) else None,
        "password_reset_link": reset_link,
    }
