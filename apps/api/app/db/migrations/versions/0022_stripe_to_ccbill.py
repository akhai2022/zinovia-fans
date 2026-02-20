"""Migrate from Stripe to CCBill: rename tables/columns, drop Stripe-only fields.

Revision ID: 0022_stripe_to_ccbill
Revises: 0021_phone
Create Date: 2026-02-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0022_stripe_to_ccbill"
down_revision = "0021_phone"


def upgrade() -> None:
    # --- 1. stripe_events → payment_events ---
    op.rename_table("stripe_events", "payment_events")
    # Rename the unique index
    op.drop_index("ux_stripe_event_id", table_name="payment_events")
    op.create_index("ux_payment_event_id", "payment_events", ["event_id"], unique=True)

    # --- 2. creator_plans: drop Stripe columns ---
    op.drop_column("creator_plans", "stripe_price_id")
    op.drop_column("creator_plans", "stripe_product_id")

    # --- 3. subscriptions: stripe_subscription_id → ccbill_subscription_id, drop stripe_customer_id ---
    op.drop_index("ix_subscriptions_stripe_sub_id", table_name="subscriptions")
    op.alter_column(
        "subscriptions",
        "stripe_subscription_id",
        new_column_name="ccbill_subscription_id",
    )
    op.create_index(
        "ix_subscriptions_ccbill_sub_id",
        "subscriptions",
        ["ccbill_subscription_id"],
        unique=True,
    )
    op.drop_column("subscriptions", "stripe_customer_id")

    # --- 4. tips: stripe_payment_intent_id → ccbill_transaction_id (nullable) ---
    op.drop_index("ix_tips_stripe_pi", table_name="tips")
    op.alter_column(
        "tips",
        "stripe_payment_intent_id",
        new_column_name="ccbill_transaction_id",
        nullable=True,
    )
    op.create_index(
        "ix_tips_ccbill_txn",
        "tips",
        ["ccbill_transaction_id"],
        unique=False,
    )

    # --- 5. ppv_purchases: stripe_payment_intent_id → ccbill_transaction_id (nullable), drop stripe_charge_id ---
    op.drop_index("ix_ppv_stripe_pi", table_name="ppv_purchases")
    # Drop stripe_charge_id unique constraint if exists (added in migration 0013)
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT conname FROM pg_constraint WHERE conname = 'uq_ppv_purchases_stripe_charge_id'"
    ))
    if result.fetchone():
        op.drop_constraint("uq_ppv_purchases_stripe_charge_id", "ppv_purchases", type_="unique")
    op.alter_column(
        "ppv_purchases",
        "stripe_payment_intent_id",
        new_column_name="ccbill_transaction_id",
        nullable=True,
    )
    # Drop stripe_charge_id column if it exists
    result2 = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'ppv_purchases' AND column_name = 'stripe_charge_id'"
    ))
    if result2.fetchone():
        op.drop_column("ppv_purchases", "stripe_charge_id")
    op.create_index(
        "ix_ppv_ccbill_txn",
        "ppv_purchases",
        ["ccbill_transaction_id"],
        unique=False,
    )

    # --- 6. post_purchases: stripe_payment_intent_id → ccbill_transaction_id (nullable), drop stripe_charge_id ---
    op.alter_column(
        "post_purchases",
        "stripe_payment_intent_id",
        new_column_name="ccbill_transaction_id",
        nullable=True,
    )
    result3 = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'post_purchases' AND column_name = 'stripe_charge_id'"
    ))
    if result3.fetchone():
        op.drop_column("post_purchases", "stripe_charge_id")
    op.create_index(
        "ix_post_purchases_ccbill_txn",
        "post_purchases",
        ["ccbill_transaction_id"],
        unique=False,
    )

    # --- 7. Drop creator_payout_profiles table (Stripe Connect, no longer needed) ---
    result4 = conn.execute(sa.text(
        "SELECT tablename FROM pg_tables WHERE tablename = 'creator_payout_profiles'"
    ))
    if result4.fetchone():
        op.drop_table("creator_payout_profiles")


def downgrade() -> None:
    # Reverse in opposite order

    # 7. Recreate creator_payout_profiles (stub — data is lost)
    op.create_table(
        "creator_payout_profiles",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("stripe_account_id", sa.String(255), nullable=True),
        sa.Column("payouts_enabled", sa.Boolean(), server_default="false"),
        sa.Column("charges_enabled", sa.Boolean(), server_default="false"),
        sa.Column("requirements_due", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 6. post_purchases: ccbill_transaction_id → stripe_payment_intent_id
    op.drop_index("ix_post_purchases_ccbill_txn", table_name="post_purchases")
    op.add_column("post_purchases", sa.Column("stripe_charge_id", sa.String(255), nullable=True))
    op.alter_column(
        "post_purchases",
        "ccbill_transaction_id",
        new_column_name="stripe_payment_intent_id",
        nullable=False,
    )

    # 5. ppv_purchases
    op.drop_index("ix_ppv_ccbill_txn", table_name="ppv_purchases")
    op.add_column("ppv_purchases", sa.Column("stripe_charge_id", sa.String(255), nullable=True))
    op.alter_column(
        "ppv_purchases",
        "ccbill_transaction_id",
        new_column_name="stripe_payment_intent_id",
        nullable=False,
    )
    op.create_index("ix_ppv_stripe_pi", "ppv_purchases", ["stripe_payment_intent_id"], unique=True)

    # 4. tips
    op.drop_index("ix_tips_ccbill_txn", table_name="tips")
    op.alter_column(
        "tips",
        "ccbill_transaction_id",
        new_column_name="stripe_payment_intent_id",
        nullable=False,
    )
    op.create_index("ix_tips_stripe_pi", "tips", ["stripe_payment_intent_id"], unique=True)

    # 3. subscriptions
    op.drop_index("ix_subscriptions_ccbill_sub_id", table_name="subscriptions")
    op.add_column("subscriptions", sa.Column("stripe_customer_id", sa.String(255), nullable=True))
    op.alter_column(
        "subscriptions",
        "ccbill_subscription_id",
        new_column_name="stripe_subscription_id",
    )
    op.create_index("ix_subscriptions_stripe_sub_id", "subscriptions", ["stripe_subscription_id"], unique=True)

    # 2. creator_plans
    op.add_column("creator_plans", sa.Column("stripe_product_id", sa.String(255), nullable=True))
    op.add_column("creator_plans", sa.Column("stripe_price_id", sa.String(255), nullable=True))

    # 1. payment_events → stripe_events
    op.drop_index("ux_payment_event_id", table_name="payment_events")
    op.rename_table("payment_events", "stripe_events")
    op.create_index("ux_stripe_event_id", "stripe_events", ["event_id"], unique=True)
