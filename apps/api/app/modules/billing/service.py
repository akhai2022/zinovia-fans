"""Billing service: checkout and webhook handling for CCBill and Worldline."""

from __future__ import annotations

import logging
from typing import Any
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4, UUID

import sqlalchemy as sa
from sqlalchemy import or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError

logger = logging.getLogger(__name__)
from app.core.settings import get_settings
from app.modules.billing.ccbill_client import (
    build_flexform_url,
    cancel_ccbill_subscription,
    ccbill_configured,
    verify_webhook_digest,
)
from app.modules.billing.constants import (
    DEFAULT_PLAN_CURRENCY,
    DEFAULT_PLAN_PRICE,
    PLATFORM_ACCOUNT_ID,
    creator_pending_account_id,
)
from app.modules.billing.models import CreatorPlan, PaymentEvent, Subscription
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
from app.modules.payments.models import PostPurchase, PpvPurchase, Tip


# ---------------------------------------------------------------------------
# Event recording (idempotent by event_id)
# ---------------------------------------------------------------------------

async def record_payment_event(
    session: AsyncSession,
    event_id: str,
    event_type: str,
    payload: dict | None = None,
) -> tuple[bool, str | None]:
    """Store event; return (True, id) if new, (False, None) if duplicate."""
    stmt = (
        pg_insert(PaymentEvent)
        .values(event_id=event_id, event_type=event_type, payload=payload)
        .on_conflict_do_nothing(index_elements=[PaymentEvent.event_id])
        .returning(PaymentEvent.event_id)
    )
    result = await session.execute(stmt)
    inserted_id = result.scalar_one_or_none()
    if inserted_id is None:
        return False, None
    return True, inserted_id


async def mark_event_processed(session: AsyncSession, event_id: str) -> None:
    now = datetime.now(timezone.utc)
    await session.execute(
        update(PaymentEvent).where(PaymentEvent.event_id == event_id).values(processed_at=now)
    )


# ---------------------------------------------------------------------------
# Creator plan management (no external API calls needed for CCBill)
# ---------------------------------------------------------------------------

async def get_or_create_creator_plan(
    session: AsyncSession, creator_user_id: UUID
) -> CreatorPlan:
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
    return plan


async def update_creator_plan_price(
    session: AsyncSession, creator_user_id: UUID, new_price: Decimal
) -> CreatorPlan:
    """Update a creator's subscription price. New subscribers get the new price."""
    settings = get_settings()
    price_cents = int(new_price * 100)
    if price_cents < settings.min_subscription_price_cents:
        raise AppError(status_code=400, detail=f"price_below_minimum:{settings.min_subscription_price_cents}")
    if price_cents > settings.max_subscription_price_cents:
        raise AppError(status_code=400, detail=f"price_above_maximum:{settings.max_subscription_price_cents}")

    plan = await get_or_create_creator_plan(session, creator_user_id)
    if plan.price == new_price:
        return plan

    plan.price = new_price
    await session.commit()
    await session.refresh(plan)
    logger.info("creator plan price updated creator_user_id=%s price=%s", creator_user_id, new_price)
    return plan


# ---------------------------------------------------------------------------
# Checkout session (CCBill FlexForms URL)
# ---------------------------------------------------------------------------

async def create_checkout_session(
    session: AsyncSession,
    creator_user_id: UUID,
    fan_user_id: UUID,
    *,
    success_url: str | None = None,
    cancel_url: str | None = None,
    creator_handle: str | None = None,
) -> str:
    """Build checkout URL for subscription. Supports CCBill and Worldline."""
    settings = get_settings()
    plan = await get_or_create_creator_plan(session, creator_user_id)
    if not plan.active:
        raise AppError(status_code=400, detail="creator_plan_inactive")

    final_success_url = success_url or settings.checkout_success_url
    final_cancel_url = cancel_url or settings.checkout_cancel_url

    custom_fields = {
        "zv_fan_user_id": str(fan_user_id),
        "zv_creator_user_id": str(creator_user_id),
        "zv_correlation_id": str(uuid4()),
        "zv_payment_type": "SUBSCRIPTION",
    }
    if creator_handle:
        custom_fields["zv_creator_handle"] = creator_handle

    if settings.payment_provider == "worldline":
        from app.modules.billing.worldline_client import create_hosted_checkout, worldline_configured
        if not worldline_configured():
            raise AppError(status_code=501, detail="Payment processor not configured in this environment")

        amount_cents = int(plan.price * 100)
        result = await create_hosted_checkout(
            amount_cents=amount_cents,
            currency=plan.currency.upper(),
            description=f"Zinovia Fans - Subscribe to {creator_handle or str(creator_user_id)[:8]}",
            return_url=final_success_url,
            custom_fields=custom_fields,
            recurring=True,
            tokens_requested=True,
        )
        url = result["checkout_url"]
        logger.info(
            "worldline checkout created fan_user_id=%s creator_user_id=%s hosted_checkout_id=%s",
            fan_user_id, creator_user_id, result.get("hosted_checkout_id"),
        )
    else:
        if not ccbill_configured():
            raise AppError(status_code=501, detail="Payment processor not configured in this environment")

        url = build_flexform_url(
            price=plan.price,
            currency=plan.currency,
            initial_period_days=30,
            recurring=True,
            recurring_period_days=30,
            num_rebills=99,
            success_url=final_success_url,
            failure_url=final_cancel_url,
            custom_fields=custom_fields,
        )
        logger.info(
            "ccbill checkout created fan_user_id=%s creator_user_id=%s",
            fan_user_id, creator_user_id,
        )

    return url


