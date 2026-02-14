"""Creator earnings API schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class EarningsSummary(BaseModel):
    """Gross, fees, net for a time range (cents)."""

    gross_cents: int = Field(..., description="Total gross in minor units")
    fee_cents: int = Field(..., description="Platform fees in minor units")
    net_cents: int = Field(..., description="Net after fees in minor units")
    currency: str = "usd"


class LedgerEventOut(BaseModel):
    """Single ledger event (transaction)."""

    id: UUID
    type: str
    gross_cents: int
    fee_cents: int
    net_cents: int
    currency: str
    reference_type: str | None
    reference_id: str | None
    created_at: datetime


class PayoutMethodStatus(BaseModel):
    """Stripe Connect payout method status (or not configured)."""

    stripe_account_id: str | None = None
    payouts_enabled: bool = False
    charges_enabled: bool = False
    requirements_due: dict | None = Field(
        default=None,
        description="Stripe requirements summary when account has pending items",
    )
    configured: bool = Field(
        default=False,
        description="True if Stripe Connect is set up for this creator",
    )


class CreatorEarningsOut(BaseModel):
    """Full earnings response for creator dashboard."""

    summary: EarningsSummary
    last_transactions: list[LedgerEventOut]
    payout_method: PayoutMethodStatus


class PayoutSetupLinkOut(BaseModel):
    """Response for payout setup link endpoint."""

    configured: bool
    url: str | None = None
    message: str = ""
