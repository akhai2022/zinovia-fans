"""Add password_reset_token and password_reset_expires columns to users.

Revision ID: 0014_password_reset
Revises: 0013_ppv_unlock_hardening
Create Date: 2026-02-14
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0014_password_reset"
down_revision = "0013_ppv_unlock_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_reset_token", sa.String(128), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "password_reset_expires",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "password_reset_expires")
    op.drop_column("users", "password_reset_token")
