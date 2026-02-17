"""Add unique constraints to subscriptions, ledger_entries, ppv_purchases.

Revision ID: 0015_payment_unique_constraints
Revises: 0014_password_reset
Create Date: 2026-02-17
"""

from __future__ import annotations

from alembic import op

revision = "0015_payment_unique_constraints"
down_revision = "0014_password_reset"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Subscription: one row per fan-creator pair
    op.create_unique_constraint(
        "uq_subscription_fan_creator",
        "subscriptions",
        ["fan_user_id", "creator_user_id"],
    )
    # Ledger entry: one entry per account + reference (idempotency)
    op.create_unique_constraint(
        "uq_ledger_entry_account_reference",
        "ledger_entries",
        ["account_id", "reference"],
    )
    # PPV purchase: one purchase per purchaser + media item
    op.create_unique_constraint(
        "uq_ppv_purchase_purchaser_media",
        "ppv_purchases",
        ["purchaser_id", "message_media_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_ppv_purchase_purchaser_media", "ppv_purchases", type_="unique")
    op.drop_constraint("uq_ledger_entry_account_reference", "ledger_entries", type_="unique")
    op.drop_constraint("uq_subscription_fan_creator", "subscriptions", type_="unique")
