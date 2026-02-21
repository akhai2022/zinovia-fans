"""Create inbound_emails table for Resend Receiving.

Revision ID: 0024_inbound_emails
Revises: 0023_media_placeholders
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0024_inbound_emails"
down_revision = "0023_media_placeholders"


def upgrade() -> None:
    op.create_table(
        "inbound_emails",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("resend_email_id", sa.String(128), unique=True, nullable=False),
        sa.Column("from_address", sa.String(512), nullable=False),
        sa.Column("to_addresses", JSONB, nullable=False, server_default="[]"),
        sa.Column("cc_addresses", JSONB, nullable=False, server_default="[]"),
        sa.Column("reply_to_addresses", JSONB, nullable=False, server_default="[]"),
        sa.Column("subject", sa.String(1024), nullable=False, server_default=""),
        sa.Column("category", sa.String(32), nullable=False, server_default="unknown"),
        sa.Column("html_body", sa.Text, nullable=True),
        sa.Column("text_body", sa.Text, nullable=True),
        sa.Column("snippet", sa.String(256), nullable=False, server_default=""),
        sa.Column("attachments_meta", JSONB, nullable=False, server_default="[]"),
        sa.Column("attachment_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("raw_download_url", sa.Text, nullable=True),
        sa.Column("raw_download_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message_id_header", sa.String(512), nullable=True),
        sa.Column("headers", JSONB, nullable=True),
        sa.Column("spf_result", sa.String(32), nullable=True),
        sa.Column("dkim_result", sa.String(32), nullable=True),
        sa.Column("spam_score", sa.String(32), nullable=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("forwarded_to", sa.String(512), nullable=True),
        sa.Column("forwarded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_inbound_emails_category", "inbound_emails", ["category"])
    op.create_index("ix_inbound_emails_received_at", "inbound_emails", ["received_at"])
    op.create_index("ix_inbound_emails_from_address", "inbound_emails", ["from_address"])
    op.create_index("ix_inbound_emails_is_read", "inbound_emails", ["is_read"])


def downgrade() -> None:
    op.drop_index("ix_inbound_emails_is_read")
    op.drop_index("ix_inbound_emails_from_address")
    op.drop_index("ix_inbound_emails_received_at")
    op.drop_index("ix_inbound_emails_category")
    op.drop_table("inbound_emails")
