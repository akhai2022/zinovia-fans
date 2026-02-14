"""Creator earnings service: aggregate ledger events and payout profile."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.creator_earnings.schemas import (
    CreatorEarningsOut,
    EarningsSummary,
    LedgerEventOut,
    PayoutMethodStatus,
)
from app.modules.ledger.models import LedgerEvent
from app.modules.payments.models import CreatorPayoutProfile


async def get_creator_earnings(
    session: AsyncSession,
    creator_id: UUID,
    *,
    since: datetime | None = None,
    limit_transactions: int = 20,
) -> CreatorEarningsOut:
    """Aggregate earnings from ledger_events and return summary + last transactions + payout status."""
    if since is None:
        since = datetime.now(timezone.utc) - timedelta(days=30)

    # Aggregate gross, fee, net for time range
    agg = (
        select(
            func.coalesce(func.sum(LedgerEvent.gross_cents), 0).label("gross"),
            func.coalesce(func.sum(LedgerEvent.fee_cents), 0).label("fee"),
            func.coalesce(func.sum(LedgerEvent.net_cents), 0).label("net"),
            func.max(LedgerEvent.currency).label("currency"),
        )
        .where(
            LedgerEvent.creator_id == creator_id,
            LedgerEvent.created_at >= since,
        )
    )
    row = (await session.execute(agg)).one()
    gross = int(row.gross or 0)
    fee = int(row.fee or 0)
    net = int(row.net or 0)
    currency = row.currency or "usd"

    summary = EarningsSummary(
        gross_cents=gross,
        fee_cents=fee,
        net_cents=net,
        currency=currency,
    )

    # Last N transactions
    events_result = await session.execute(
        select(LedgerEvent)
        .where(LedgerEvent.creator_id == creator_id)
        .order_by(LedgerEvent.created_at.desc())
        .limit(limit_transactions)
    )
    events = list(events_result.scalars().all())
    last_transactions = [
        LedgerEventOut(
            id=evt.id,
            type=evt.type,
            gross_cents=evt.gross_cents,
            fee_cents=evt.fee_cents,
            net_cents=evt.net_cents,
            currency=evt.currency,
            reference_type=evt.reference_type,
            reference_id=evt.reference_id,
            created_at=evt.created_at,
        )
        for evt in events
    ]

    # Payout profile
    profile_result = await session.execute(
        select(CreatorPayoutProfile).where(CreatorPayoutProfile.creator_id == creator_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile and profile.stripe_account_id:
        payout_method = PayoutMethodStatus(
            stripe_account_id=profile.stripe_account_id,
            payouts_enabled=profile.payouts_enabled,
            charges_enabled=profile.charges_enabled,
            requirements_due=profile.requirements_due,
            configured=True,
        )
    else:
        payout_method = PayoutMethodStatus(configured=False)

    return CreatorEarningsOut(
        summary=summary,
        last_transactions=last_transactions,
        payout_method=payout_method,
    )
