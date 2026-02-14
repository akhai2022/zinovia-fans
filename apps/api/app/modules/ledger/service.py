from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from uuid import UUID

from app.modules.ledger.constants import DEFAULT_BALANCE, LEDGER_DIRECTION_CREDIT
from app.modules.ledger.models import LedgerBalance, LedgerEntry, LedgerEvent


async def create_ledger_entry(
    session: AsyncSession,
    account_id: str,
    currency: str,
    amount: Decimal,
    direction: str,
    reference: str,
    *,
    auto_commit: bool = True,
) -> LedgerEntry | None:
    """
    Create a ledger entry with idempotency by (account_id, reference).
    If an entry with the same account_id + reference already exists, skip (return None).
    This prevents double ledger entries from duplicate webhook events.
    """
    # Idempotency check: skip if entry already exists for this account + reference
    existing = await session.execute(
        select(LedgerEntry.id).where(
            LedgerEntry.account_id == account_id,
            LedgerEntry.reference == reference,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return None

    delta = amount if direction == LEDGER_DIRECTION_CREDIT else -amount
    entry = LedgerEntry(
        account_id=account_id,
        currency=currency,
        amount=amount,
        direction=direction,
        reference=reference,
    )

    result = await session.execute(
        select(LedgerBalance)
        .where(LedgerBalance.account_id == account_id, LedgerBalance.currency == currency)
        .with_for_update()
    )
    balance = result.scalar_one_or_none()
    if balance is None:
        balance = LedgerBalance(
            account_id=account_id, currency=currency, balance=Decimal(DEFAULT_BALANCE)
        )
        session.add(balance)
    balance.balance = balance.balance + delta

    session.add(entry)
    if auto_commit:
        await session.commit()
        await session.refresh(entry)
    else:
        await session.flush()
    return entry


async def create_ledger_event(
    session: AsyncSession,
    creator_id: UUID,
    type: str,
    gross_cents: int,
    fee_cents: int,
    net_cents: int,
    currency: str,
    reference_type: str | None = None,
    reference_id: str | None = None,
) -> LedgerEvent:
    """Create a ledger event for tips, PPV, subs (gross, fee, net in cents)."""
    evt = LedgerEvent(
        creator_id=creator_id,
        type=type,
        gross_cents=gross_cents,
        fee_cents=fee_cents,
        net_cents=net_cents,
        currency=currency,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    session.add(evt)
    await session.flush()
    return evt
