"""Add blurhash and dominant_color to media_assets.

Revision ID: 0023_media_placeholders
Revises: 0022_stripe_to_ccbill
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0023_media_placeholders"
down_revision = "0022_stripe_to_ccbill"


def upgrade() -> None:
    op.add_column("media_assets", sa.Column("blurhash", sa.String(64), nullable=True))
    op.add_column("media_assets", sa.Column("dominant_color", sa.String(7), nullable=True))


def downgrade() -> None:
    op.drop_column("media_assets", "dominant_color")
    op.drop_column("media_assets", "blurhash")
