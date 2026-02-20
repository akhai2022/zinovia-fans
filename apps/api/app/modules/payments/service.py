"""Payments service: tips, PPV intent creation via CCBill FlexForms."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.auth.rate_limit import check_rate_limit_custom
from app.modules.billing.ccbill_client import build_flexform_url, ccbill_configured
from app.modules.payments.models import PpvPurchase, Tip

logger = logging.getLogger(__name__)


async def create_tip_intent(
    session: AsyncSession,
    tipper_id: UUID,
    creator_id: UUID,
    amount_cents: int,
    currency: str,
    *,
    conversation_id: UUID | None = None,
    message_id: UUID | None = None,
) -> tuple[Tip, str]:
    """Create Tip row and CCBill FlexForm URL. Return (tip, checkout_url)."""
    settings = get_settings()
    await check_rate_limit_custom(
        f"rl:pay:{tipper_id}",
        settings.rate_limit_payments_per_min,
        60,
    )
    if amount_cents < settings.tip_min_cents:
        raise AppError(status_code=400, detail="amount_below_minimum")
    if amount_cents > settings.tip_max_cents:
        raise AppError(status_code=400, detail="amount_above_maximum")

    if not ccbill_configured():
        raise AppError(status_code=501, detail="payment_not_configured")

    from decimal import Decimal

    price = Decimal(amount_cents) / 100

    tip = Tip(
        tipper_id=tipper_id,
        creator_id=creator_id,
        conversation_id=conversation_id,
        message_id=message_id,
        amount_cents=amount_cents,
        currency=currency.lower(),
        ccbill_transaction_id=None,
        status="REQUIRES_PAYMENT",
    )
    session.add(tip)
    await session.flush()

    checkout_url = build_flexform_url(
        price=price,
        currency=currency.lower(),
        initial_period_days=2,
        recurring=False,
        success_url=settings.checkout_success_url,
        failure_url=settings.checkout_cancel_url,
        custom_fields={
            "zv_payment_type": "TIP",
            "zv_fan_user_id": str(tipper_id),
            "zv_creator_user_id": str(creator_id),
            "zv_tip_id": str(tip.id),
        },
    )
    await session.commit()
    await session.refresh(tip)
    return tip, checkout_url


async def create_ppv_intent(
    session: AsyncSession,
    purchaser_id: UUID,
    message_media_id: UUID,
) -> tuple[PpvPurchase, str]:
    """Legacy wrapper for /payments/ppv/create-intent."""
    from app.modules.ppv.service import create_ppv_message_media_intent

    data = await create_ppv_message_media_intent(
        session,
        purchaser_id=purchaser_id,
        message_media_id=message_media_id,
    )
    purchase_id = data.get("purchase_id")
    if not purchase_id:
        raise AppError(status_code=409, detail="ppv_already_unlocked")
    purchase = await session.get(PpvPurchase, purchase_id)
    if not purchase:
        raise AppError(status_code=500, detail="ppv_purchase_missing")
    return purchase, data.get("checkout_url") or ""
