"""Billing: current_period_end, cancel_at_period_end, stripe_product_id, webhook payload.

Revision ID: 0006_billing_webhook_metadata
Revises: 0005_creator_plan_subscriptions
Create Date: Subscription period fields and stripe_events metadata for idempotency/audit.

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006_billing_webhook_metadata"
down_revision = "0005_creator_plan_subscriptions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "creator_plans",
        sa.Column("stripe_product_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "stripe_events",
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.add_column(
        "stripe_events",
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "stripe_events",
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("stripe_events", "processed_at")
    op.drop_column("stripe_events", "payload")
    op.drop_column("stripe_events", "received_at")
    op.drop_column("subscriptions", "cancel_at_period_end")
    op.drop_column("subscriptions", "current_period_end")
    op.drop_column("creator_plans", "stripe_product_id")
