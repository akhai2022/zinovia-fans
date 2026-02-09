from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings

logger = logging.getLogger(__name__)
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.billing.schemas import CheckoutSubscriptionCreate, CheckoutSubscriptionOut, WebhookAck
from app.modules.billing.service import (
    create_checkout_session,
    handle_stripe_event,
    mark_stripe_event_processed,
    record_stripe_event,
    verify_stripe_signature,
)
from app.modules.creators.service import get_creator_by_handle_any

router = APIRouter()


@router.post(
    "/checkout/subscription",
    response_model=CheckoutSubscriptionOut,
    status_code=200,
    operation_id="billing_checkout_subscription",
)
async def checkout_subscription(
    payload: CheckoutSubscriptionCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> CheckoutSubscriptionOut:
    """Start Stripe Checkout for subscribing to a creator. Returns URL to redirect the fan. 501 if Stripe not configured."""
    if payload.creator_handle is not None:
        try:
            user, *_ = await get_creator_by_handle_any(session, payload.creator_handle)
            creator_user_id = user.id
            creator_handle = payload.creator_handle
        except AppError:
            raise
    else:
        creator_user_id = payload.creator_id
        creator_handle = None
    checkout_url = await create_checkout_session(
        session,
        creator_user_id=creator_user_id,
        fan_user_id=current_user.id,
        success_url=payload.success_url,
        cancel_url=payload.cancel_url,
        creator_handle=creator_handle,
    )
    return CheckoutSubscriptionOut(checkout_url=checkout_url)


@router.post(
    "/webhooks/stripe",
    response_model=WebhookAck,
    operation_id="billing_webhooks_stripe",
)
async def stripe_webhook(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> WebhookAck:
    """Stripe webhook: signature verified, idempotent by event id. Store event then process; set processed_at."""
    payload_bytes = await request.body()
    settings = get_settings()
    if not settings.stripe_webhook_test_bypass and not (settings.stripe_webhook_secret or "").strip():
        logger.warning("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set; returning 501.")
        raise AppError(
            status_code=501,
            detail="Stripe not configured in this environment",
        )
    if settings.stripe_webhook_test_bypass:
        try:
            body = json.loads(payload_bytes.decode())
            event_id = body.get("id") or body.get("event_id")
            event_type = body.get("type", "")
            if event_id and event_type:
                logger.info(
                    "stripe webhook received event_id=%s event_type=%s",
                    event_id,
                    event_type,
                )
                processed, eid = await record_stripe_event(
                    session, event_id, event_type, payload=body
                )
                if not processed:
                    logger.info(
                        "stripe webhook idempotency skipped event_id=%s event_type=%s",
                        event_id,
                        event_type,
                    )
                    return WebhookAck(status="duplicate_ignored")
                import stripe
                event = stripe.Event.construct_from(body, None)
                await handle_stripe_event(session, event)
                if eid:
                    await mark_stripe_event_processed(session, eid)
                logger.info(
                    "stripe webhook processed event_id=%s event_type=%s",
                    event_id,
                    event_type,
                )
                return WebhookAck(status="processed")
        except Exception:
            pass
    if not stripe_signature:
        raise AppError(status_code=400, detail="missing_signature")
    event = verify_stripe_signature(payload_bytes, stripe_signature)
    logger.info(
        "stripe webhook received event_id=%s event_type=%s",
        event.id,
        event.type,
    )
    try:
        payload_dict = json.loads(payload_bytes.decode()) if payload_bytes else None
    except (json.JSONDecodeError, UnicodeDecodeError):
        payload_dict = None
    processed, eid = await record_stripe_event(
        session, event.id, event.type, payload=payload_dict
    )
    if not processed:
        logger.info(
            "stripe webhook idempotency skipped event_id=%s event_type=%s",
            event.id,
            event.type,
        )
        return WebhookAck(status="duplicate_ignored")
    await handle_stripe_event(session, event)
    if eid:
        await mark_stripe_event_processed(session, eid)
    logger.info(
        "stripe webhook processed event_id=%s event_type=%s",
        event.id,
        event.type,
    )
    return WebhookAck(status="processed")
