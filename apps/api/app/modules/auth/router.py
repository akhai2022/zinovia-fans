from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.constants import COOKIE_SAMESITE
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.auth.rate_limit import check_rate_limit
from app.modules.auth.schemas import TokenResponse, UserCreate, UserLogin, UserOut
from app.modules.auth.service import authenticate_user, create_token_for_user, create_user

router = APIRouter()


def _cookie_settings() -> dict[str, object]:
    settings = get_settings()
    return {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": COOKIE_SAMESITE,
        "path": "/",
        "max_age": settings.jwt_expire_minutes * 60,
    }


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
        profile=user.profile,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


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
    response.set_cookie("access_token", token, **_cookie_settings())
    return TokenResponse(access_token=token)


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
        profile=user.profile,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
