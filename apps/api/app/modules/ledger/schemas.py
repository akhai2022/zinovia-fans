from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.ledger.constants import LEDGER_DIRECTION_CREDIT, LEDGER_DIRECTION_DEBIT


class LedgerEntryCreate(BaseModel):
    account_id: str
    currency: str = Field(min_length=3, max_length=8)
    amount: Decimal = Field(gt=0)
    direction: str = Field(pattern=f"^({LEDGER_DIRECTION_CREDIT}|{LEDGER_DIRECTION_DEBIT})$")
    reference: str


class LedgerEntryOut(BaseModel):
    id: UUID
    account_id: str
    currency: str
    amount: Decimal
    direction: str
    reference: str
    created_at: datetime
