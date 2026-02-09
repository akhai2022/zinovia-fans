from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ledger.constants import DEFAULT_BALANCE, LEDGER_DIRECTION_CREDIT
from app.modules.ledger.models import LedgerBalance, LedgerEntry


async def create_ledger_entry(
    session: AsyncSession,
    account_id: str,
    currency: str,
    amount: Decimal,
    direction: str,
    reference: str,
) -> LedgerEntry:
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
    await session.commit()
    await session.refresh(entry)
    return entry
