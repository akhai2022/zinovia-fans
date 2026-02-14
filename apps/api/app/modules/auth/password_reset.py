"""Password reset flow: request token via email, consume token to set new password."""
from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.auth.models import User
from app.modules.auth.security import hash_password

logger = logging.getLogger(__name__)

RESET_TOKEN_EXPIRY_MINUTES = 60
RESET_TOKEN_LENGTH = 64


async def create_password_reset_token(session: AsyncSession, email: str) -> str | None:
    """
    Create a password reset token for the user with the given email.
    Returns the token if user exists, None otherwise (to prevent user enumeration).
    """
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return None

    token = secrets.token_urlsafe(RESET_TOKEN_LENGTH)
    user.password_reset_token = token
    user.password_reset_expires = datetime.now(UTC) + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES)
    await session.commit()
    return token


async def consume_password_reset_token(
    session: AsyncSession,
    token: str,
    new_password: str,
) -> User:
    """
    Validate reset token and set the new password.
    Raises AppError on invalid/expired token.
    """
    result = await session.execute(
        select(User).where(
            User.password_reset_token == token,
            User.password_reset_expires > datetime.now(UTC),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise AppError(status_code=400, detail="invalid_or_expired_reset_token")

    user.password_hash = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await session.commit()
    logger.info("password_reset_completed user_id=%s", user.id)
    return user
