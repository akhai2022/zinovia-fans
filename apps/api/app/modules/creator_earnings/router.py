"""Creator earnings and payouts API."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.creator_earnings.schemas import CreatorEarningsOut, PayoutSetupLinkOut
from app.modules.creator_earnings.service import get_creator_earnings
from app.modules.creators.deps import require_creator

router = APIRouter()


@router.get(
    "/earnings",
    response_model=CreatorEarningsOut,
    operation_id="creator_get_earnings",
    summary="Creator earnings",
    description="Returns gross/fees/net summary, last transactions, and payout method status.",
)
async def get_earnings(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator),
    days: int = Query(30, ge=1, le=365, description="Time range in days for summary"),
    limit: int = Query(20, ge=1, le=100, description="Max transactions to return"),
) -> CreatorEarningsOut:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    return await get_creator_earnings(
        session,
        current_user.id,
        since=since,
        limit_transactions=limit,
    )


@router.post(
    "/payouts/setup-link",
    response_model=PayoutSetupLinkOut,
    operation_id="creator_payouts_setup_link",
    summary="Stripe Connect setup link",
    description="Generates Account Link for onboarding. Returns 'not_configured' if Stripe Connect is not enabled.",
)
async def payouts_setup_link(
    current_user: User = Depends(require_creator),
) -> PayoutSetupLinkOut:
    """Stripe Connect is not configured; return stub. Extend when Connect is added."""
    return PayoutSetupLinkOut(
        configured=False,
        url=None,
        message="Stripe Connect payouts not configured. Contact support.",
    )
