"""Onboarding router."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.onboarding.schemas import OnboardingStatusResponse
from app.modules.onboarding.service import get_onboarding_checklist

router = APIRouter()


@router.get(
    "/status",
    response_model=OnboardingStatusResponse,
    operation_id="onboarding_status",
)
async def get_status(user: User = Depends(get_current_user)) -> OnboardingStatusResponse:
    state = user.onboarding_state or "CREATED"
    checklist = get_onboarding_checklist(state)
    return OnboardingStatusResponse(state=state, checklist=checklist)
