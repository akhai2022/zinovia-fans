"""Add post-level PPV: price_cents/currency on posts + post_purchases table.

Revision ID: 0018_post_ppv
Revises: 0017_verified_collections
Create Date: 2026-02-18
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0018_post_ppv"
down_revision = "0017_verified_collections"


def upgrade() -> None:
    # Add price fields to posts table (nullable — only set for PPV posts)
    op.add_column("posts", sa.Column("price_cents", sa.Integer(), nullable=True))
    op.add_column("posts", sa.Column("currency", sa.String(8), nullable=True))

    # CHECK: PPV posts must have a positive price
    op.create_check_constraint(
        "ck_posts_ppv_price",
        "posts",
        "visibility != 'PPV' OR (price_cents IS NOT NULL AND price_cents > 0)",
    )

    # Post purchases table (tracks who bought which PPV post)
    op.create_table(
        "post_purchases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("purchaser_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("creator_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("post_id", UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=False),
        sa.Column("stripe_charge_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("purchaser_id", "post_id", name="uq_post_purchase_purchaser_post"),
    )
    op.create_index("ix_post_purchases_post_id", "post_purchases", ["post_id"])
    op.create_index("ix_post_purchases_purchaser_id", "post_purchases", ["purchaser_id"])


def downgrade() -> None:
    op.drop_index("ix_post_purchases_purchaser_id", table_name="post_purchases")
    op.drop_index("ix_post_purchases_post_id", table_name="post_purchases")
    op.drop_table("post_purchases")
    op.drop_constraint("ck_posts_ppv_price", "posts", type_="check")
    op.drop_column("posts", "currency")
    op.drop_column("posts", "price_cents")
