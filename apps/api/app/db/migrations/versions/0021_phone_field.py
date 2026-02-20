"""Add phone column to users table for creator KYC.

Revision ID: 0021_phone
Revises: 0020_user_ip
Create Date: 2026-02-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0021_phone"
down_revision = "0020_user_ip"


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "phone")
