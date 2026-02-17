"""Billing service: checkout sessions and Stripe webhook handling."""

from __future__ import annotations

import logging
from typing import Any
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4
from uuid import UUID

import stripe
import sqlalchemy as sa
from sqlalchemy import or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError

logger = logging.getLogger(__name__)
from app.core.settings import get_settings
from app.modules.billing.constants import (
    DEFAULT_PLAN_CURRENCY,
    DEFAULT_PLAN_PRICE,
    PLATFORM_ACCOUNT_ID,
    creator_pending_account_id,
)
from app.modules.billing.models import CreatorPlan, StripeEvent, Subscription
from app.modules.ledger.constants import LEDGER_DIRECTION_CREDIT, LEDGER_DIRECTION_DEBIT
from app.modules.ledger.service import create_ledger_entry, create_ledger_event
from app.modules.audit.service import (
    log_audit_event,
    ACTION_DISPUTE_CLOSED,
    ACTION_DISPUTE_CREATED,
    ACTION_PAYMENT_FAILED,
    ACTION_PAYMENT_SUCCEEDED,
    ACTION_REFUND,
    ACTION_SUBSCRIPTION_CANCELED,
    ACTION_SUBSCRIPTION_CREATED,
)
from app.modules.payments.models import PpvPurchase, Tip

STRIPE_KEY_PLACEHOLDER = "sk_test_placeholder"


def verify_stripe_signature(payload: bytes, signature: str) -> stripe.Event:
    settings = get_settings()
    secrets_to_try = []
    primary_secret = (settings.stripe_webhook_secret or "").strip()
    previous_secret = (settings.stripe_webhook_secret_previous or "").strip()
    if primary_secret:
        secrets_to_try.append(primary_secret)
    if previous_secret and previous_secret != primary_secret:
        secrets_to_try.append(previous_secret)

    if not secrets_to_try:
        raise AppError(status_code=501, detail="Stripe not configured in this environment")

    last_signature_error: Exception | None = None
    try:
        for secret in secrets_to_try:
            try:
                return stripe.Webhook.construct_event(  # type: ignore[no-any-return]
                    payload=payload,
                    sig_header=signature,
                    secret=secret,
                )
            except stripe.error.SignatureVerificationError as exc:
                last_signature_error = exc
        raise AppError(status_code=400, detail="invalid_signature") from last_signature_error
    except ValueError as exc:
        raise AppError(status_code=400, detail="invalid_payload") from exc


async def record_stripe_event(
    session: AsyncSession,
    event_id: str,
    event_type: str,
    payload: dict | None = None,
) -> tuple[bool, str | None]:
    """Store event in current transaction; return (True, id) if new else duplicate."""
    stmt = (
        pg_insert(StripeEvent)
        .values(
            event_id=event_id,
            event_type=event_type,
            payload=payload,
        )
        .on_conflict_do_nothing(index_elements=[StripeEvent.event_id])
        .returning(StripeEvent.event_id)
    )
    result = await session.execute(stmt)
    inserted_id = result.scalar_one_or_none()
    if inserted_id is None:
        return False, None
    return True, inserted_id


async def mark_stripe_event_processed(
    session: AsyncSession, event_id: str
) -> None:
    """Set processed_at for the event in current transaction."""
    now = datetime.now(timezone.utc)
    await session.execute(
        update(StripeEvent).where(StripeEvent.event_id == event_id).values(processed_at=now)
    )


async def get_stripe_event_processed_at(
    session: AsyncSession, event_id: str
) -> datetime | None:
    """Return processed_at timestamp for a Stripe event row."""
    result = await session.execute(
        select(StripeEvent.processed_at).where(StripeEvent.event_id == event_id)
    )
    return result.scalar_one_or_none()


def _get_stripe_key() -> str:
    """Return the configured Stripe secret key or raise."""
    settings = get_settings()
    key = (settings.stripe_secret_key or "").strip()
    if not key or key == STRIPE_KEY_PLACEHOLDER:
        raise AppError(status_code=501, detail="Stripe not configured in this environment")
    return key


def _ensure_stripe_price(plan: CreatorPlan) -> str:
    """Create Stripe Product and Price if plan has no stripe_price_id; return price id."""
    api_key = _get_stripe_key()
    if plan.stripe_price_id:
        return plan.stripe_price_id
    product = stripe.Product.create(
        name="Creator subscription",
        metadata={"creator_user_id": str(plan.creator_user_id)},
        api_key=api_key,
    )
    unit_amount = int(Decimal(plan.price) * 100)
    price = stripe.Price.create(
        product=product.id,
        unit_amount=unit_amount,
        currency=plan.currency.lower(),
        recurring={"interval": "month"},
        metadata={"creator_user_id": str(plan.creator_user_id)},
        api_key=api_key,
    )
    if plan.stripe_product_id != product.id:
        plan.stripe_product_id = product.id
    return price.id


