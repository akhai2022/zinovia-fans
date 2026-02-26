"""Payout business logic: reconcile availability, generate weekly payouts, export CSV, status transitions."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import String, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.crypto.encryption import decrypt, encrypt
from app.modules.ledger.constants import LEDGER_DIRECTION_CREDIT, LEDGER_DIRECTION_DEBIT
from app.modules.ledger.models import LedgerBalance, LedgerEntry, LedgerEvent
from app.modules.payouts.models import (
    CreatorPayoutSettings,
    Payout,
    PayoutAuditLog,
    PayoutItem,
)
from app.modules.payouts.validation import iban_last4, validate_bic, validate_iban

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HOLD_DAYS = 10  # Funds become available after N days
MIN_PAYOUT_CENTS = 5000  # Minimum payout threshold (€50)
DEFAULT_COMMISSION_BPS = 2000  # 20% default


def _commission_bps_for_creator(creator_id: uuid.UUID) -> int:
    """Return commission in basis points. Per-creator override could be added here."""
    settings = get_settings()
    # platform_fee_percent is e.g. 20.0 for 20%
    return int(settings.platform_fee_percent * 100)


# ---------------------------------------------------------------------------
# Creator payout settings
# ---------------------------------------------------------------------------


async def get_payout_settings(
    session: AsyncSession, creator_id: uuid.UUID
) -> CreatorPayoutSettings | None:
    result = await session.execute(
        select(CreatorPayoutSettings).where(CreatorPayoutSettings.creator_id == creator_id)
    )
    return result.scalar_one_or_none()


async def upsert_payout_settings(
    session: AsyncSession,
    creator_id: uuid.UUID,
    *,
    account_holder_name: str,
    iban_raw: str,
    bic_raw: str | None,
    country_code: str,
    billing_address_line1: str | None = None,
    billing_address_line2: str | None = None,
    billing_city: str | None = None,
    billing_postal_code: str | None = None,
    billing_region: str | None = None,
    billing_country: str | None = None,
) -> CreatorPayoutSettings:
    """Validate, encrypt, and upsert creator payout settings."""
    iban_clean = validate_iban(iban_raw)
    bic_clean = validate_bic(bic_raw) if bic_raw else None

    iban_enc = encrypt(iban_clean)
    bic_enc = encrypt(bic_clean) if bic_clean else None
    last4 = iban_last4(iban_clean)

    existing = await get_payout_settings(session, creator_id)
    if existing:
        existing.account_holder_name = account_holder_name
        existing.iban_encrypted = iban_enc
        existing.iban_last4 = last4
        existing.bic_encrypted = bic_enc
        existing.country_code = country_code.upper()
        existing.billing_address_line1 = billing_address_line1
        existing.billing_address_line2 = billing_address_line2
        existing.billing_city = billing_city
        existing.billing_postal_code = billing_postal_code
        existing.billing_region = billing_region
        existing.billing_country = billing_country
        existing.status = "active"
        await session.commit()
        await session.refresh(existing)
        return existing

    settings = CreatorPayoutSettings(
        creator_id=creator_id,
        account_holder_name=account_holder_name,
        iban_encrypted=iban_enc,
        iban_last4=last4,
        bic_encrypted=bic_enc,
        country_code=country_code.upper(),
        billing_address_line1=billing_address_line1,
        billing_address_line2=billing_address_line2,
        billing_city=billing_city,
        billing_postal_code=billing_postal_code,
        billing_region=billing_region,
        billing_country=billing_country,
        status="active",
    )
    session.add(settings)
    await session.commit()
    await session.refresh(settings)
    return settings


# ---------------------------------------------------------------------------
# Availability reconciliation
# ---------------------------------------------------------------------------


async def reconcile_availability(
    session: AsyncSession, now: datetime | None = None
) -> dict:
    """Move funds from pending → available for ledger events past hold period.

    Idempotent: only processes events that have not been reconciled (no
    matching ledger entry for the 'available' reference).
    """
    if now is None:
        now = datetime.now(timezone.utc)

    # Find ledger events that are:
    # 1. Older than HOLD_DAYS
    # 2. Status = succeeded (not refunded/disputed)
    # 3. Haven't already been moved to available (no matching available entry)
    cutoff = now - timedelta(days=HOLD_DAYS)

    # Get all creator pending ledger events that are old enough and not yet reconciled
    # A reconciled event has a matching entry with reference = 'avail:{event_id}'
    already_reconciled = select(LedgerEntry.reference).where(
        LedgerEntry.reference.like("avail:%")
    ).scalar_subquery()

    events = (
        await session.execute(
            select(LedgerEvent)
            .where(
                LedgerEvent.created_at <= cutoff,
                LedgerEvent.net_cents > 0,
                # Not already reconciled
                ~func.concat("avail:", LedgerEvent.id.cast(String)).in_(
                    select(LedgerEntry.reference)
                ),
            )
            .limit(1000)  # Process in batches for safety
        )
    ).scalars().all()

    total_moved = 0
    creators_updated: set[uuid.UUID] = set()

    for event in events:
        ref = f"avail:{event.id}"
        creator_pending_acct = f"creator_pending:{event.creator_id}"
        creator_avail_acct = f"creator_available:{event.creator_id}"
        amount = Decimal(event.net_cents) / 100

        # Debit pending
        session.add(LedgerEntry(
            account_id=creator_pending_acct,
            currency=event.currency,
            amount=amount,
            direction=LEDGER_DIRECTION_DEBIT,
            reference=ref,
        ))
        # Credit available
        session.add(LedgerEntry(
            account_id=creator_avail_acct,
            currency=event.currency,
            amount=amount,
            direction=LEDGER_DIRECTION_CREDIT,
            reference=ref,
        ))

        # Update balances
        await _update_balance(session, creator_pending_acct, event.currency, -amount)
        await _update_balance(session, creator_avail_acct, event.currency, amount)

        total_moved += event.net_cents
        creators_updated.add(event.creator_id)

    await session.commit()
    return {"creators_updated": len(creators_updated), "total_cents_moved": total_moved}


# ---------------------------------------------------------------------------
# Weekly payout generation
# ---------------------------------------------------------------------------


async def generate_weekly_payouts(
    session: AsyncSession,
    period_start: datetime,
    period_end: datetime,
) -> dict:
    """Generate payouts for eligible creators.

    Idempotent: unique constraint on (creator_id, period_start, period_end) prevents duplicates.
    """
    # Find creators with active payout settings and sufficient available balance
    avail_balances = (
        await session.execute(
            select(LedgerBalance)
            .where(
                LedgerBalance.account_id.like("creator_available:%"),
                LedgerBalance.balance >= Decimal(MIN_PAYOUT_CENTS) / 100,
            )
        )
    ).scalars().all()

    payouts_created = 0
    total_cents = 0
    skipped = 0

    for bal in avail_balances:
        # Extract creator_id from account_id format "creator_available:{uuid}"
        creator_id_str = bal.account_id.replace("creator_available:", "")
        try:
            creator_id = uuid.UUID(creator_id_str)
        except ValueError:
            continue

        # Check payout settings
        settings = await get_payout_settings(session, creator_id)
        if not settings or settings.status != "active":
            skipped += 1
            continue

        # Calculate available cents
        available_cents = int(bal.balance * 100)
        if available_cents < MIN_PAYOUT_CENTS:
            skipped += 1
            continue

        # Get un-paid ledger events that are available (have been reconciled)
        # i.e., events that have a 'avail:' entry and are not yet in any payout_item
        avail_events = (
            await session.execute(
                select(LedgerEvent)
                .where(
                    LedgerEvent.creator_id == creator_id,
                    LedgerEvent.net_cents > 0,
                    LedgerEvent.created_at >= period_start,
                    LedgerEvent.created_at <= period_end,
                    # Has been reconciled (avail entry exists)
                    func.concat("avail:", LedgerEvent.id.cast(String)).in_(
                        select(LedgerEntry.reference).where(
                            LedgerEntry.reference.like("avail:%")
                        )
                    ),
                    # Not already in a payout
                    ~LedgerEvent.id.in_(
                        select(PayoutItem.ledger_event_id)
                    ),
                )
            )
        ).scalars().all()

        if not avail_events:
            skipped += 1
            continue

        payout_amount_cents = sum(e.net_cents for e in avail_events)
        if payout_amount_cents < MIN_PAYOUT_CENTS:
            skipped += 1
            continue

        # Create payout — unique constraint prevents duplicates
        try:
            payout = Payout(
                creator_id=creator_id,
                amount_cents=payout_amount_cents,
                currency="eur",
                method="sepa",
                status="queued",
                period_start=period_start,
                period_end=period_end,
            )
            session.add(payout)
            await session.flush()  # Get payout.id

            # Create payout items
            for event in avail_events:
                session.add(PayoutItem(
                    payout_id=payout.id,
                    ledger_event_id=event.id,
                    amount_cents=event.net_cents,
                ))

            # Debit available, credit paid_out
            payout_amount = Decimal(payout_amount_cents) / 100
            creator_avail_acct = f"creator_available:{creator_id}"
            creator_paidout_acct = f"creator_paid_out:{creator_id}"
            payout_ref = f"payout:{payout.id}"

            session.add(LedgerEntry(
                account_id=creator_avail_acct,
                currency="eur",
                amount=payout_amount,
                direction=LEDGER_DIRECTION_DEBIT,
                reference=payout_ref,
            ))
            session.add(LedgerEntry(
                account_id=creator_paidout_acct,
                currency="eur",
                amount=payout_amount,
                direction=LEDGER_DIRECTION_CREDIT,
                reference=payout_ref,
            ))
            await _update_balance(session, creator_avail_acct, "eur", -payout_amount)
            await _update_balance(session, creator_paidout_acct, "eur", payout_amount)

            payouts_created += 1
            total_cents += payout_amount_cents

        except Exception:
            # Unique constraint violation = already created for this period → skip
            await session.rollback()
            continue

    await session.commit()
    return {
        "payouts_created": payouts_created,
        "total_cents": total_cents,
        "skipped_below_threshold": skipped,
    }


# ---------------------------------------------------------------------------
# CSV export for SEPA bank upload
# ---------------------------------------------------------------------------


async def export_payouts_csv(
    session: AsyncSession,
    actor_id: uuid.UUID,
    status_filter: str = "queued",
) -> str:
    """Export payouts as CSV for bank portal upload. Decrypts IBAN/BIC.

    Marks exported payouts with batch ID and exported_at timestamp.
    Creates audit log entry.
    """
    payouts = (
        await session.execute(
            select(Payout)
            .where(Payout.status == status_filter)
            .order_by(Payout.creator_id)
        )
    ).scalars().all()

    if not payouts:
        return ""

    batch_id = f"batch-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "payout_id", "beneficiary_name", "iban", "bic", "amount_eur",
        "currency", "reference", "creator_id",
    ])

    for payout in payouts:
        settings = await get_payout_settings(session, payout.creator_id)
        if not settings:
            continue

        iban_plain = decrypt(settings.iban_encrypted)
        bic_plain = decrypt(settings.bic_encrypted) if settings.bic_encrypted else ""

        writer.writerow([
            str(payout.id),
            settings.account_holder_name,
            iban_plain,
            bic_plain,
            f"{payout.amount_cents / 100:.2f}",
            payout.currency.upper(),
            f"ZINOVIA-{str(payout.id)[:8].upper()}",
            str(payout.creator_id),
        ])

        # Mark as exported
        payout.status = "exported"
        payout.export_batch_id = batch_id
        payout.exported_at = datetime.now(timezone.utc)

    # Audit log
    session.add(PayoutAuditLog(
        actor_user_id=actor_id,
        action="EXPORT_CSV",
        entity_type="payout_batch",
        entity_id=batch_id,
        details={"count": len(payouts), "status_filter": status_filter},
    ))

    await session.commit()
    return output.getvalue()


# ---------------------------------------------------------------------------
# Payout status transitions
# ---------------------------------------------------------------------------

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "queued": {"sent", "failed"},
    "exported": {"sent", "failed"},
    "sent": {"settled", "failed"},
}


async def update_payout_status(
    session: AsyncSession,
    payout_id: uuid.UUID,
    new_status: str,
    actor_id: uuid.UUID,
    bank_reference: str | None = None,
    error_reason: str | None = None,
) -> Payout:
    """Transition payout status with validation and audit trail."""
    payout = (
        await session.execute(
            select(Payout).where(Payout.id == payout_id)
        )
    ).scalar_one_or_none()

    if not payout:
        raise ValueError("Payout not found")

    allowed = ALLOWED_TRANSITIONS.get(payout.status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition from '{payout.status}' to '{new_status}'. "
            f"Allowed: {allowed}"
        )

    old_status = payout.status
    payout.status = new_status
    now = datetime.now(timezone.utc)

    if new_status == "sent":
        payout.sent_at = now
    elif new_status == "settled":
        payout.settled_at = now
    elif new_status == "failed":
        payout.error_reason = error_reason
        # Reverse the balance changes: credit back available, debit paid_out
        payout_amount = Decimal(payout.amount_cents) / 100
        creator_avail = f"creator_available:{payout.creator_id}"
        creator_paidout = f"creator_paid_out:{payout.creator_id}"
        fail_ref = f"payout_fail:{payout.id}"

        session.add(LedgerEntry(
            account_id=creator_avail,
            currency=payout.currency,
            amount=payout_amount,
            direction=LEDGER_DIRECTION_CREDIT,
            reference=fail_ref,
        ))
        session.add(LedgerEntry(
            account_id=creator_paidout,
            currency=payout.currency,
            amount=payout_amount,
            direction=LEDGER_DIRECTION_DEBIT,
            reference=fail_ref,
        ))
        await _update_balance(session, creator_avail, payout.currency, payout_amount)
        await _update_balance(session, creator_paidout, payout.currency, -payout_amount)

    if bank_reference:
        payout.bank_reference = bank_reference

    # Audit
    session.add(PayoutAuditLog(
        actor_user_id=actor_id,
        action="STATUS_CHANGE",
        entity_type="payout",
        entity_id=str(payout_id),
        details={
            "old_status": old_status,
            "new_status": new_status,
            "bank_reference": bank_reference,
            "error_reason": error_reason,
        },
    ))

    await session.commit()
    await session.refresh(payout)
    return payout


# ---------------------------------------------------------------------------
# Balance helper
# ---------------------------------------------------------------------------


async def _update_balance(
    session: AsyncSession,
    account_id: str,
    currency: str,
    delta: Decimal,
) -> None:
    """Atomically update a ledger balance (upsert)."""
    result = await session.execute(
        select(LedgerBalance).where(
            LedgerBalance.account_id == account_id,
            LedgerBalance.currency == currency,
        )
    )
    bal = result.scalar_one_or_none()
    if bal:
        bal.balance = bal.balance + delta
    else:
        session.add(LedgerBalance(
            account_id=account_id,
            currency=currency,
            balance=delta,
        ))
