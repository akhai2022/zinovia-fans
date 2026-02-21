from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import Profile, User
from app.modules.auth.constants import ADMIN_ROLE, SUPER_ADMIN_ROLE
from app.modules.creators.constants import CREATOR_ROLE


def require_creator(user: User = Depends(get_current_user)) -> User:
    """Require user has creator, admin, or super_admin role."""
    if user.role not in (CREATOR_ROLE, ADMIN_ROLE, SUPER_ADMIN_ROLE):
        raise AppError(status_code=403, detail="creator_only")
    return user


_ALLOWED_ONBOARDING_STATES = {"KYC_APPROVED", "COMPLETED"}


async def require_creator_with_profile(
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(require_creator),
) -> User:
    """Require user has creator profile with handle set and email verified."""
    # Admins and super_admins bypass all profile/onboarding checks
    if user.role in (ADMIN_ROLE, SUPER_ADMIN_ROLE):
        return user
    result = await session.execute(select(Profile).where(Profile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile or not profile.handle:
        raise AppError(status_code=403, detail="profile_incomplete")
    if user.onboarding_state not in _ALLOWED_ONBOARDING_STATES:
        raise AppError(status_code=403, detail="kyc_required")
    return user