async def get_or_create_creator_plan(
    session: AsyncSession, creator_user_id: UUID
) -> CreatorPlan:
    """Get existing plan or create one with default price; ensure Stripe Price exists."""
    result = await session.execute(
        select(CreatorPlan).where(CreatorPlan.creator_user_id == creator_user_id)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        plan = CreatorPlan(
            creator_user_id=creator_user_id,
            price=Decimal(DEFAULT_PLAN_PRICE),
            currency=DEFAULT_PLAN_CURRENCY,
            active=True,
        )
        session.add(plan)
        await session.flush()
    price_id = _ensure_stripe_price(plan)
    if plan.stripe_price_id != price_id:
        plan.stripe_price_id = price_id
        await session.commit()
        await session.refresh(plan)
    return plan


def _stripe_configured() -> bool:
    settings = get_settings()
    key = (settings.stripe_secret_key or "").strip()
    if not key or key == STRIPE_KEY_PLACEHOLDER:
        return False
    if settings.environment in ("production", "prod") and not key.startswith("sk_live_"):
        return False
    return True


def stripe_mode() -> str:
    """Infer Stripe mode from secret key prefix."""
    settings = get_settings()
    key = (settings.stripe_secret_key or "").strip()
    if key.startswith("sk_live_"):
        return "live"
    if key.startswith("sk_test_"):
        return "test"
    return "unknown"


async def create_checkout_session(
    session: AsyncSession,
    creator_user_id: UUID,
    fan_user_id: UUID,
    *,
    success_url: str | None = None,
    cancel_url: str | None = None,
    creator_handle: str | None = None,
) -> str:
    """Create Stripe Checkout Session for subscription; return checkout URL. Raises 501 if Stripe not configured.
    Session metadata: fan_user_id, creator_user_id (required), creator_handle (optional) for webhook mapping.
    """
    if not _stripe_configured():
        raise AppError(status_code=501, detail="Stripe not configured in this environment")
    plan = await get_or_create_creator_plan(session, creator_user_id)
    if not plan.active or not plan.stripe_price_id:
        raise AppError(status_code=400, detail="creator_plan_inactive")
    settings = get_settings()
    api_key = _get_stripe_key()
    success_url = success_url or settings.checkout_success_url
    cancel_url = cancel_url or settings.checkout_cancel_url
    metadata: dict[str, str] = {
        "fan_user_id": str(fan_user_id),
        "creator_user_id": str(creator_user_id),
        "environment": settings.environment,
        "correlation_id": str(uuid4()),
    }
    if creator_handle:
        metadata["creator_handle"] = creator_handle
    checkout = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": str(plan.stripe_price_id), "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        subscription_data={"metadata": metadata},
        automatic_tax={"enabled": True},
        api_key=api_key,
    )
    logger.info(
        "stripe checkout created fan_user_id=%s creator_user_id=%s correlation_id=%s",
        fan_user_id,
        creator_user_id,
        metadata["correlation_id"],
    )
    return checkout.url or ""


def _period_end_from_stripe(ts: int | None) -> datetime | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


