"""Payouts models: creator_payout_settings, payouts, payout_items, audit_logs."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin


class CreatorPayoutSettings(TimestampMixin, Base):
    """Creator's SEPA payout banking details. IBAN/BIC stored encrypted."""

    __tablename__ = "creator_payout_settings"

    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    method: Mapped[str] = mapped_column(String(16), default="sepa")
    account_holder_name: Mapped[str] = mapped_column(String(200), nullable=False)
    iban_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    iban_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    bic_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)
    billing_address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    billing_address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    billing_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    billing_postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    billing_region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    billing_country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'incomplete', 'disabled')",
            name="ck_payout_settings_status",
        ),
    )


class Payout(TimestampMixin, Base):
    """A single payout disbursement to a creator."""

    __tablename__ = "payouts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="eur")
    method: Mapped[str] = mapped_column(String(16), default="sepa")
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    export_batch_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    bank_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'exported', 'sent', 'failed', 'settled')",
            name="ck_payout_status",
        ),
        UniqueConstraint("creator_id", "period_start", "period_end", name="uq_payout_creator_period"),
    )


class PayoutItem(Base):
    """Join table: which ledger events are included in a payout (reconciliation trail)."""

    __tablename__ = "payout_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payouts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ledger_event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ledger_events.id"), nullable=False
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("payout_id", "ledger_event_id", name="uq_payout_item_event"),
    )


class PayoutAuditLog(Base):
    """Immutable audit trail for payout actions."""

    __tablename__ = "payout_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(128), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
