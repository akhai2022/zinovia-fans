"""Creator plan and subscriptions (Stripe).

Revision ID: 0005_creator_plan_subscriptions
Revises: 0004_media_assets
Create Date: Creator plans and fan subscriptions with Stripe ids

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_creator_plan_subscriptions"
down_revision = "0004_media_assets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "creator_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("price", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("stripe_price_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_creator_plans_creator_user_id", "creator_plans", ["creator_user_id"], unique=True)

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("fan_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("creator_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("renew_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_customer_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_subscriptions_fan_creator", "subscriptions", ["fan_user_id", "creator_user_id"], unique=True)
    op.create_index("ix_subscriptions_stripe_sub_id", "subscriptions", ["stripe_subscription_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_subscriptions_stripe_sub_id", table_name="subscriptions")
    op.drop_index("ix_subscriptions_fan_creator", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_index("ix_creator_plans_creator_user_id", table_name="creator_plans")
    op.drop_table("creator_plans")