async def _handle_checkout_session_completed(
    session: AsyncSession, event: stripe.Event
) -> None:
    """Create/update subscription from checkout.session.completed. Metadata fan_user_id + creator_user_id is primary."""
    data = event["data"]["object"]
    if data.get("mode") != "subscription":
        return
    sub_id = data.get("subscription")
    metadata = data.get("metadata") or {}
    creator_id_str = metadata.get("creator_user_id")
    fan_id_str = metadata.get("fan_user_id")
    if not creator_id_str or not fan_id_str:
        logger.warning(
            "checkout.session.completed missing metadata fan_user_id/creator_user_id; event_id=%s",
            event.get("id"),
        )
        return
    creator_user_id = UUID(creator_id_str)
    fan_user_id = UUID(fan_id_str)
    stripe_customer_id = data.get("customer")
    status = "active"
    current_period_end = None
    cancel_at_period_end = False
    if sub_id:
        stripe_sub = stripe.Subscription.retrieve(sub_id, api_key=_get_stripe_key())
        status = (stripe_sub.get("status") or "active").lower()
        current_period_end = _period_end_from_stripe(stripe_sub.get("current_period_end"))
        cancel_at_period_end = bool(stripe_sub.get("cancel_at_period_end"))
        if data.get("payment_status") == "unpaid":
            status = "incomplete"
    renew_at = current_period_end
    result = await session.execute(
        select(Subscription).where(
            Subscription.fan_user_id == fan_user_id,
            Subscription.creator_user_id == creator_user_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.stripe_subscription_id = sub_id
        existing.stripe_customer_id = stripe_customer_id
        existing.status = status
        existing.renew_at = renew_at
        existing.current_period_end = current_period_end
        existing.cancel_at_period_end = cancel_at_period_end
        existing.cancel_at = None
    else:
        subscription = Subscription(
            fan_user_id=fan_user_id,
            creator_user_id=creator_user_id,
            status=status,
            renew_at=renew_at,
            current_period_end=current_period_end,
            cancel_at_period_end=cancel_at_period_end,
            stripe_subscription_id=sub_id,
            stripe_customer_id=stripe_customer_id,
        )
        session.add(subscription)
    await session.flush()
    logger.info(
        "stripe subscription upserted fan_user_id=%s creator_user_id=%s status=%s",
        fan_user_id,
        creator_user_id,
        status,
    )


async def _upsert_subscription_from_stripe(
    session: AsyncSession,
    stripe_subscription: stripe.Subscription,
    *,
    fan_user_id: UUID | None = None,
    creator_user_id: UUID | None = None,
) -> None:
    """Create or update subscription from Stripe subscription object. If fan/creator missing and no existing row, log and skip (do not crash)."""
    current_period_end = _period_end_from_stripe(stripe_subscription.get("current_period_end"))
    cancel_at = _period_end_from_stripe(stripe_subscription.get("cancel_at"))
    sub_status = (stripe_subscription.get("status") or "active").lower()
    result = await session.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription.id
        )
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = sub_status
        sub.renew_at = current_period_end
        sub.current_period_end = current_period_end
        sub.cancel_at_period_end = bool(stripe_subscription.get("cancel_at_period_end"))
        sub.cancel_at = cancel_at
        await session.flush()
        return
    if fan_user_id and creator_user_id:
        sub = Subscription(
            fan_user_id=fan_user_id,
            creator_user_id=creator_user_id,
            status=sub_status,
            renew_at=current_period_end,
            current_period_end=current_period_end,
            cancel_at_period_end=bool(stripe_subscription.get("cancel_at_period_end")),
            cancel_at=cancel_at,
            stripe_subscription_id=stripe_subscription.id,
        )
        session.add(sub)
        await session.flush()
        return
    logger.warning(
        "customer.subscription created/updated with no fan/creator mapping; stripe_subscription_id=%s (check metadata or checkout.session.completed)",
        stripe_subscription.id,
    )


async def _handle_subscription_updated(
    session: AsyncSession, stripe_subscription: stripe.Subscription
) -> None:
    await _upsert_subscription_from_stripe(session, stripe_subscription)


async def _handle_subscription_deleted(
    session: AsyncSession, stripe_subscription: stripe.Subscription
) -> None:
    result = await session.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription.id
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return
    sub.status = "canceled"
    await session.flush()


async def _handle_invoice_paid(
    session: AsyncSession, invoice: stripe.Invoice
) -> None:
    """Update subscription to active + current_period_end; optionally create ledger entries (idempotent by reference)."""
    sub_id = invoice.get("subscription")
    if not sub_id:
        return
    result = await session.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return
    period_end_ts = invoice.get("period_end")
    if period_end_ts is not None:
        sub.current_period_end = _period_end_from_stripe(period_end_ts)
    sub.status = "active"
    sub.renew_at = sub.current_period_end
    await session.flush()

    settings = get_settings()
    amount_paid_cents = invoice.get("amount_paid") or 0
    currency = (invoice.get("currency") or "eur").lower()
    amount = Decimal(amount_paid_cents) / 100
    if amount <= 0:
        return
    fee_pct = Decimal(str(settings.platform_fee_percent)) / 100
    platform_amount = (amount * fee_pct).quantize(Decimal("0.01"))
    creator_amount = (amount - platform_amount).quantize(Decimal("0.01"))
    reference = f"stripe_invoice:{invoice.id}"
    if platform_amount > 0:
        await create_ledger_entry(
            session,
            account_id=PLATFORM_ACCOUNT_ID,
            currency=currency,
            amount=platform_amount,
            direction=LEDGER_DIRECTION_CREDIT,
            reference=reference,
            auto_commit=False,
        )
    if creator_amount > 0:
        await create_ledger_entry(
            session,
            account_id=creator_pending_account_id(str(sub.creator_user_id)),
            currency=currency,
            amount=creator_amount,
            direction=LEDGER_DIRECTION_CREDIT,
            reference=reference,
            auto_commit=False,
        )


async def _handle_invoice_payment_failed(
    session: AsyncSession, invoice: stripe.Invoice
) -> None:
    """Set local subscription to past_due on failed invoice payment."""
    sub_id = invoice.get("subscription")
    if not sub_id:
        return
    result = await session.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return
    if sub.status == "canceled":
        return
    sub.status = "past_due"
    await session.flush()


async def _handle_subscription_created(
    session: AsyncSession, event: stripe.Event
) -> None:
    """Handle customer.subscription.created; upsert by stripe_subscription_id, metadata if needed."""
    stripe_sub = event["data"]["object"]
    metadata = stripe_sub.get("metadata") or {}
    fan_id_str = metadata.get("fan_user_id")
    creator_id_str = metadata.get("creator_user_id")
    fan_user_id = UUID(fan_id_str) if fan_id_str else None
    creator_user_id = UUID(creator_id_str) if creator_id_str else None
    await _upsert_subscription_from_stripe(
        session, stripe_sub,
        fan_user_id=fan_user_id,
        creator_user_id=creator_user_id,
    )


def _is_handled_event_type(typ: str) -> bool:
    """Event types we process; others are ignored with 200."""
    return typ in (
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.paid",
        "invoice.payment_succeeded",
        "invoice.payment_failed",
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "payment_intent.canceled",
        "charge.refunded",
        "charge.dispute.created",
        "charge.dispute.closed",
    )


async def _handle_payment_intent_succeeded(
    session: AsyncSession, pi: dict
) -> None:
    """Handle payment_intent.succeeded for tips and PPV. Idempotent by PI id."""
    metadata = pi.get("metadata") or {}
    pi_type = metadata.get("type")
    amount = pi.get("amount") or 0
    currency = (pi.get("currency") or "eur").lower()
    settings = get_settings()
    fee_pct = Decimal(str(settings.platform_fee_percent)) / 100
    amount_dec = Decimal(amount) / 100
    fee_cents = int((amount_dec * fee_pct * 100).quantize(Decimal("1")))
    gross_cents = amount
    net_cents = gross_cents - fee_cents

    if pi_type == "TIP":
        tip_id = metadata.get("tip_id")
        creator_id_str = metadata.get("creator_id")
        if not tip_id or not creator_id_str:
            logger.warning("payment_intent.succeeded TIP missing metadata tip_id=%s creator_id=%s", tip_id, creator_id_str)
            return
        result = await session.execute(
            select(Tip).where(Tip.id == UUID(tip_id), Tip.stripe_payment_intent_id == pi.get("id"))
        )
        tip = result.scalar_one_or_none()
        if not tip:
            logger.warning("tip not found or already processed tip_id=%s", tip_id)
            return
        if tip.status == "SUCCEEDED":
            return  # idempotent
        tip.status = "SUCCEEDED"
        await create_ledger_event(
            session,
            creator_id=UUID(creator_id_str),
            type="TIP",
            gross_cents=gross_cents,
            fee_cents=fee_cents,
            net_cents=net_cents,
            currency=currency,
            reference_type="tip",
            reference_id=tip_id,
        )
        ref = f"stripe_pi:{pi.get('id')}"
        if net_cents > 0:
            await create_ledger_entry(
                session,
                account_id=creator_pending_account_id(creator_id_str),
                currency=currency,
                amount=Decimal(net_cents) / 100,
                direction=LEDGER_DIRECTION_CREDIT,
                reference=ref,
                auto_commit=False,
            )
        if fee_cents > 0:
            await create_ledger_entry(
                session,
                account_id=PLATFORM_ACCOUNT_ID,
                currency=currency,
                amount=Decimal(fee_cents) / 100,
                direction=LEDGER_DIRECTION_CREDIT,
                reference=ref,
                auto_commit=False,
            )
    elif pi_type in ("PPV_UNLOCK", "PPV_MESSAGE_UNLOCK"):
        purchase_id = metadata.get("purchase_id")
        result = None
        if purchase_id:
            result = await session.execute(
                select(PpvPurchase).where(
                    PpvPurchase.id == UUID(purchase_id),
                    PpvPurchase.stripe_payment_intent_id == pi.get("id"),
                )
            )
        else:
            result = await session.execute(
                select(PpvPurchase).where(
                    PpvPurchase.stripe_payment_intent_id == pi.get("id"),
                )
            )
        purchase = result.scalar_one_or_none() if result is not None else None
        if not purchase:
            logger.warning("ppv_purchase not found or already processed purchase_id=%s", purchase_id)
            return
        if purchase.status == "SUCCEEDED":
            return
        purchase.status = "SUCCEEDED"
        latest_charge = pi.get("latest_charge")
        if latest_charge:
            purchase.stripe_charge_id = str(latest_charge)
        creator_id_str = metadata.get("creator_id") or str(purchase.creator_id)
        await create_ledger_event(
            session,
            creator_id=UUID(creator_id_str),
            type="PPV_UNLOCK",
            gross_cents=gross_cents,
            fee_cents=fee_cents,
            net_cents=net_cents,
            currency=currency,
            reference_type="ppv_purchase",
            reference_id=purchase_id,
        )
        ref = f"stripe_pi:{pi.get('id')}"
        if net_cents > 0:
            await create_ledger_entry(
                session,
                account_id=creator_pending_account_id(creator_id_str),
                currency=currency,
                amount=Decimal(net_cents) / 100,
                direction=LEDGER_DIRECTION_CREDIT,
                reference=ref,
                auto_commit=False,
            )
        if fee_cents > 0:
            await create_ledger_entry(
                session,
                account_id=PLATFORM_ACCOUNT_ID,
                currency=currency,
                amount=Decimal(fee_cents) / 100,
                direction=LEDGER_DIRECTION_CREDIT,
                reference=ref,
                auto_commit=False,
            )
    await session.flush()


async def _handle_payment_intent_failed_or_canceled(
    session: AsyncSession, pi: dict
) -> None:
    """Mark tip or ppv as CANCELED."""
    metadata = pi.get("metadata") or {}
    pi_type = metadata.get("type")
    if pi_type == "TIP":
        tip_id = metadata.get("tip_id")
        if tip_id:
            result = await session.execute(select(Tip).where(Tip.id == UUID(tip_id)))
            tip = result.scalar_one_or_none()
            if tip and tip.status == "REQUIRES_PAYMENT":
                tip.status = "CANCELED"
    elif pi_type in ("PPV_UNLOCK", "PPV_MESSAGE_UNLOCK"):
        purchase_id = metadata.get("purchase_id")
        if purchase_id:
            result = await session.execute(select(PpvPurchase).where(PpvPurchase.id == UUID(purchase_id)))
            purchase = result.scalar_one_or_none()
            if purchase and purchase.status == "REQUIRES_PAYMENT":
                purchase.status = "CANCELED"
    await session.flush()


async def _handle_charge_refunded(session: AsyncSession, charge: dict) -> None:
    """Handle charge.refunded for PPV purchases and tips. Creates debit ledger entries to reverse earnings."""
    charge_id = charge.get("id")
    payment_intent_id = charge.get("payment_intent")
    if not charge_id:
        return

    refund_amount_cents = charge.get("amount_refunded") or 0
    currency = (charge.get("currency") or "eur").lower()
    settings = get_settings()
    fee_pct = Decimal(str(settings.platform_fee_percent)) / 100

    # Check PPV purchases
    result = await session.execute(
        select(PpvPurchase).where(PpvPurchase.stripe_charge_id == str(charge_id))
    )
    purchase = result.scalar_one_or_none()
    if purchase and purchase.status != "REFUNDED":
        purchase.status = "REFUNDED"
        ref = f"refund:{charge_id}"
        amount_dec = Decimal(refund_amount_cents) / 100
        creator_debit = (amount_dec * (1 - fee_pct)).quantize(Decimal("0.01"))
        platform_debit = (amount_dec * fee_pct).quantize(Decimal("0.01"))
        if creator_debit > 0:
            await create_ledger_entry(
                session,
                account_id=creator_pending_account_id(str(purchase.creator_id)),
                currency=currency,
                amount=creator_debit,
                direction=LEDGER_DIRECTION_DEBIT,
                reference=ref,
                auto_commit=False,
            )
        if platform_debit > 0:
            await create_ledger_entry(
                session,
                account_id=PLATFORM_ACCOUNT_ID,
                currency=currency,
                amount=platform_debit,
                direction=LEDGER_DIRECTION_DEBIT,
                reference=ref,
                auto_commit=False,
            )
        await session.flush()
        return

    # Check tips (matched by stripe_payment_intent_id)
    if payment_intent_id:
        tip_result = await session.execute(
            select(Tip).where(Tip.stripe_payment_intent_id == str(payment_intent_id))
        )
        tip = tip_result.scalar_one_or_none()
        if tip and tip.status != "REFUNDED":
            tip.status = "REFUNDED"
            ref = f"refund:{charge_id}"
            amount_dec = Decimal(refund_amount_cents) / 100
            creator_debit = (amount_dec * (1 - fee_pct)).quantize(Decimal("0.01"))
            platform_debit = (amount_dec * fee_pct).quantize(Decimal("0.01"))
            if creator_debit > 0:
                await create_ledger_entry(
                    session,
                    account_id=creator_pending_account_id(str(tip.creator_id)),
                    currency=currency,
                    amount=creator_debit,
                    direction=LEDGER_DIRECTION_DEBIT,
                    reference=ref,
                    auto_commit=False,
                )
            if platform_debit > 0:
                await create_ledger_entry(
                    session,
                    account_id=PLATFORM_ACCOUNT_ID,
                    currency=currency,
                    amount=platform_debit,
                    direction=LEDGER_DIRECTION_DEBIT,
                    reference=ref,
                    auto_commit=False,
                )
            await session.flush()
            return

    await session.flush()


async def _handle_charge_dispute_created(session: AsyncSession, dispute: dict) -> None:
    """
    Handle charge.dispute.created: freeze access for the disputed charge.
    Covers PPV purchases, tips, and subscriptions.
    """
    charge_id = dispute.get("charge")
    payment_intent_id = dispute.get("payment_intent")
    reason = dispute.get("reason", "unknown")
    amount = dispute.get("amount", 0)
    logger.warning(
        "stripe_dispute_created charge_id=%s reason=%s amount=%s",
        charge_id,
        reason,
        amount,
    )
    if not charge_id:
        return

    # Check PPV purchases
    result = await session.execute(
        select(PpvPurchase).where(PpvPurchase.stripe_charge_id == str(charge_id))
    )
    purchase = result.scalar_one_or_none()
    if purchase:
        purchase.status = "DISPUTED"
        logger.warning("ppv_purchase_disputed purchase_id=%s charge_id=%s", purchase.id, charge_id)
        await session.flush()
        return

    # Check tips (via payment_intent)
    if payment_intent_id:
        tip_result = await session.execute(
            select(Tip).where(Tip.stripe_payment_intent_id == str(payment_intent_id))
        )
        tip = tip_result.scalar_one_or_none()
        if tip:
            tip.status = "DISPUTED"
            logger.warning("tip_disputed tip_id=%s charge_id=%s", tip.id, charge_id)
            await session.flush()
            return

    # Check subscriptions (charge may come from a subscription invoice)
    # Try to find the subscription via Stripe API if payment_intent is available
    if payment_intent_id:
        try:
            api_key = _get_stripe_key()
            pi = stripe.PaymentIntent.retrieve(payment_intent_id, api_key=api_key)
            invoice_id = pi.get("invoice")
            if invoice_id:
                inv = stripe.Invoice.retrieve(invoice_id, api_key=api_key)
                stripe_sub_id = inv.get("subscription")
                if stripe_sub_id:
                    sub_result = await session.execute(
                        select(Subscription).where(
                            Subscription.stripe_subscription_id == str(stripe_sub_id)
                        )
                    )
                    sub = sub_result.scalar_one_or_none()
                    if sub:
                        sub.status = "disputed"
                        logger.warning(
                            "subscription_disputed subscription_id=%s charge_id=%s",
                            sub.id, charge_id,
                        )
        except Exception:
            logger.exception("failed to resolve subscription for dispute charge_id=%s", charge_id)

    await session.flush()


async def _handle_charge_dispute_closed(session: AsyncSession, dispute: dict) -> None:
    """Handle charge.dispute.closed: update status based on dispute outcome."""
    charge_id = dispute.get("charge")
    payment_intent_id = dispute.get("payment_intent")
    status = dispute.get("status", "")  # won, lost, needs_response, etc.
    logger.info("stripe_dispute_closed charge_id=%s status=%s", charge_id, status)
    if not charge_id:
        return

    if status == "won":
        # Dispute won: restore original status
        result = await session.execute(
            select(PpvPurchase).where(
                PpvPurchase.stripe_charge_id == str(charge_id),
                PpvPurchase.status == "DISPUTED",
            )
        )
        purchase = result.scalar_one_or_none()
        if purchase:
            purchase.status = "SUCCEEDED"

        if payment_intent_id:
            tip_result = await session.execute(
                select(Tip).where(
                    Tip.stripe_payment_intent_id == str(payment_intent_id),
                    Tip.status == "DISPUTED",
                )
            )
            tip = tip_result.scalar_one_or_none()
            if tip:
                tip.status = "SUCCEEDED"

            # Restore disputed subscription linked to this payment_intent
            try:
                api_key = _get_stripe_key()
                pi = stripe.PaymentIntent.retrieve(payment_intent_id, api_key=api_key)
                invoice_id = pi.get("invoice")
                if invoice_id:
                    inv = stripe.Invoice.retrieve(invoice_id, api_key=api_key)
                    stripe_sub_id = inv.get("subscription")
                    if stripe_sub_id:
                        sub_result = await session.execute(
                            select(Subscription).where(
                                Subscription.stripe_subscription_id == str(stripe_sub_id),
                                Subscription.status == "disputed",
                            )
                        )
                        sub = sub_result.scalar_one_or_none()
                        if sub:
                            sub.status = "active"
            except Exception:
                logger.exception("failed to restore subscription after dispute won charge_id=%s", charge_id)

    elif status == "lost":
        # Dispute lost: create debit ledger entries to reverse earnings
        currency = (dispute.get("currency") or "eur").lower()
        amount_cents = dispute.get("amount") or 0
        settings = get_settings()
        fee_pct = Decimal(str(settings.platform_fee_percent)) / 100
        amount_dec = Decimal(amount_cents) / 100
        ref = f"dispute_lost:{charge_id}"

        # Find the creator to debit
        creator_id_str = None
        result = await session.execute(
            select(PpvPurchase).where(PpvPurchase.stripe_charge_id == str(charge_id))
        )
        purchase = result.scalar_one_or_none()
        if purchase:
            creator_id_str = str(purchase.creator_id)
        elif payment_intent_id:
            tip_result = await session.execute(
                select(Tip).where(Tip.stripe_payment_intent_id == str(payment_intent_id))
            )
            tip = tip_result.scalar_one_or_none()
            if tip:
                creator_id_str = str(tip.creator_id)

        if creator_id_str and amount_dec > 0:
            creator_debit = (amount_dec * (1 - fee_pct)).quantize(Decimal("0.01"))
            platform_debit = (amount_dec * fee_pct).quantize(Decimal("0.01"))
            if creator_debit > 0:
                await create_ledger_entry(
                    session,
                    account_id=creator_pending_account_id(creator_id_str),
                    currency=currency,
                    amount=creator_debit,
                    direction=LEDGER_DIRECTION_DEBIT,
                    reference=ref,
                    auto_commit=False,
                )
            if platform_debit > 0:
                await create_ledger_entry(
                    session,
                    account_id=PLATFORM_ACCOUNT_ID,
                    currency=currency,
                    amount=platform_debit,
                    direction=LEDGER_DIRECTION_DEBIT,
                    reference=ref,
                    auto_commit=False,
                )

    await session.flush()


async def handle_stripe_event(
    session: AsyncSession,
    event: stripe.Event,
) -> str:
    """Dispatch webhook event handlers and return outcome: processed|ignored|error."""
    typ = event.get("type") or ""
    event_id = event.get("id") or ""
    if _is_handled_event_type(typ):
        try:
            audit_action: str | None = None
            audit_metadata: dict[str, Any] = {"stripe_event_id": event_id, "event_type": typ}
            if typ == "checkout.session.completed":
                await _handle_checkout_session_completed(session, event)
                audit_action = ACTION_SUBSCRIPTION_CREATED
                meta = (event.get("data", {}).get("object", {}).get("metadata") or {})
                audit_metadata["fan_user_id"] = meta.get("fan_user_id")
                audit_metadata["creator_user_id"] = meta.get("creator_user_id")
            elif typ == "customer.subscription.created":
                await _handle_subscription_created(session, event)
            elif typ == "customer.subscription.updated":
                await _handle_subscription_updated(session, event["data"]["object"])
            elif typ == "customer.subscription.deleted":
                await _handle_subscription_deleted(session, event["data"]["object"])
                audit_action = ACTION_SUBSCRIPTION_CANCELED
            elif typ in ("invoice.paid", "invoice.payment_succeeded"):
                await _handle_invoice_paid(session, event["data"]["object"])
                audit_action = ACTION_PAYMENT_SUCCEEDED
            elif typ == "invoice.payment_failed":
                await _handle_invoice_payment_failed(session, event["data"]["object"])
                audit_action = ACTION_PAYMENT_FAILED
            elif typ == "payment_intent.succeeded":
                await _handle_payment_intent_succeeded(session, event["data"]["object"])
                audit_action = ACTION_PAYMENT_SUCCEEDED
            elif typ in ("payment_intent.payment_failed", "payment_intent.canceled"):
                await _handle_payment_intent_failed_or_canceled(session, event["data"]["object"])
                audit_action = ACTION_PAYMENT_FAILED
            elif typ == "charge.refunded":
                await _handle_charge_refunded(session, event["data"]["object"])
                audit_action = ACTION_REFUND
            elif typ == "charge.dispute.created":
                await _handle_charge_dispute_created(session, event["data"]["object"])
                audit_action = ACTION_DISPUTE_CREATED
            elif typ == "charge.dispute.closed":
                await _handle_charge_dispute_closed(session, event["data"]["object"])
                audit_action = ACTION_DISPUTE_CLOSED
            if audit_action:
                await log_audit_event(
                    session,
                    action=audit_action,
                    resource_type="stripe_event",
                    resource_id=event_id,
                    metadata=audit_metadata,
                    auto_commit=False,
                )
            logger.info("stripe webhook handled event_id=%s event_type=%s", event_id, typ)
            return "processed"
        except Exception:
            # Dead-letter logging: log the failure for investigation
            logger.exception(
                "stripe webhook handler failed event_id=%s event_type=%s",
                event_id,
                typ,
            )
            raise
    else:
        logger.info("stripe webhook ignored event type event_id=%s event_type=%s", event_id, typ)
        return "ignored"


def _subscription_active_filter() -> Any:
    """Condition: (status active OR past_due within grace period) and period not ended."""
    now = datetime.now(timezone.utc)
    settings = get_settings()
    grace_cutoff = now - timedelta(hours=settings.subscription_grace_period_hours)
    period_valid = or_(
        Subscription.current_period_end.is_(None),
        Subscription.current_period_end > now,
    )
    status_valid = or_(
        Subscription.status == "active",
        # past_due within grace period: allow access if updated_at is recent
        sa.and_(
            Subscription.status == "past_due",
            Subscription.updated_at >= grace_cutoff,
        ),
    )
    return sa.and_(period_valid, status_valid)


async def is_active_subscriber(
    session: AsyncSession, fan_user_id: UUID, creator_user_id: UUID
) -> bool:
    """True if fan has an active (or past_due within grace period) subscription to creator."""
    result = await session.execute(
        select(Subscription).where(
            Subscription.fan_user_id == fan_user_id,
            Subscription.creator_user_id == creator_user_id,
            _subscription_active_filter(),
        )
    )
    return result.scalar_one_or_none() is not None


async def get_subscribed_creator_ids(
    session: AsyncSession, fan_user_id: UUID
) -> set[UUID]:
    """Set of creator_user_ids the fan has an active subscription to."""
    result = await session.execute(
        select(Subscription.creator_user_id).where(
            Subscription.fan_user_id == fan_user_id,
            _subscription_active_filter(),
        )
    )
    return {row[0] for row in result.all()}


async def cancel_subscription(
    session: AsyncSession,
    subscription_id: UUID,
    fan_user_id: UUID,
) -> Subscription:
    """Cancel a subscription at period end. Fan retains access until current_period_end."""
    result = await session.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.fan_user_id == fan_user_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise AppError(status_code=404, detail="subscription_not_found")
    if sub.status in ("canceled", "disputed"):
        raise AppError(status_code=400, detail="subscription_not_cancelable")
    if not sub.stripe_subscription_id:
        raise AppError(status_code=400, detail="subscription_not_cancelable")

    api_key = _get_stripe_key()
    stripe.Subscription.modify(
        sub.stripe_subscription_id,
        cancel_at_period_end=True,
        api_key=api_key,
    )
    sub.cancel_at_period_end = True
    await log_audit_event(
        session,
        action=ACTION_SUBSCRIPTION_CANCELED,
        actor_id=fan_user_id,
        resource_type="subscription",
        resource_id=str(subscription_id),
        metadata={"stripe_subscription_id": sub.stripe_subscription_id},
        auto_commit=False,
    )
    await session.commit()
    await session.refresh(sub)
    return sub
