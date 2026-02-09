from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import Profile, User
from app.modules.creators.constants import CREATOR_ROLE


def require_creator(user: User = Depends(get_current_user)) -> User:
    """Require user has creator role (e.g. for PATCH /creators/me)."""
    if user.role != CREATOR_ROLE:
        raise AppError(status_code=403, detail="creator_only")
    return user


async def require_creator_with_profile(
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(require_creator),
) -> User:
    """Require user has creator profile with handle set (e.g. for POST /posts)."""
    result = await session.execute(select(Profile).where(Profile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile or not profile.handle:
        raise AppError(status_code=403, detail="creator_only")
    return user
