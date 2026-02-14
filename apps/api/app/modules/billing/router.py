from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.request_id import get_request_id
from app.core.settings import get_settings

logger = logging.getLogger(__name__)
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.billing.models import Subscription
from app.modules.billing.schemas import (
    BillingHealthOut,
    BillingStatusOut,
    CheckoutSubscriptionCreate,
    CheckoutSubscriptionOut,
    SubscriptionStatusItem,
    WebhookAck,
)
from app.modules.billing.service import (
    create_checkout_session,
    handle_stripe_event,
    mark_stripe_event_processed,
    record_stripe_event,
    stripe_mode,
    verify_stripe_signature,
)
from app.modules.creators.service import get_creator_by_handle_any

router = APIRouter()


async def _process_stripe_event_once(
    session: AsyncSession,
    *,
    request_id: str,
    event_id: str,
    event_type: str,
    event_payload: dict | None,
    event_obj: Any,
) -> WebhookAck:
    async with session.begin():
        processed, _ = await record_stripe_event(
            session, event_id, event_type, payload=event_payload
        )
        if not processed:
            logger.info(
                "stripe webhook duplicate",
                extra={
                    "request_id": request_id,
                    "stripe_event_id": event_id,
                    "event_type": event_type,
                    "outcome": "duplicate",
                },
            )
            return WebhookAck(status="duplicate_ignored")
        outcome = await handle_stripe_event(session, event_obj)
        await mark_stripe_event_processed(session, event_id)

    logger.info(
        "stripe webhook completed",
        extra={
            "request_id": request_id,
            "stripe_event_id": event_id,
            "event_type": event_type,
            "outcome": outcome,
        },
    )
    return WebhookAck(status=outcome)


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
        assert payload.creator_id is not None  # validator ensures exactly one of id/handle
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
    request_id = (
        request.headers.get("X-Request-Id")
        or request.headers.get("X-Amzn-Trace-Id")
        or get_request_id()
    )
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
        except json.JSONDecodeError as exc:
            logger.info(
                "stripe webhook invalid json",
                extra={
                    "request_id": request_id,
                    "stripe_event_id": "",
                    "event_type": "",
                    "outcome": "invalid_json",
                },
            )
            raise AppError(status_code=400, detail="invalid_payload") from exc
        try:
            event_id = body.get("id") or body.get("event_id")
            event_type = body.get("type", "")
            if event_id and event_type:
                import stripe
                event = stripe.Event.construct_from(body, None)
                return await _process_stripe_event_once(
                    session,
                    request_id=request_id,
                    event_id=event_id,
                    event_type=event_type,
                    event_payload=None,
                    event_obj=event,
                )
        except AppError:
            raise
        except Exception as exc:
            logger.info(
                "stripe webhook bypass invalid",
                extra={
                    "request_id": request_id,
                    "stripe_event_id": "",
                    "event_type": "",
                    "outcome": "invalid_payload",
                },
            )
            raise AppError(status_code=400, detail="invalid_payload") from exc
    if not stripe_signature:
        raise AppError(status_code=400, detail="missing_signature")
    try:
        event = verify_stripe_signature(payload_bytes, stripe_signature)
    except AppError as exc:
        if exc.detail == "invalid_signature":
            logger.info(
                "stripe webhook invalid signature",
                extra={
                    "request_id": request_id,
                    "stripe_event_id": "",
                    "event_type": "",
                    "outcome": "invalid_signature",
                },
            )
        raise

    return await _process_stripe_event_once(
        session,
        request_id=request_id,
        event_id=event.id,
        event_type=event.type,
        event_payload=None,
        event_obj=event,
    )


@router.post(
    "/portal",
    status_code=200,
    operation_id="billing_portal",
    summary="Create Stripe Customer Portal session",
    description="Returns a URL to the Stripe Customer Portal for managing subscriptions.",
)
async def billing_portal(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
    return_url: str | None = Query(default=None),
) -> dict:
    """Create a Stripe Customer Portal session for the current user."""
    import stripe as stripe_lib

    settings = get_settings()
    if not (settings.stripe_secret_key or "").strip():
        raise AppError(status_code=501, detail="Stripe not configured")
    stripe_lib.api_key = settings.stripe_secret_key

    # Find customer ID from an existing subscription
    sub_result = await session.execute(
        select(Subscription.stripe_customer_id)
        .where(
            Subscription.fan_user_id == current_user.id,
            Subscription.stripe_customer_id.isnot(None),
        )
        .limit(1)
    )
    customer_id = sub_result.scalar_one_or_none()
    if not customer_id:
        raise AppError(status_code=404, detail="no_stripe_customer")

    portal_return_url = return_url or settings.checkout_success_url or settings.app_base_url
    portal_session = stripe_lib.billing_portal.Session.create(
        customer=customer_id,
        return_url=portal_return_url,
    )
    return {"portal_url": portal_session.url}


@router.get(
    "/status",
    response_model=BillingStatusOut,
    status_code=200,
    operation_id="billing_status",
)
async def billing_status(
    creator_user_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> BillingStatusOut:
    query = select(Subscription).where(Subscription.fan_user_id == current_user.id)
    if creator_user_id is not None:
        query = query.where(Subscription.creator_user_id == creator_user_id)
    query = query.order_by(Subscription.updated_at.desc())
    result = await session.execute(query)
    rows = result.scalars().all()
    return BillingStatusOut(
        fan_user_id=current_user.id,
        items=[
            SubscriptionStatusItem(
                subscription_id=row.id,
                creator_user_id=row.creator_user_id,
                status=row.status,
                stripe_subscription_id=row.stripe_subscription_id,
                current_period_end=row.current_period_end,
                cancel_at_period_end=row.cancel_at_period_end,
                cancel_at=row.cancel_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ],
    )


@router.get(
    "/health",
    response_model=BillingHealthOut,
    status_code=200,
    operation_id="billing_health",
)
async def billing_health() -> BillingHealthOut:
    settings = get_settings()
    webhook_secret = (settings.stripe_webhook_secret or "").strip()
    webhook_secret_previous = (settings.stripe_webhook_secret_previous or "").strip()
    stripe_key = (settings.stripe_secret_key or "").strip()
    stripe_configured = (
        bool(stripe_key)
        and stripe_key != "sk_test_placeholder"
        and (
            settings.environment not in ("production", "prod")
            or stripe_key.startswith("sk_live_")
        )
    )
    return BillingHealthOut(
        stripe_mode=stripe_mode(),
        stripe_configured=stripe_configured,
        webhook_configured=bool(webhook_secret),
        webhook_previous_configured=bool(webhook_secret_previous),
        checkout_defaults_configured=bool(
            (settings.checkout_success_url or "").strip()
            and (settings.checkout_cancel_url or "").strip()
        ),
    )
