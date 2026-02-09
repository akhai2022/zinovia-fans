"""Media derived assets (variants: thumb, grid, full).

Revision ID: 0007_media_derived_assets
Revises: 0006_billing_webhook_metadata
Create Date: Derived image variants with optional watermark; originals unchanged.

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0007_media_derived_assets"
down_revision = "0006_billing_webhook_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_derived_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("parent_asset_id", sa.Uuid(), sa.ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant", sa.String(length=32), nullable=False),
        sa.Column("object_key", sa.String(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "ix_media_derived_assets_parent_variant",
        "media_derived_assets",
        ["parent_asset_id", "variant"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_media_derived_assets_parent_variant", table_name="media_derived_assets")
    op.drop_table("media_derived_assets")
