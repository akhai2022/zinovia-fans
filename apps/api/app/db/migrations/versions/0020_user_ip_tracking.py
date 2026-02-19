"""Add IP tracking columns to users table for audit.

Revision ID: 0020_user_ip
Revises: 0019_presence_pw
Create Date: 2026-02-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0020_user_ip"
down_revision = "0019_presence_pw"


def upgrade() -> None:
    op.add_column("users", sa.Column("signup_ip", sa.String(45), nullable=True))
    op.add_column("users", sa.Column("last_login_ip", sa.String(45), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_login_ip")
    op.drop_column("users", "signup_ip")
