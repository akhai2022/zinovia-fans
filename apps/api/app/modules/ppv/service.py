from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import stripe
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.messaging.models import Conversation, Message, MessageMedia
from app.modules.payments.models import PpvPurchase


def _ensure_enabled() -> None:
    if not get_settings().enable_ppvm:
        raise AppError(status_code=503, detail="ppv_disabled")


def _get_stripe_key() -> str:
    """Return the configured Stripe secret key or raise."""
    settings = get_settings()
    key = (settings.stripe_secret_key or "").strip()
    if not key or key == "sk_test_placeholder":
        raise AppError(status_code=501, detail="stripe_not_configured")
    return key


async def _check_intent_rate_limit(session: AsyncSession, purchaser_id: UUID) -> None:
    settings = get_settings()
    since = datetime.now(timezone.utc) - timedelta(minutes=1)
    count = (
        await session.execute(
            select(func.count(PpvPurchase.id)).where(
                PpvPurchase.purchaser_id == purchaser_id,
                PpvPurchase.created_at >= since,
            )
        )
    ).scalar_one() or 0
    if count >= settings.ppv_intent_rate_limit_per_min:
        raise AppError(status_code=429, detail="rate_limit_exceeded")


async def _get_message_media_context(
    session: AsyncSession, message_media_id: UUID
) -> tuple[MessageMedia, Message, Conversation]:
    row = (
        await session.execute(
            select(MessageMedia, Message, Conversation)
            .join(Message, Message.id == MessageMedia.message_id)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(MessageMedia.id == message_media_id)
        )
    ).one_or_none()
    if not row:
        raise AppError(status_code=404, detail="message_media_not_found")
    return row


async def get_ppv_status(
    session: AsyncSession,
    *,
    message_media_id: UUID,
    viewer_id: UUID,
) -> tuple[bool, bool, int | None, str | None]:
    mm, _msg, conv = await _get_message_media_context(session, message_media_id)
    if viewer_id not in {conv.creator_user_id, conv.fan_user_id}:
        raise AppError(status_code=403, detail="ppv_not_participant")
    if not mm.is_locked:
        return False, True, mm.price_cents, mm.currency
    if viewer_id == conv.creator_user_id:
        return True, True, mm.price_cents, mm.currency
    unlocked = (
        await session.execute(
            select(PpvPurchase.id).where(
                PpvPurchase.purchaser_id == viewer_id,
                PpvPurchase.message_media_id == message_media_id,
                PpvPurchase.status == "SUCCEEDED",
            )
        )
    ).scalar_one_or_none() is not None
    return True, unlocked, mm.price_cents, mm.currency


async def create_ppv_message_media_intent(
    session: AsyncSession,
    *,
    purchaser_id: UUID,
    message_media_id: UUID,
) -> dict:
    _ensure_enabled()
    api_key = _get_stripe_key()
    await _check_intent_rate_limit(session, purchaser_id)
    settings = get_settings()

    mm, _msg, conv = await _get_message_media_context(session, message_media_id)
    if purchaser_id not in {conv.creator_user_id, conv.fan_user_id}:
        raise AppError(status_code=403, detail="ppv_not_participant")
    if purchaser_id == conv.creator_user_id:
        raise AppError(status_code=403, detail="ppv_creator_only")
    if not mm.is_locked:
        raise AppError(status_code=400, detail="ppv_not_locked")
    if not mm.price_cents or mm.price_cents < settings.min_ppv_cents or mm.price_cents > settings.max_ppv_cents:
        raise AppError(status_code=400, detail="ppv_price_invalid")
    if (mm.currency or "").lower() != settings.default_currency.lower():
        raise AppError(status_code=400, detail="ppv_price_invalid")

    existing = (
        await session.execute(
            select(PpvPurchase).where(
                PpvPurchase.purchaser_id == purchaser_id,
                PpvPurchase.message_media_id == message_media_id,
            )
        )
    ).scalar_one_or_none()
    if existing and existing.status == "SUCCEEDED":
        return {
            "purchase_id": existing.id,
            "client_secret": None,
            "amount_cents": existing.amount_cents,
            "currency": existing.currency,
            "status": "ALREADY_UNLOCKED",
        }

    metadata = {
        "type": "PPV_MESSAGE_UNLOCK",
        "purchase_id": str(existing.id) if existing else "",
        "message_media_id": str(message_media_id),
        "conversation_id": str(conv.id),
        "creator_id": str(conv.creator_user_id),
        "purchaser_id": str(purchaser_id),
    }

    if existing is None:
        existing = PpvPurchase(
            purchaser_id=purchaser_id,
            creator_id=conv.creator_user_id,
            message_media_id=message_media_id,
            conversation_id=conv.id,
            amount_cents=mm.price_cents,
            currency=(mm.currency or settings.default_currency).lower(),
            stripe_payment_intent_id="",
            stripe_charge_id=None,
            status="REQUIRES_PAYMENT",
        )
        session.add(existing)
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            raise AppError(status_code=409, detail="ppv_already_unlocked") from exc
        metadata["purchase_id"] = str(existing.id)

    pi = stripe.PaymentIntent.create(
        amount=existing.amount_cents,
        currency=existing.currency,
        metadata=metadata,
        api_key=api_key,
    )
    existing.stripe_payment_intent_id = pi.id
    existing.status = "REQUIRES_PAYMENT"
    await session.commit()
    await session.refresh(existing)
    return {
        "purchase_id": existing.id,
        "client_secret": pi.client_secret,
        "amount_cents": existing.amount_cents,
        "currency": existing.currency,
        "status": "REQUIRES_PAYMENT",
    }