# ---------------------------------------------------------------------------
# CCBill webhook handlers
# ---------------------------------------------------------------------------

def _is_handled_event_type(typ: str) -> bool:
    return typ in (
        "NewSaleSuccess",
        "NewSaleFailure",
        "RenewalSuccess",
        "RenewalFailure",
        "Cancellation",
        "Chargeback",
        "Refund",
        "Expiration",
        "Return",
        "Void",
    )


def _period_end_from_days(days: int = 30) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


async def _handle_new_sale_success(session: AsyncSession, params: dict) -> None:
    """Handle NewSaleSuccess: create/update subscription or record one-time payment."""
    subscription_id = params.get("subscriptionId", "")
    transaction_id = params.get("transactionId", "")
    fan_user_id_str = params.get("zv_fan_user_id")
    creator_user_id_str = params.get("zv_creator_user_id")

    if not fan_user_id_str or not creator_user_id_str:
        logger.warning("NewSaleSuccess missing zv_fan_user_id/zv_creator_user_id")
        return

    fan_user_id = UUID(fan_user_id_str)
    creator_user_id = UUID(creator_user_id_str)

    # Check if this is a PPV/tip payment (identified by zv_payment_type)
    payment_type = params.get("zv_payment_type", "SUBSCRIPTION")

    if payment_type == "TIP":
        await _handle_tip_success(session, params, fan_user_id, creator_user_id, transaction_id)
        return
    elif payment_type in ("PPV_MESSAGE_UNLOCK", "PPV_POST_UNLOCK"):
        await _handle_ppv_success(session, params, payment_type, transaction_id)
        return

    # Subscription payment
    period_end = _period_end_from_days(30)
    result = await session.execute(
        select(Subscription).where(
            Subscription.fan_user_id == fan_user_id,
            Subscription.creator_user_id == creator_user_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.ccbill_subscription_id = subscription_id
        existing.status = "active"
        existing.renew_at = period_end
        existing.current_period_end = period_end
        existing.cancel_at_period_end = False
        existing.cancel_at = None
    else:
        sub = Subscription(
            fan_user_id=fan_user_id,
            creator_user_id=creator_user_id,
            status="active",
            renew_at=period_end,
            current_period_end=period_end,
            cancel_at_period_end=False,
            ccbill_subscription_id=subscription_id,
        )
        session.add(sub)
    await session.flush()

    # Ledger entries for subscription payment
    amount_str = params.get("billedInitialPrice") or params.get("accountingInitialPrice") or "0"
    currency = params.get("billedCurrencyCode", "978")
    currency_str = _currency_code_to_str(currency)
    await _create_payment_ledger_entries(
        session, amount_str, currency_str, str(creator_user_id), f"ccbill_sub:{transaction_id}"
    )

    logger.info(
        "ccbill subscription created fan_user_id=%s creator_user_id=%s sub_id=%s",
        fan_user_id, creator_user_id, subscription_id,
    )


async def _handle_tip_success(
    session: AsyncSession, params: dict, tipper_id: UUID, creator_id: UUID, transaction_id: str
) -> None:
    tip_id_str = params.get("zv_tip_id")
    if not tip_id_str:
        logger.warning("NewSaleSuccess TIP missing zv_tip_id")
        return
    result = await session.execute(select(Tip).where(Tip.id == UUID(tip_id_str)))
    tip = result.scalar_one_or_none()
    if not tip:
        logger.warning("tip not found tip_id=%s", tip_id_str)
        return
    if tip.status == "SUCCEEDED":
        return
    tip.status = "SUCCEEDED"
    tip.ccbill_transaction_id = transaction_id

    amount_str = params.get("billedInitialPrice") or str(Decimal(tip.amount_cents) / 100)
    currency_str = tip.currency
    await _create_payment_ledger_entries(
        session, amount_str, currency_str, str(creator_id), f"ccbill_tip:{transaction_id}"
    )
    await create_ledger_event(
        session,
        creator_id=creator_id,
        type="TIP",
        gross_cents=tip.amount_cents,
        fee_cents=_fee_cents(tip.amount_cents),
        net_cents=tip.amount_cents - _fee_cents(tip.amount_cents),
        currency=currency_str,
        reference_type="tip",
        reference_id=tip_id_str,
    )
    await session.flush()


async def _handle_ppv_success(
    session: AsyncSession, params: dict, payment_type: str, transaction_id: str
) -> None:
    purchase_id_str = params.get("zv_purchase_id")
    if not purchase_id_str:
        logger.warning("NewSaleSuccess PPV missing zv_purchase_id")
        return

    if payment_type == "PPV_MESSAGE_UNLOCK":
        result = await session.execute(select(PpvPurchase).where(PpvPurchase.id == UUID(purchase_id_str)))
        purchase = result.scalar_one_or_none()
    else:
        result = await session.execute(select(PostPurchase).where(PostPurchase.id == UUID(purchase_id_str)))
        purchase = result.scalar_one_or_none()

    if not purchase:
        logger.warning("ppv purchase not found purchase_id=%s", purchase_id_str)
        return
    if purchase.status == "SUCCEEDED":
        return

    purchase.status = "SUCCEEDED"
    purchase.ccbill_transaction_id = transaction_id
    creator_id_str = str(purchase.creator_id)

    amount_str = params.get("billedInitialPrice") or str(Decimal(purchase.amount_cents) / 100)
    await _create_payment_ledger_entries(
        session, amount_str, purchase.currency, creator_id_str, f"ccbill_ppv:{transaction_id}"
    )
    ledger_type = "PPV_UNLOCK" if payment_type == "PPV_MESSAGE_UNLOCK" else "PPV_POST_UNLOCK"
    await create_ledger_event(
        session,
        creator_id=UUID(creator_id_str),
        type=ledger_type,
        gross_cents=purchase.amount_cents,
        fee_cents=_fee_cents(purchase.amount_cents),
        net_cents=purchase.amount_cents - _fee_cents(purchase.amount_cents),
        currency=purchase.currency,
        reference_type="ppv_purchase" if payment_type == "PPV_MESSAGE_UNLOCK" else "post_purchase",
        reference_id=purchase_id_str,
    )
    await session.flush()


async def _handle_renewal_success(session: AsyncSession, params: dict) -> None:
    subscription_id = params.get("subscriptionId", "")
    if not subscription_id:
        return
    result = await session.execute(
        select(Subscription).where(Subscription.ccbill_subscription_id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        logger.warning("renewal for unknown subscription subscription_id=%s", subscription_id)
        return

    period_end = _period_end_from_days(30)
    sub.status = "active"
    sub.renew_at = period_end
    sub.current_period_end = period_end
    await session.flush()

    amount_str = params.get("billedRecurringPrice") or params.get("accountingRecurringPrice") or "0"
    currency = params.get("billedCurrencyCode", "978")
    currency_str = _currency_code_to_str(currency)
    await _create_payment_ledger_entries(
        session, amount_str, currency_str, str(sub.creator_user_id), f"ccbill_renew:{params.get('transactionId', '')}"
    )

    logger.info("ccbill renewal processed subscription_id=%s", subscription_id)


async def _handle_cancellation(session: AsyncSession, params: dict) -> None:
    subscription_id = params.get("subscriptionId", "")
    if not subscription_id:
        return
    result = await session.execute(
        select(Subscription).where(Subscription.ccbill_subscription_id == subscription_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return
    sub.status = "canceled"
    sub.cancel_at_period_end = True
    await session.flush()
    logger.info("ccbill subscription canceled subscription_id=%s", subscription_id)


async def _handle_refund(session: AsyncSession, params: dict) -> None:
    """Handle Refund: reverse ledger entries."""
    transaction_id = params.get("transactionId", "")
    if not transaction_id:
        return

    settings = get_settings()
    fee_pct = Decimal(str(settings.platform_fee_percent)) / 100
    amount_str = params.get("amount") or "0"
    amount = Decimal(amount_str)
    currency = _currency_code_to_str(params.get("billedCurrencyCode", "978"))
    ref = f"refund:{transaction_id}"

    # Try PPV purchase
    result = await session.execute(
        select(PpvPurchase).where(PpvPurchase.ccbill_transaction_id == transaction_id)
    )
    purchase = result.scalar_one_or_none()
    if purchase and purchase.status != "REFUNDED":
        purchase.status = "REFUNDED"
        creator_debit = (amount * (1 - fee_pct)).quantize(Decimal("0.01"))
        platform_debit = (amount * fee_pct).quantize(Decimal("0.01"))
        if creator_debit > 0:
            await create_ledger_entry(session, account_id=creator_pending_account_id(str(purchase.creator_id)), currency=currency, amount=creator_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        if platform_debit > 0:
            await create_ledger_entry(session, account_id=PLATFORM_ACCOUNT_ID, currency=currency, amount=platform_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        await session.flush()
        return

    # Try post purchase
    result = await session.execute(
        select(PostPurchase).where(PostPurchase.ccbill_transaction_id == transaction_id)
    )
    post_purchase = result.scalar_one_or_none()
    if post_purchase and post_purchase.status != "REFUNDED":
        post_purchase.status = "REFUNDED"
        creator_debit = (amount * (1 - fee_pct)).quantize(Decimal("0.01"))
        platform_debit = (amount * fee_pct).quantize(Decimal("0.01"))
        if creator_debit > 0:
            await create_ledger_entry(session, account_id=creator_pending_account_id(str(post_purchase.creator_id)), currency=currency, amount=creator_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        if platform_debit > 0:
            await create_ledger_entry(session, account_id=PLATFORM_ACCOUNT_ID, currency=currency, amount=platform_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        await session.flush()
        return

    # Try tip
    result = await session.execute(
        select(Tip).where(Tip.ccbill_transaction_id == transaction_id)
    )
    tip = result.scalar_one_or_none()
    if tip and tip.status != "REFUNDED":
        tip.status = "REFUNDED"
        creator_debit = (amount * (1 - fee_pct)).quantize(Decimal("0.01"))
        platform_debit = (amount * fee_pct).quantize(Decimal("0.01"))
        if creator_debit > 0:
            await create_ledger_entry(session, account_id=creator_pending_account_id(str(tip.creator_id)), currency=currency, amount=creator_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        if platform_debit > 0:
            await create_ledger_entry(session, account_id=PLATFORM_ACCOUNT_ID, currency=currency, amount=platform_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        await session.flush()

    logger.info("ccbill refund processed transaction_id=%s", transaction_id)


async def _handle_chargeback(session: AsyncSession, params: dict) -> None:
    """Handle Chargeback: mark as disputed."""
    subscription_id = params.get("subscriptionId", "")
    transaction_id = params.get("transactionId", "")

    # Check PPV purchases
    if transaction_id:
        result = await session.execute(
            select(PpvPurchase).where(PpvPurchase.ccbill_transaction_id == transaction_id)
        )
        purchase = result.scalar_one_or_none()
        if purchase:
            purchase.status = "DISPUTED"
            await session.flush()
            return

        result = await session.execute(
            select(PostPurchase).where(PostPurchase.ccbill_transaction_id == transaction_id)
        )
        post_purchase = result.scalar_one_or_none()
        if post_purchase:
            post_purchase.status = "DISPUTED"
            await session.flush()
            return

        result = await session.execute(
            select(Tip).where(Tip.ccbill_transaction_id == transaction_id)
        )
        tip = result.scalar_one_or_none()
        if tip:
            tip.status = "DISPUTED"
            await session.flush()
            return

    # Check subscription
    if subscription_id:
        result = await session.execute(
            select(Subscription).where(Subscription.ccbill_subscription_id == subscription_id)
        )
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = "disputed"
            await session.flush()

    logger.warning("ccbill chargeback subscription_id=%s transaction_id=%s", subscription_id, transaction_id)


async def _handle_new_sale_failure(session: AsyncSession, params: dict) -> None:
    """Handle NewSaleFailure: mark pending tips/ppv as CANCELED."""
    payment_type = params.get("zv_payment_type", "")

    if payment_type == "TIP":
        tip_id_str = params.get("zv_tip_id")
        if tip_id_str:
            result = await session.execute(select(Tip).where(Tip.id == UUID(tip_id_str)))
            tip = result.scalar_one_or_none()
            if tip and tip.status == "REQUIRES_PAYMENT":
                tip.status = "CANCELED"
    elif payment_type == "PPV_MESSAGE_UNLOCK":
        purchase_id_str = params.get("zv_purchase_id")
        if purchase_id_str:
            result = await session.execute(select(PpvPurchase).where(PpvPurchase.id == UUID(purchase_id_str)))
            purchase = result.scalar_one_or_none()
            if purchase and purchase.status == "REQUIRES_PAYMENT":
                purchase.status = "CANCELED"
    elif payment_type == "PPV_POST_UNLOCK":
        purchase_id_str = params.get("zv_purchase_id")
        if purchase_id_str:
            result = await session.execute(select(PostPurchase).where(PostPurchase.id == UUID(purchase_id_str)))
            purchase = result.scalar_one_or_none()
            if purchase and purchase.status == "REQUIRES_PAYMENT":
                purchase.status = "CANCELED"
    await session.flush()


# ---------------------------------------------------------------------------
# Main event dispatcher
# ---------------------------------------------------------------------------

async def handle_ccbill_event(session: AsyncSession, params: dict) -> str:
    """Dispatch CCBill webhook event. Return outcome: processed|ignored|error."""
    event_type = params.get("eventType", "")
    event_id = params.get("transactionId") or params.get("subscriptionId") or str(uuid4())

    if not _is_handled_event_type(event_type):
        logger.info("ccbill webhook ignored event_type=%s", event_type)
        return "ignored"

    try:
        audit_action: str | None = None
        audit_metadata: dict[str, Any] = {"event_id": event_id, "event_type": event_type}

        if event_type == "NewSaleSuccess":
            await _handle_new_sale_success(session, params)
            payment_type = params.get("zv_payment_type", "SUBSCRIPTION")
            audit_action = ACTION_SUBSCRIPTION_CREATED if payment_type == "SUBSCRIPTION" else ACTION_PAYMENT_SUCCEEDED
        elif event_type == "NewSaleFailure":
            await _handle_new_sale_failure(session, params)
            audit_action = ACTION_PAYMENT_FAILED
        elif event_type == "RenewalSuccess":
            await _handle_renewal_success(session, params)
            audit_action = ACTION_PAYMENT_SUCCEEDED
        elif event_type == "RenewalFailure":
            sub_id = params.get("subscriptionId", "")
            if sub_id:
                result = await session.execute(
                    select(Subscription).where(Subscription.ccbill_subscription_id == sub_id)
                )
                sub = result.scalar_one_or_none()
                if sub and sub.status != "canceled":
                    sub.status = "past_due"
                    await session.flush()
            audit_action = ACTION_PAYMENT_FAILED
        elif event_type == "Cancellation":
            await _handle_cancellation(session, params)
            audit_action = ACTION_SUBSCRIPTION_CANCELED
        elif event_type == "Expiration":
            await _handle_cancellation(session, params)
            audit_action = ACTION_SUBSCRIPTION_CANCELED
        elif event_type == "Chargeback":
            await _handle_chargeback(session, params)
            audit_action = ACTION_DISPUTE_CREATED
        elif event_type in ("Refund", "Return", "Void"):
            await _handle_refund(session, params)
            audit_action = ACTION_REFUND

        if audit_action:
            await log_audit_event(
                session,
                action=audit_action,
                resource_type="ccbill_event",
                resource_id=event_id,
                metadata=audit_metadata,
                auto_commit=False,
            )

        logger.info("ccbill webhook handled event_type=%s event_id=%s", event_type, event_id)
        return "processed"
    except Exception:
        logger.exception("ccbill webhook handler failed event_type=%s event_id=%s", event_type, event_id)
        raise


# ---------------------------------------------------------------------------
# Worldline webhook handlers
# ---------------------------------------------------------------------------

def _parse_merchant_reference(ref: str) -> dict[str, str]:
    """Parse pipe-delimited key=value custom fields from merchantReference."""
    result: dict[str, str] = {}
    if not ref:
        return result
    for part in ref.split("|"):
        if "=" in part:
            k, v = part.split("=", 1)
            result[k] = v
    return result


def _worldline_amount_to_str(amount_minor: int, currency: str = "EUR") -> str:
    """Convert Worldline minor-unit amount (cents) to decimal string."""
    return str(Decimal(amount_minor) / 100)


async def handle_worldline_event(session: AsyncSession, payload: dict) -> str:
    """Dispatch Worldline webhook event. Return outcome: processed|ignored|error.

    Worldline webhook payload structure:
      { "id": "...", "type": "payment.paid", "payment": { ... } }
    """
    event_type = payload.get("type", "")
    event_id = payload.get("id", str(uuid4()))

    # Extract payment/refund objects
    payment = payload.get("payment") or {}
    refund_obj = payload.get("refund") or {}

    # Parse custom fields from merchantReference
    payment_output = payment.get("paymentOutput") or {}
    refs = payment_output.get("references") or {}
    merchant_ref = refs.get("merchantReference", "")
    custom = _parse_merchant_reference(merchant_ref)

    # Also try refund output references
    if not custom and refund_obj:
        refund_output = refund_obj.get("refundOutput") or {}
        refund_refs = refund_output.get("references") or {}
        custom = _parse_merchant_reference(refund_refs.get("merchantReference", ""))

    try:
        audit_action: str | None = None
        audit_metadata: dict[str, Any] = {"event_id": event_id, "event_type": event_type}

        if event_type in ("payment.paid", "payment.captured"):
            await _handle_worldline_payment_success(session, payment, custom)
            payment_type = custom.get("zv_payment_type", "SUBSCRIPTION")
            audit_action = ACTION_SUBSCRIPTION_CREATED if payment_type == "SUBSCRIPTION" else ACTION_PAYMENT_SUCCEEDED

        elif event_type in ("payment.rejected", "payment.cancelled"):
            await _handle_worldline_payment_failure(session, payment, custom)
            audit_action = ACTION_PAYMENT_FAILED

        elif event_type == "payment.refunded":
            await _handle_worldline_refund(session, payment, refund_obj, custom)
            audit_action = ACTION_REFUND

        elif event_type == "payment.chargebacked":
            await _handle_worldline_chargeback(session, payment, custom)
            audit_action = ACTION_DISPUTE_CREATED

        else:
            logger.info("worldline webhook ignored event_type=%s", event_type)
            return "ignored"

        if audit_action:
            await log_audit_event(
                session,
                action=audit_action,
                resource_type="worldline_event",
                resource_id=event_id,
                metadata=audit_metadata,
                auto_commit=False,
            )

        logger.info("worldline webhook handled event_type=%s event_id=%s", event_type, event_id)
        return "processed"
    except Exception:
        logger.exception("worldline webhook handler failed event_type=%s event_id=%s", event_type, event_id)
        raise


async def _handle_worldline_payment_success(
    session: AsyncSession, payment: dict, custom: dict
) -> None:
    """Handle successful Worldline payment (paid/captured)."""
    payment_id = payment.get("id", "")
    payment_output = payment.get("paymentOutput") or {}
    amount_info = payment_output.get("amountOfMoney") or {}
    amount_cents = amount_info.get("amount", 0)
    currency = amount_info.get("currencyCode", "EUR").lower()

    fan_user_id_str = custom.get("zv_fan_user_id")
    creator_user_id_str = custom.get("zv_creator_user_id")
    payment_type = custom.get("zv_payment_type", "SUBSCRIPTION")

    if not fan_user_id_str or not creator_user_id_str:
        logger.warning("worldline payment success missing zv_fan_user_id/zv_creator_user_id payment_id=%s", payment_id)
        return

    fan_user_id = UUID(fan_user_id_str)
    creator_user_id = UUID(creator_user_id_str)

    if payment_type == "TIP":
        tip_id_str = custom.get("zv_tip_id")
        if not tip_id_str:
            logger.warning("worldline TIP payment missing zv_tip_id")
            return
        result = await session.execute(select(Tip).where(Tip.id == UUID(tip_id_str)))
        tip = result.scalar_one_or_none()
        if not tip or tip.status == "SUCCEEDED":
            return
        tip.status = "SUCCEEDED"
        tip.ccbill_transaction_id = f"wl:{payment_id}"
        amount_str = _worldline_amount_to_str(amount_cents, currency)
        await _create_payment_ledger_entries(
            session, amount_str, currency, str(creator_user_id), f"wl_tip:{payment_id}"
        )
        await create_ledger_event(
            session,
            creator_id=creator_user_id,
            type="TIP",
            gross_cents=tip.amount_cents,
            fee_cents=_fee_cents(tip.amount_cents),
            net_cents=tip.amount_cents - _fee_cents(tip.amount_cents),
            currency=currency,
            reference_type="tip",
            reference_id=tip_id_str,
        )
        await session.flush()
        return

    if payment_type in ("PPV_MESSAGE_UNLOCK", "PPV_POST_UNLOCK"):
        purchase_id_str = custom.get("zv_purchase_id")
        if not purchase_id_str:
            logger.warning("worldline PPV payment missing zv_purchase_id")
            return
        if payment_type == "PPV_MESSAGE_UNLOCK":
            result = await session.execute(select(PpvPurchase).where(PpvPurchase.id == UUID(purchase_id_str)))
        else:
            result = await session.execute(select(PostPurchase).where(PostPurchase.id == UUID(purchase_id_str)))
        purchase = result.scalar_one_or_none()
        if not purchase or purchase.status == "SUCCEEDED":
            return
        purchase.status = "SUCCEEDED"
        purchase.ccbill_transaction_id = f"wl:{payment_id}"
        amount_str = _worldline_amount_to_str(amount_cents, currency)
        await _create_payment_ledger_entries(
            session, amount_str, currency, str(purchase.creator_id), f"wl_ppv:{payment_id}"
        )
        ledger_type = "PPV_UNLOCK" if payment_type == "PPV_MESSAGE_UNLOCK" else "PPV_POST_UNLOCK"
        await create_ledger_event(
            session,
            creator_id=UUID(str(purchase.creator_id)),
            type=ledger_type,
            gross_cents=purchase.amount_cents,
            fee_cents=_fee_cents(purchase.amount_cents),
            net_cents=purchase.amount_cents - _fee_cents(purchase.amount_cents),
            currency=currency,
            reference_type="ppv_purchase" if payment_type == "PPV_MESSAGE_UNLOCK" else "post_purchase",
            reference_id=purchase_id_str,
        )
        await session.flush()
        return

    # Subscription payment
    period_end = _period_end_from_days(30)
    result = await session.execute(
        select(Subscription).where(
            Subscription.fan_user_id == fan_user_id,
            Subscription.creator_user_id == creator_user_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.ccbill_subscription_id = f"wl:{payment_id}"
        existing.status = "active"
        existing.renew_at = period_end
        existing.current_period_end = period_end
        existing.cancel_at_period_end = False
        existing.cancel_at = None
    else:
        sub = Subscription(
            fan_user_id=fan_user_id,
            creator_user_id=creator_user_id,
            status="active",
            renew_at=period_end,
            current_period_end=period_end,
            cancel_at_period_end=False,
            ccbill_subscription_id=f"wl:{payment_id}",
        )
        session.add(sub)
    await session.flush()

    amount_str = _worldline_amount_to_str(amount_cents, currency)
    await _create_payment_ledger_entries(
        session, amount_str, currency, str(creator_user_id), f"wl_sub:{payment_id}"
    )

    logger.info(
        "worldline subscription created fan_user_id=%s creator_user_id=%s payment_id=%s",
        fan_user_id, creator_user_id, payment_id,
    )


async def _handle_worldline_payment_failure(
    session: AsyncSession, payment: dict, custom: dict
) -> None:
    """Handle failed/cancelled Worldline payment."""
    payment_type = custom.get("zv_payment_type", "")

    if payment_type == "TIP":
        tip_id_str = custom.get("zv_tip_id")
        if tip_id_str:
            result = await session.execute(select(Tip).where(Tip.id == UUID(tip_id_str)))
            tip = result.scalar_one_or_none()
            if tip and tip.status == "REQUIRES_PAYMENT":
                tip.status = "CANCELED"
    elif payment_type == "PPV_MESSAGE_UNLOCK":
        purchase_id_str = custom.get("zv_purchase_id")
        if purchase_id_str:
            result = await session.execute(select(PpvPurchase).where(PpvPurchase.id == UUID(purchase_id_str)))
            purchase = result.scalar_one_or_none()
            if purchase and purchase.status == "REQUIRES_PAYMENT":
                purchase.status = "CANCELED"
    elif payment_type == "PPV_POST_UNLOCK":
        purchase_id_str = custom.get("zv_purchase_id")
        if purchase_id_str:
            result = await session.execute(select(PostPurchase).where(PostPurchase.id == UUID(purchase_id_str)))
            purchase = result.scalar_one_or_none()
            if purchase and purchase.status == "REQUIRES_PAYMENT":
                purchase.status = "CANCELED"
    await session.flush()


async def _handle_worldline_refund(
    session: AsyncSession, payment: dict, refund_obj: dict, custom: dict
) -> None:
    """Handle Worldline refund event."""
    payment_id = payment.get("id", "")
    wl_tx_id = f"wl:{payment_id}"

    # Get refund amount
    refund_output = refund_obj.get("refundOutput") or {}
    amount_info = refund_output.get("amountOfMoney") or {}
    if not amount_info:
        # Fallback to payment amount
        payment_output = payment.get("paymentOutput") or {}
        amount_info = payment_output.get("amountOfMoney") or {}
    amount_cents = amount_info.get("amount", 0)
    currency = amount_info.get("currencyCode", "EUR").lower()
    amount = Decimal(amount_cents) / 100
    ref = f"wl_refund:{payment_id}"

    settings = get_settings()
    fee_pct = Decimal(str(settings.platform_fee_percent)) / 100

    # Try PPV purchase
    result = await session.execute(
        select(PpvPurchase).where(PpvPurchase.ccbill_transaction_id == wl_tx_id)
    )
    purchase = result.scalar_one_or_none()
    if purchase and purchase.status != "REFUNDED":
        purchase.status = "REFUNDED"
        creator_debit = (amount * (1 - fee_pct)).quantize(Decimal("0.01"))
        platform_debit = (amount * fee_pct).quantize(Decimal("0.01"))
        if creator_debit > 0:
            await create_ledger_entry(session, account_id=creator_pending_account_id(str(purchase.creator_id)), currency=currency, amount=creator_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        if platform_debit > 0:
            await create_ledger_entry(session, account_id=PLATFORM_ACCOUNT_ID, currency=currency, amount=platform_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        await session.flush()
        return

    # Try post purchase
    result = await session.execute(
        select(PostPurchase).where(PostPurchase.ccbill_transaction_id == wl_tx_id)
    )
    post_purchase = result.scalar_one_or_none()
    if post_purchase and post_purchase.status != "REFUNDED":
        post_purchase.status = "REFUNDED"
        creator_debit = (amount * (1 - fee_pct)).quantize(Decimal("0.01"))
        platform_debit = (amount * fee_pct).quantize(Decimal("0.01"))
        if creator_debit > 0:
            await create_ledger_entry(session, account_id=creator_pending_account_id(str(post_purchase.creator_id)), currency=currency, amount=creator_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        if platform_debit > 0:
            await create_ledger_entry(session, account_id=PLATFORM_ACCOUNT_ID, currency=currency, amount=platform_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        await session.flush()
        return

    # Try tip
    result = await session.execute(
        select(Tip).where(Tip.ccbill_transaction_id == wl_tx_id)
    )
    tip = result.scalar_one_or_none()
    if tip and tip.status != "REFUNDED":
        tip.status = "REFUNDED"
        creator_debit = (amount * (1 - fee_pct)).quantize(Decimal("0.01"))
        platform_debit = (amount * fee_pct).quantize(Decimal("0.01"))
        if creator_debit > 0:
            await create_ledger_entry(session, account_id=creator_pending_account_id(str(tip.creator_id)), currency=currency, amount=creator_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        if platform_debit > 0:
            await create_ledger_entry(session, account_id=PLATFORM_ACCOUNT_ID, currency=currency, amount=platform_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        await session.flush()

    # Try subscription
    result = await session.execute(
        select(Subscription).where(Subscription.ccbill_subscription_id == wl_tx_id)
    )
    sub = result.scalar_one_or_none()
    if sub and sub.status != "refunded":
        sub.status = "refunded"
        # Reverse ledger entries for the subscription payment
        creator_debit = (amount * (1 - fee_pct)).quantize(Decimal("0.01"))
        platform_debit = (amount * fee_pct).quantize(Decimal("0.01"))
        if creator_debit > 0:
            await create_ledger_entry(session, account_id=creator_pending_account_id(str(sub.creator_user_id)), currency=currency, amount=creator_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        if platform_debit > 0:
            await create_ledger_entry(session, account_id=PLATFORM_ACCOUNT_ID, currency=currency, amount=platform_debit, direction=LEDGER_DIRECTION_DEBIT, reference=ref, auto_commit=False)
        await session.flush()

    logger.info("worldline refund processed payment_id=%s amount_cents=%s", payment_id, amount_cents)


async def _handle_worldline_chargeback(
    session: AsyncSession, payment: dict, custom: dict
) -> None:
    """Handle Worldline chargeback event."""
    payment_id = payment.get("id", "")
    wl_tx_id = f"wl:{payment_id}"

    # Check PPV purchases
    result = await session.execute(
        select(PpvPurchase).where(PpvPurchase.ccbill_transaction_id == wl_tx_id)
    )
    purchase = result.scalar_one_or_none()
    if purchase:
        purchase.status = "DISPUTED"
        await session.flush()
        return

    result = await session.execute(
        select(PostPurchase).where(PostPurchase.ccbill_transaction_id == wl_tx_id)
    )
    post_purchase = result.scalar_one_or_none()
    if post_purchase:
        post_purchase.status = "DISPUTED"
        await session.flush()
        return

    result = await session.execute(
        select(Tip).where(Tip.ccbill_transaction_id == wl_tx_id)
    )
    tip = result.scalar_one_or_none()
    if tip:
        tip.status = "DISPUTED"
        await session.flush()
        return

    # Check subscription
    result = await session.execute(
        select(Subscription).where(Subscription.ccbill_subscription_id == wl_tx_id)
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = "disputed"
        await session.flush()

    logger.warning("worldline chargeback payment_id=%s", payment_id)


# ---------------------------------------------------------------------------
# Subscription queries (provider-agnostic)
# ---------------------------------------------------------------------------

def _subscription_active_filter() -> Any:
    now = datetime.now(timezone.utc)
    settings = get_settings()
    grace_cutoff = now - timedelta(hours=settings.subscription_grace_period_hours)
    period_valid = or_(
        Subscription.current_period_end.is_(None),
        Subscription.current_period_end > now,
    )
    status_valid = or_(
        Subscription.status == "active",
        sa.and_(
            Subscription.status == "past_due",
            Subscription.updated_at >= grace_cutoff,
        ),
    )
    return sa.and_(period_valid, status_valid)


async def is_active_subscriber(
    session: AsyncSession, fan_user_id: UUID, creator_user_id: UUID
) -> bool:
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
    if not sub.ccbill_subscription_id:
        raise AppError(status_code=400, detail="subscription_not_cancelable")

    success = await cancel_ccbill_subscription(sub.ccbill_subscription_id)
    if not success:
        logger.warning("ccbill cancel API failed, marking locally only subscription_id=%s", subscription_id)

    sub.cancel_at_period_end = True
    await log_audit_event(
        session,
        action=ACTION_SUBSCRIPTION_CANCELED,
        actor_id=fan_user_id,
        resource_type="subscription",
        resource_id=str(subscription_id),
        metadata={"ccbill_subscription_id": sub.ccbill_subscription_id},
        auto_commit=False,
    )
    await session.commit()
    await session.refresh(sub)
    return sub


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _currency_code_to_str(code: str) -> str:
    """Convert CCBill numeric currency code to 3-letter string."""
    mapping = {"840": "usd", "978": "eur", "826": "gbp", "036": "aud", "124": "cad", "392": "jpy"}
    return mapping.get(str(code), "eur")


def _fee_cents(amount_cents: int) -> int:
    settings = get_settings()
    fee_pct = Decimal(str(settings.platform_fee_percent)) / 100
    return int((Decimal(amount_cents) * fee_pct).quantize(Decimal("1")))


async def _create_payment_ledger_entries(
    session: AsyncSession,
    amount_str: str,
    currency: str,
    creator_user_id_str: str,
    reference: str,
) -> None:
    """Create platform + creator ledger entries for a payment."""
    settings = get_settings()
    amount = Decimal(amount_str)
    if amount <= 0:
        return
    fee_pct = Decimal(str(settings.platform_fee_percent)) / 100
    platform_amount = (amount * fee_pct).quantize(Decimal("0.01"))
    creator_amount = (amount - platform_amount).quantize(Decimal("0.01"))

    if platform_amount > 0:
        await create_ledger_entry(
            session, account_id=PLATFORM_ACCOUNT_ID, currency=currency,
            amount=platform_amount, direction=LEDGER_DIRECTION_CREDIT,
            reference=reference, auto_commit=False,
        )
    if creator_amount > 0:
        await create_ledger_entry(
            session, account_id=creator_pending_account_id(creator_user_id_str),
            currency=currency, amount=creator_amount, direction=LEDGER_DIRECTION_CREDIT,
            reference=reference, auto_commit=False,
        )
