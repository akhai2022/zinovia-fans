from __future__ import annotations

from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.session import get_async_session
from app.modules.auth.constants import ADMIN_ROLE
from app.modules.auth.models import User
from app.modules.auth.security import decode_access_token


def _get_token_from_request(request: Request) -> str | None:
    """Cookie first (web); then Authorization Bearer (API clients)."""
    token: str | None = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
    return token or None


async def _resolve_user_from_request(
    request: Request,
    session: AsyncSession,
    *,
    required: bool,
) -> User | None:
    """Resolve User from request; cookie first, then Bearer. Raises when required=True and invalid/missing."""
    token = _get_token_from_request(request)
    if not token:
        if required:
            raise AppError(status_code=401, detail="missing_token")
        return None

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        if required:
            raise AppError(status_code=401, detail="invalid_token")
        return None

    try:
        user_id = UUID(payload["sub"])
    except ValueError as exc:
        if required:
            raise AppError(status_code=401, detail="invalid_token") from exc
        return None

    result = await session.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        if required:
            raise AppError(status_code=403, detail="inactive_user")
        return None
    return user


async def get_current_user(
    request: Request, session: AsyncSession = Depends(get_async_session)
) -> User:
    """Require authenticated user; cookie first, then Bearer."""
    user = await _resolve_user_from_request(request, session, required=True)
    assert user is not None  # required=True raises on failure
    return user


async def get_optional_user(
    request: Request, session: AsyncSession = Depends(get_async_session)
) -> User | None:
    """Optional auth; cookie first, then Bearer. Returns None if missing/invalid."""
    return await _resolve_user_from_request(request, session, required=False)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != ADMIN_ROLE:
        raise AppError(status_code=403, detail="insufficient_role")
    return user
