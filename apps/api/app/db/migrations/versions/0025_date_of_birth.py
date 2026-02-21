"""Add date_of_birth column to users table for age verification.

Revision ID: 0025_date_of_birth
Revises: 0024_inbound_emails
Create Date: 2026-02-21
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0025_date_of_birth"
down_revision = "0024_inbound_emails"


def upgrade() -> None:
    op.add_column("users", sa.Column("date_of_birth", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "date_of_birth")
