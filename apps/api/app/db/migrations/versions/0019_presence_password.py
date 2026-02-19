"""Add last_activity_at column to users for online presence.

Revision ID: 0019_presence_pw
Revises: 0018_post_ppv
Create Date: 2026-02-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0019_presence_pw"
down_revision = "0018_post_ppv"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_activity_at")
