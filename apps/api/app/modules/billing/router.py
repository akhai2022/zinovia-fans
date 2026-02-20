from __future__ import annotations

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
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
    CancelSubscriptionOut,
    CheckoutSubscriptionCreate,
    CheckoutSubscriptionOut,
    CreatorPlanOut,
    CreatorPlanUpdate,
    SubscriptionStatusItem,
    WebhookAck,
)
from app.modules.billing.service import (
    cancel_subscription,
    create_checkout_session,
    get_or_create_creator_plan,
    handle_ccbill_event,
    mark_event_processed,
    record_payment_event,
    update_creator_plan_price,
)
from app.modules.billing.ccbill_client import ccbill_configured, verify_webhook_digest
from app.modules.creators.deps import require_creator
from app.modules.creators.service import get_creator_by_handle_any

router = APIRouter()


async def _process_ccbill_event_once(
    session: AsyncSession,
    *,
    request_id: str,
    event_id: str,
    event_type: str,
    event_payload: dict,
) -> WebhookAck:
    async with session.begin():
        processed, _ = await record_payment_event(
            session, event_id, event_type, payload=event_payload
        )
        if not processed:
            logger.info(
                "ccbill webhook duplicate",
                extra={"request_id": request_id, "event_id": event_id, "event_type": event_type},
            )
            return WebhookAck(status="duplicate_ignored")
        outcome = await handle_ccbill_event(session, event_payload)
        await mark_event_processed(session, event_id)

    logger.info(
        "ccbill webhook completed",
        extra={"request_id": request_id, "event_id": event_id, "event_type": event_type, "outcome": outcome},
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
    """Start CCBill checkout for subscribing to a creator. Returns URL to redirect the fan."""
    if payload.creator_handle is not None:
        try:
            user, *_ = await get_creator_by_handle_any(session, payload.creator_handle)
            creator_user_id = user.id
            creator_handle = payload.creator_handle
        except AppError:
            raise
    else:
        assert payload.creator_id is not None
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
    "/webhooks/ccbill",
    response_model=WebhookAck,
    operation_id="billing_webhooks_ccbill",
)
async def ccbill_webhook(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> WebhookAck:
    """CCBill webhook: verify digest, idempotent by event id."""
    request_id = (
        request.headers.get("X-Request-Id")
        or request.headers.get("X-Amzn-Trace-Id")
        or get_request_id()
    )
    settings = get_settings()

    # Parse body — CCBill sends JSON or form-encoded depending on configuration
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            params = await request.json()
        except json.JSONDecodeError:
            raise AppError(status_code=400, detail="invalid_payload")
    else:
        form_data = await request.form()
        params = dict(form_data)

    # Bypass mode for tests
    if settings.ccbill_webhook_test_bypass:
        event_type = params.get("eventType", "")
        event_id = params.get("transactionId") or params.get("subscriptionId") or ""
        if not event_type:
            raise AppError(status_code=400, detail="missing_event_type")
        return await _process_ccbill_event_once(
            session,
            request_id=request_id,
            event_id=f"{event_type}:{event_id}",
            event_type=event_type,
            event_payload=params,
        )

    # Verify webhook digest
    if not verify_webhook_digest(params):
        logger.warning("ccbill webhook invalid digest request_id=%s", request_id)
        raise AppError(status_code=400, detail="invalid_digest")

    event_type = params.get("eventType", "")
    event_id = params.get("transactionId") or params.get("subscriptionId") or ""
    if not event_type:
        raise AppError(status_code=400, detail="missing_event_type")

    return await _process_ccbill_event_once(
        session,
        request_id=request_id,
        event_id=f"{event_type}:{event_id}",
        event_type=event_type,
        event_payload=params,
    )


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
                ccbill_subscription_id=row.ccbill_subscription_id,
                current_period_end=row.current_period_end,
                cancel_at_period_end=row.cancel_at_period_end,
                cancel_at=row.cancel_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ],
    )


@router.post(
    "/subscriptions/{subscription_id}/cancel",
    response_model=CancelSubscriptionOut,
    status_code=200,
    operation_id="billing_cancel_subscription",
)
async def cancel_subscription_endpoint(
    subscription_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> CancelSubscriptionOut:
    """Cancel a subscription at period end."""
    sub = await cancel_subscription(session, subscription_id, current_user.id)
    return CancelSubscriptionOut(
        subscription_id=sub.id,
        status=sub.status,
        cancel_at_period_end=sub.cancel_at_period_end,
        current_period_end=sub.current_period_end,
    )


@router.get(
    "/health",
    response_model=BillingHealthOut,
    status_code=200,
    operation_id="billing_health",
)
async def billing_health() -> BillingHealthOut:
    settings = get_settings()
    configured = ccbill_configured()
    return BillingHealthOut(
        payment_provider="ccbill",
        configured=configured,
        webhook_configured=bool(settings.ccbill_salt),
        checkout_defaults_configured=bool(
            (settings.checkout_success_url or "").strip()
            and (settings.checkout_cancel_url or "").strip()
        ),
    )


@router.get(
    "/plan",
    response_model=CreatorPlanOut,
    status_code=200,
    operation_id="billing_get_plan",
)
async def get_plan(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator),
) -> CreatorPlanOut:
    plan = await get_or_create_creator_plan(session, current_user.id)
    settings = get_settings()
    return CreatorPlanOut(
        price=plan.price,
        currency=plan.currency,
        active=plan.active,
        platform_fee_percent=settings.platform_fee_percent,
        min_price_cents=settings.min_subscription_price_cents,
        max_price_cents=settings.max_subscription_price_cents,
    )


@router.patch(
    "/plan",
    response_model=CreatorPlanOut,
    status_code=200,
    operation_id="billing_update_plan",
)
async def update_plan(
    payload: CreatorPlanUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator),
) -> CreatorPlanOut:
    plan = await update_creator_plan_price(session, current_user.id, payload.price)
    settings = get_settings()
    return CreatorPlanOut(
        price=plan.price,
        currency=plan.currency,
        active=plan.active,
        platform_fee_percent=settings.platform_fee_percent,
        min_price_cents=settings.min_subscription_price_cents,
        max_price_cents=settings.max_subscription_price_cents,
    )
