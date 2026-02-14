"""Parity P0: messaging (DMs), tips, PPV unlocks, creator payout profile, ledger_events.

Revision ID: 0010_parity_p0
Revises: 0009_creator_onboarding
Create Date: 2026-02-07

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010_parity_p0"
down_revision = "0009_creator_onboarding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) conversations
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("fan_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_conversations_creator_fan", "conversations", ["creator_user_id", "fan_user_id"])
    op.create_index("ix_conversations_creator", "conversations", ["creator_user_id"])
    op.create_index("ix_conversations_fan", "conversations", ["fan_user_id"])

    # 2) messages
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("sender_role", sa.String(16), nullable=False),
        sa.Column("message_type", sa.String(16), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_messages_conversation_created", "messages", ["conversation_id", "created_at"])
    op.create_check_constraint("ck_messages_sender_role", "messages", "sender_role IN ('CREATOR', 'FAN')")
    op.create_check_constraint("ck_messages_type", "messages", "message_type IN ('TEXT', 'MEDIA', 'SYSTEM')")

    # 3) message_media
    op.create_table(
        "message_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("media_asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("media_assets.id"), nullable=False),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("price_cents", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(8), nullable=False, server_default="usd"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_message_media_message", "message_media", ["message_id"])
    op.create_check_constraint(
        "ck_message_media_locked_price",
        "message_media",
        "NOT is_locked OR (price_cents IS NOT NULL AND price_cents > 0)",
    )

    # 4) ppv_purchases
    op.create_table(
        "ppv_purchases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("purchaser_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("message_media_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("message_media.id", ondelete="CASCADE"), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_ppv_purchaser_media", "ppv_purchases", ["purchaser_id", "message_media_id"])
    op.create_index("ix_ppv_stripe_pi", "ppv_purchases", ["stripe_payment_intent_id"], unique=True)
    op.create_check_constraint(
        "ck_ppv_status",
        "ppv_purchases",
        "status IN ('REQUIRES_PAYMENT', 'SUCCEEDED', 'CANCELED', 'REFUNDED')",
    )

    # 5) tips
    op.create_table(
        "tips",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tipper_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tips_stripe_pi", "tips", ["stripe_payment_intent_id"], unique=True)
    op.create_check_constraint(
        "ck_tips_status",
        "tips",
        "status IN ('REQUIRES_PAYMENT', 'SUCCEEDED', 'CANCELED', 'REFUNDED')",
    )

    # 6) creator_payout_profile
    op.create_table(
        "creator_payout_profiles",
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("stripe_account_id", sa.String(255), nullable=True),
        sa.Column("payouts_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("charges_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("requirements_due", postgresql.JSONB(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 7) ledger_events (tips, ppv, subs - gross/fee/net)
    op.create_table(
        "ledger_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("gross_cents", sa.Integer(), nullable=False),
        sa.Column("fee_cents", sa.Integer(), nullable=False),
        sa.Column("net_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False),
        sa.Column("reference_type", sa.String(64), nullable=True),
        sa.Column("reference_id", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_ledger_events_creator_created", "ledger_events", ["creator_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_ledger_events_creator_created", table_name="ledger_events")
    op.drop_table("ledger_events")
    op.drop_table("creator_payout_profiles")
    op.drop_constraint("ck_tips_status", "tips", type_="check")
    op.drop_index("ix_tips_stripe_pi", table_name="tips")
    op.drop_table("tips")
    op.drop_constraint("ck_ppv_status", "ppv_purchases", type_="check")
    op.drop_index("ix_ppv_stripe_pi", table_name="ppv_purchases")
    op.drop_constraint("uq_ppv_purchaser_media", "ppv_purchases", type_="unique")
    op.drop_table("ppv_purchases")
    op.drop_constraint("ck_message_media_locked_price", "message_media", type_="check")
    op.drop_index("ix_message_media_message", table_name="message_media")
    op.drop_table("message_media")
    op.drop_constraint("ck_messages_type", "messages", type_="check")
    op.drop_constraint("ck_messages_sender_role", "messages", type_="check")
    op.drop_index("ix_messages_conversation_created", table_name="messages")
    op.drop_table("messages")
    op.drop_index("ix_conversations_fan", table_name="conversations")
    op.drop_index("ix_conversations_creator", table_name="conversations")
    op.drop_constraint("uq_conversations_creator_fan", "conversations", type_="unique")
    op.drop_table("conversations")
