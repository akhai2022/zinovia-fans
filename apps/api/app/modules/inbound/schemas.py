"""Schemas for inbound email admin endpoints."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AttachmentMeta(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int


class InboundEmailOut(BaseModel):
    id: UUID
    resend_email_id: str
    from_address: str
    to_addresses: list[str]
    cc_addresses: list[str]
    subject: str
    category: str
    snippet: str
    attachment_count: int
    attachments_meta: list[AttachmentMeta]
    is_read: bool
    forwarded_to: str | None
    forwarded_at: datetime | None
    received_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class InboundEmailDetail(InboundEmailOut):
    """Full email detail including bodies and headers."""
    html_body: str | None
    text_body: str | None
    reply_to_addresses: list[str]
    message_id_header: str | None
    headers: dict | None
    raw_download_url: str | None
    raw_download_expires_at: datetime | None
    spf_result: str | None
    dkim_result: str | None
    spam_score: str | None


class InboundEmailPage(BaseModel):
    items: list[InboundEmailOut]
    total: int
    page: int = 1
    page_size: int = 20


class InboundCategoryCount(BaseModel):
    category: str
    total: int
    unread: int


class InboundStatsOut(BaseModel):
    categories: list[InboundCategoryCount]
    total: int
    total_unread: int
