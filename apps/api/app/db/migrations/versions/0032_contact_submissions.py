"""Add contact_submissions table to store support messages in DB.

Revision ID: 0032_contact_subs
Revises: 0031_fix_vis_ppv
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0032_contact_subs"
down_revision = "0031_fix_vis_ppv"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contact_submissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_contact_submissions_created_at", "contact_submissions", ["created_at"])
    op.create_index("ix_contact_submissions_category", "contact_submissions", ["category"])


def downgrade() -> None:
    op.drop_index("ix_contact_submissions_category", table_name="contact_submissions")
    op.drop_index("ix_contact_submissions_created_at", table_name="contact_submissions")
    op.drop_table("contact_submissions")
