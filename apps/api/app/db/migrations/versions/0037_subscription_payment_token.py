"""Add payment_token column to subscriptions for Worldline token-based recurring billing.

Revision ID: 0037_subscription_payment_token
Revises: 0036_animate_image_params
Create Date: 2026-03-09
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0037_subscription_payment_token"
down_revision = "0036_animate_image_params"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("subscriptions", sa.Column("payment_token", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("subscriptions", "payment_token")
