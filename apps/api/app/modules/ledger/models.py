from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin
from app.modules.ledger.constants import LEDGER_DIRECTION_CREDIT, LEDGER_DIRECTION_DEBIT


class LedgerEntry(TimestampMixin, Base):
    __tablename__ = "ledger_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[str] = mapped_column(String(64), index=True)
    currency: Mapped[str] = mapped_column(String(8))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    direction: Mapped[str] = mapped_column(String(8))
    reference: Mapped[str] = mapped_column(String(128))

    __table_args__ = (
        CheckConstraint(
            f"direction IN ('{LEDGER_DIRECTION_CREDIT}', '{LEDGER_DIRECTION_DEBIT}')",
            name="ck_ledger_direction",
        ),
    )


class LedgerBalance(TimestampMixin, Base):
    __tablename__ = "ledger_balances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[str] = mapped_column(String(64), index=True)
    currency: Mapped[str] = mapped_column(String(8))
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2))
