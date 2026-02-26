"""Pydantic schemas for the payouts module."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# --- Creator payout settings ---

class PayoutSettingsIn(BaseModel):
    """Input for upserting payout settings."""
    account_holder_name: str = Field(..., min_length=2, max_length=200)
    iban: str = Field(..., min_length=15, max_length=34)
    bic: str | None = Field(None, max_length=11)
    country_code: str = Field(..., min_length=2, max_length=2)
    billing_address_line1: str | None = Field(None, max_length=200)
    billing_address_line2: str | None = Field(None, max_length=200)
    billing_city: str | None = Field(None, max_length=100)
    billing_postal_code: str | None = Field(None, max_length=20)
    billing_region: str | None = Field(None, max_length=100)
    billing_country: str | None = Field(None, max_length=2)


class PayoutSettingsOut(BaseModel):
    """Masked output for payout settings (no decrypted IBAN)."""
    method: str
    status: str
    account_holder_name: str
    iban_last4: str
    country_code: str
    billing_address_line1: str | None = None
    billing_address_line2: str | None = None
    billing_city: str | None = None
    billing_postal_code: str | None = None
    billing_region: str | None = None
    billing_country: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# --- Payouts ---

class PayoutOut(BaseModel):
    id: UUID
    creator_id: UUID
    amount_cents: int
    currency: str
    method: str
    status: str
    period_start: datetime
    period_end: datetime
    created_at: datetime
    exported_at: datetime | None = None
    sent_at: datetime | None = None
    settled_at: datetime | None = None
    export_batch_id: str | None = None
    bank_reference: str | None = None
    error_reason: str | None = None


class PayoutStatusUpdate(BaseModel):
    status: str = Field(..., description="New status: sent, settled, or failed")
    bank_reference: str | None = None
    error_reason: str | None = None


class ReconcileResult(BaseModel):
    creators_updated: int
    total_cents_moved: int


class GeneratePayoutsResult(BaseModel):
    payouts_created: int
    total_cents: int
    skipped_below_threshold: int
