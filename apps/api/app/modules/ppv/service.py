from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.billing.ccbill_client import build_flexform_url, ccbill_configured
from app.modules.messaging.models import Conversation, Message, MessageMedia
from app.modules.payments.models import PostPurchase, PpvPurchase
from app.modules.posts.models import Post


def _ensure_enabled() -> None:
    if not get_settings().enable_ppvm:
        raise AppError(status_code=503, detail="ppv_disabled")


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
    if not ccbill_configured():
        raise AppError(status_code=501, detail="payment_not_configured")
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
            "checkout_url": None,
            "amount_cents": existing.amount_cents,
            "currency": existing.currency,
            "status": "ALREADY_UNLOCKED",
        }

    if existing is None:
        existing = PpvPurchase(
            purchaser_id=purchaser_id,
            creator_id=conv.creator_user_id,
            message_media_id=message_media_id,
            conversation_id=conv.id,
            amount_cents=mm.price_cents,
            currency=(mm.currency or settings.default_currency).lower(),
            ccbill_transaction_id=None,
            status="REQUIRES_PAYMENT",
        )
        session.add(existing)
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            raise AppError(status_code=409, detail="ppv_already_unlocked") from exc

    price = Decimal(existing.amount_cents) / 100
    checkout_url = build_flexform_url(
        price=price,
        currency=existing.currency,
        initial_period_days=2,
        recurring=False,
        success_url=settings.checkout_success_url,
        failure_url=settings.checkout_cancel_url,
        custom_fields={
            "zv_payment_type": "PPV_MESSAGE_UNLOCK",
            "zv_fan_user_id": str(purchaser_id),
            "zv_creator_user_id": str(conv.creator_user_id),
            "zv_purchase_id": str(existing.id),
            "zv_message_media_id": str(message_media_id),
        },
    )
    existing.status = "REQUIRES_PAYMENT"
    await session.commit()
    await session.refresh(existing)
    return {
        "purchase_id": existing.id,
        "checkout_url": checkout_url,
        "amount_cents": existing.amount_cents,
        "currency": existing.currency,
        "status": "REQUIRES_PAYMENT",
    }


async def get_ppv_post_status(
    session: AsyncSession,
    *,
    post_id: UUID,
    viewer_id: UUID,
) -> tuple[bool, bool, int | None, str | None]:
    """Return (is_locked, viewer_has_unlocked, price_cents, currency) for a PPV post."""
    post = (
        await session.execute(select(Post).where(Post.id == post_id))
    ).scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")
    if post.visibility != "PPV":
        return False, True, None, None
    if post.creator_user_id == viewer_id:
        return True, True, post.price_cents, post.currency
    unlocked = (
        await session.execute(
            select(PostPurchase.id).where(
                PostPurchase.purchaser_id == viewer_id,
                PostPurchase.post_id == post_id,
                PostPurchase.status == "SUCCEEDED",
            )
        )
    ).scalar_one_or_none() is not None
    return True, unlocked, post.price_cents, post.currency


async def create_ppv_post_intent(
    session: AsyncSession,
    *,
    purchaser_id: UUID,
    post_id: UUID,
) -> dict:
    """Create a CCBill FlexForm checkout URL for a PPV post purchase."""
    settings = get_settings()
    if not settings.enable_ppv_posts:
        raise AppError(status_code=503, detail="ppv_posts_disabled")
    if not ccbill_configured():
        raise AppError(status_code=501, detail="payment_not_configured")

    post = (
        await session.execute(select(Post).where(Post.id == post_id))
    ).scalar_one_or_none()
    if not post:
        raise AppError(status_code=404, detail="post_not_found")
    if post.visibility != "PPV":
        raise AppError(status_code=400, detail="post_not_ppv")
    if post.creator_user_id == purchaser_id:
        raise AppError(status_code=400, detail="ppv_creator_cannot_purchase")
    if not post.price_cents or post.price_cents < settings.min_ppv_cents:
        raise AppError(status_code=400, detail="ppv_price_invalid")

    existing = (
        await session.execute(
            select(PostPurchase).where(
                PostPurchase.purchaser_id == purchaser_id,
                PostPurchase.post_id == post_id,
            )
        )
    ).scalar_one_or_none()
    if existing and existing.status == "SUCCEEDED":
        return {
            "purchase_id": existing.id,
            "checkout_url": None,
            "amount_cents": existing.amount_cents,
            "currency": existing.currency,
            "status": "ALREADY_UNLOCKED",
        }

    if existing is None:
        existing = PostPurchase(
            purchaser_id=purchaser_id,
            creator_id=post.creator_user_id,
            post_id=post_id,
            amount_cents=post.price_cents,
            currency=(post.currency or settings.default_currency).lower(),
            ccbill_transaction_id=None,
            status="REQUIRES_PAYMENT",
        )
        session.add(existing)
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            raise AppError(status_code=409, detail="ppv_already_purchased") from exc

    price = Decimal(existing.amount_cents) / 100
    checkout_url = build_flexform_url(
        price=price,
        currency=existing.currency,
        initial_period_days=2,
        recurring=False,
        success_url=settings.checkout_success_url,
        failure_url=settings.checkout_cancel_url,
        custom_fields={
            "zv_payment_type": "PPV_POST_UNLOCK",
            "zv_fan_user_id": str(purchaser_id),
            "zv_creator_user_id": str(post.creator_user_id),
            "zv_purchase_id": str(existing.id),
            "zv_post_id": str(post_id),
        },
    )
    existing.status = "REQUIRES_PAYMENT"
    await session.commit()
    await session.refresh(existing)
    return {
        "purchase_id": existing.id,
        "checkout_url": checkout_url,
        "amount_cents": existing.amount_cents,
        "currency": existing.currency,
        "status": "REQUIRES_PAYMENT",
    }
