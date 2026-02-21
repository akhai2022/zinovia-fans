"""Inbound email storage model — persists emails received via Resend Receiving."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InboundEmail(Base):
    __tablename__ = "inbound_emails"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Resend's own email ID — used for idempotency
    resend_email_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)

    # Envelope fields
    from_address: Mapped[str] = mapped_column(String(512), nullable=False)
    to_addresses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    cc_addresses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    reply_to_addresses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    subject: Mapped[str] = mapped_column(String(1024), nullable=False, default="")

    # Category derived from the first matching to-address
    # One of: support, privacy, creators, safety, legal, unknown
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")

    # Body (fetched via Resend Retrieve API)
    html_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Snippet for list view (first 200 chars of text_body)
    snippet: Mapped[str] = mapped_column(String(256), nullable=False, default="")

    # Attachment metadata (JSON array of {id, filename, content_type, size})
    attachments_meta: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    attachment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Raw email download URL from Resend (signed, expires)
    raw_download_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_download_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Message-ID header for threading
    message_id_header: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Headers (full dict from Resend)
    headers: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Spam / validation metadata
    spf_result: Mapped[str | None] = mapped_column(String(32), nullable=True)
    dkim_result: Mapped[str | None] = mapped_column(String(32), nullable=True)
    spam_score: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Read/unread status for admin
    is_read: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Forwarding audit
    forwarded_to: Mapped[str | None] = mapped_column(String(512), nullable=True)
    forwarded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Timestamps
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_inbound_emails_category", "category"),
        Index("ix_inbound_emails_received_at", "received_at"),
        Index("ix_inbound_emails_from_address", "from_address"),
        Index("ix_inbound_emails_is_read", "is_read"),
    )
