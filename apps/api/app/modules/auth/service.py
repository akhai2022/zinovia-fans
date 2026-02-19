from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.auth.constants import CREATOR_ROLE, FAN_ROLE
from app.modules.auth.models import Profile, User
from app.modules.auth.security import create_access_token, hash_password, verify_password


async def create_user(
    session: AsyncSession, email: str, password: str, display_name: str
) -> User:
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=FAN_ROLE,
        onboarding_state="CREATED",
    )
    profile = Profile(user=user, display_name=display_name)
    session.add_all([user, profile])
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AppError(status_code=400, detail="email_already_registered") from exc
    await session.refresh(user)
    return user


async def register_creator(
    session: AsyncSession, email: str, password: str
) -> User:
    """Create creator (user with role=creator, onboarding_state=CREATED)."""
    display_name = email.split("@")[0] or "Creator"
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=CREATOR_ROLE,
        onboarding_state="CREATED",
    )
    profile = Profile(user=user, display_name=display_name)
    session.add_all([user, profile])
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AppError(status_code=400, detail="email_already_registered") from exc
    await session.refresh(user)
    return user


async def authenticate_user(session: AsyncSession, email: str, password: str) -> User:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise AppError(status_code=401, detail="invalid_credentials")
    # Block login for users who haven't verified their email yet.
    if user.onboarding_state == "CREATED":
        raise AppError(status_code=401, detail="email_not_verified")
    user.last_login_at = datetime.now(UTC)
    await session.commit()
    return user


async def change_password(
    session: AsyncSession, user: User, current_password: str, new_password: str
) -> None:
    """Change password for an authenticated user. Verifies current password first."""
    if not verify_password(current_password, user.password_hash):
        raise AppError(status_code=400, detail="wrong_current_password")
    if verify_password(new_password, user.password_hash):
        raise AppError(status_code=400, detail="same_as_current")
    user.password_hash = hash_password(new_password)
    await session.commit()


def create_token_for_user(user: User) -> str:
    return create_access_token(subject=str(user.id), role=user.role)
