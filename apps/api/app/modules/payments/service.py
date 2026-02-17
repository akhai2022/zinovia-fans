"""Payments service: tips, PPV intent creation."""

from __future__ import annotations

import logging
from uuid import UUID

import stripe
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.auth.rate_limit import check_rate_limit_custom
from app.modules.payments.models import PpvPurchase, Tip

logger = logging.getLogger(__name__)

STRIPE_KEY_PLACEHOLDER = "sk_test_placeholder"


def _get_stripe_key() -> str:
    """Return the configured Stripe secret key or raise."""
    settings = get_settings()
    key = (settings.stripe_secret_key or "").strip()
    if not key or key == STRIPE_KEY_PLACEHOLDER:
        raise AppError(status_code=501, detail="stripe_not_configured")
    return key


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
    """Create Tip row and Stripe PaymentIntent. Return (tip, client_secret)."""
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

    api_key = _get_stripe_key()

    tip = Tip(
        tipper_id=tipper_id,
        creator_id=creator_id,
        conversation_id=conversation_id,
        message_id=message_id,
        amount_cents=amount_cents,
        currency=currency.lower(),
        stripe_payment_intent_id="",  # set after PI created
        status="REQUIRES_PAYMENT",
    )
    session.add(tip)
    await session.flush()

    pi = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency=currency.lower(),
        metadata={
            "type": "TIP",
            "creator_id": str(creator_id),
            "tip_id": str(tip.id),
        },
        api_key=api_key,
    )
    tip.stripe_payment_intent_id = pi.id
    await session.commit()
    await session.refresh(tip)
    client_secret = pi.client_secret or ""
    return tip, client_secret


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
    return purchase, data.get("client_secret") or ""
