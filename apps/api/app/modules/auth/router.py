from __future__ import annotations

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
from app.modules.auth.schemas import ProfileOut, TokenResponse, UserCreate, UserLogin, UserOut
from app.modules.auth.service import (
    authenticate_user,
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

router = APIRouter()


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
    idempotency_key: str = Depends(require_idempotency_key),
    session: AsyncSession = Depends(get_async_session),
) -> CreatorRegisterResponse:
    async def _do() -> dict:
        user = await register_creator(session, payload.email, payload.password)
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
    result, _ = await get_or_create_idempotency_response(
        session=session,
        key=idempotency_key,
        creator_id=None,
        endpoint="auth/register",
        request_body=payload.model_dump_json(),
        create_response=_do,
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
    client_ip = request.client.host if request.client else "unknown"
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
    idempotency_key: str = Depends(require_idempotency_key),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
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
        return {"creator_id": str(user.id), "state": "EMAIL_VERIFIED"}
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
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="auth_signup",
)
async def signup(
    payload: UserCreate, session: AsyncSession = Depends(get_async_session)
) -> UserOut:
    user = await create_user(session, payload.email, payload.password, payload.display_name)
    result = await session.execute(select(User).options(selectinload(User.profile)).where(User.id == user.id))
    user = result.scalar_one()
    return UserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        profile=ProfileOut.model_validate(user.profile) if user.profile else None,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    operation_id="auth_forgot_password",
    summary="Request password reset",
    description="Sends a reset email if the address is registered. Always returns 200 to prevent user enumeration.",
)
async def forgot_password(
    payload: UserLogin,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    from app.modules.auth.password_reset import create_password_reset_token

    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"password_reset:{client_ip}:{payload.email}"
    if not await check_rate_limit(rate_limit_key):
        raise AppError(status_code=429, detail="rate_limited")

    token = await create_password_reset_token(session, payload.email)
    if token:
        # In production, send email with reset link.
        # For now, log the token and return success regardless.
        settings = get_settings()
        reset_url = f"{settings.public_web_base_url}/reset-password?token={token}"
        try:
            from app.modules.onboarding.mail import send_password_reset_email
            await send_password_reset_email(payload.email, reset_url)
        except Exception:
            pass  # Swallow to avoid user enumeration
    return {"status": "ok", "message": "If an account exists with that email, a reset link has been sent."}


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    operation_id="auth_reset_password",
    summary="Reset password using token",
)
async def reset_password(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    from app.modules.auth.password_reset import consume_password_reset_token

    body = await request.json()
    token = body.get("token")
    new_password = body.get("new_password")
    if not token or not new_password:
        raise AppError(status_code=400, detail="token_and_password_required")
    if len(new_password) < 10:
        raise AppError(status_code=400, detail="password_too_short")

    await consume_password_reset_token(session, token, new_password)
    return {"status": "ok", "message": "Password has been reset. You can now sign in."}


@router.post("/login", response_model=TokenResponse, operation_id="auth_login")
async def login(
    payload: UserLogin,
    response: Response,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"login:{client_ip}:{payload.email}"
    if not await check_rate_limit(rate_limit_key):
        raise AppError(status_code=429, detail="rate_limit_exceeded")
    user = await authenticate_user(session, payload.email, payload.password)
    token = create_token_for_user(user)
    response.set_cookie("access_token", token, **_cookie_settings())  # type: ignore[arg-type]
    return TokenResponse(access_token=token)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    operation_id="auth_logout",
    summary="Logout",
    description="Clears the session cookie. Frontend should call this then setUser(null).",
)
async def logout(response: Response) -> dict:
    response.delete_cookie("access_token", path="/")
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
