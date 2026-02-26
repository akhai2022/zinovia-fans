"""Add payouts tables: creator_payout_settings, payouts, payout_items, payout_audit_logs.

Revision ID: 0033_payouts
Revises: 0032_contact_subs
Create Date: 2026-02-26
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0033_payouts"
down_revision = "0032_contact_subs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # creator_payout_settings
    op.create_table(
        "creator_payout_settings",
        sa.Column("creator_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("method", sa.String(16), nullable=False, server_default="sepa"),
        sa.Column("account_holder_name", sa.String(200), nullable=False),
        sa.Column("iban_encrypted", sa.Text, nullable=False),
        sa.Column("iban_last4", sa.String(4), nullable=False),
        sa.Column("bic_encrypted", sa.Text, nullable=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("billing_address_line1", sa.String(200), nullable=True),
        sa.Column("billing_address_line2", sa.String(200), nullable=True),
        sa.Column("billing_city", sa.String(100), nullable=True),
        sa.Column("billing_postal_code", sa.String(20), nullable=True),
        sa.Column("billing_region", sa.String(100), nullable=True),
        sa.Column("billing_country", sa.String(2), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('active', 'incomplete', 'disabled')", name="ck_payout_settings_status"),
    )

    # payouts
    op.create_table(
        "payouts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount_cents", sa.Integer, nullable=False),
        sa.Column("currency", sa.String(8), nullable=False, server_default="eur"),
        sa.Column("method", sa.String(16), nullable=False, server_default="sepa"),
        sa.Column("status", sa.String(16), nullable=False, server_default="queued"),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("export_batch_id", sa.String(64), nullable=True),
        sa.Column("bank_reference", sa.String(128), nullable=True),
        sa.Column("error_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('queued', 'exported', 'sent', 'failed', 'settled')",
            name="ck_payout_status",
        ),
        sa.UniqueConstraint("creator_id", "period_start", "period_end", name="uq_payout_creator_period"),
    )
    op.create_index("ix_payouts_creator_id", "payouts", ["creator_id"])
    op.create_index("ix_payouts_status", "payouts", ["status"])

    # payout_items
    op.create_table(
        "payout_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("payout_id", UUID(as_uuid=True), sa.ForeignKey("payouts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ledger_event_id", UUID(as_uuid=True), sa.ForeignKey("ledger_events.id"), nullable=False),
        sa.Column("amount_cents", sa.Integer, nullable=False),
        sa.UniqueConstraint("payout_id", "ledger_event_id", name="uq_payout_item_event"),
    )
    op.create_index("ix_payout_items_payout_id", "payout_items", ["payout_id"])

    # payout_audit_logs
    op.create_table(
        "payout_audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(64), nullable=False),
        sa.Column("entity_id", sa.String(128), nullable=False),
        sa.Column("details", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_payout_audit_logs_actor", "payout_audit_logs", ["actor_user_id"])


def downgrade() -> None:
    op.drop_index("ix_payout_audit_logs_actor", table_name="payout_audit_logs")
    op.drop_table("payout_audit_logs")
    op.drop_index("ix_payout_items_payout_id", table_name="payout_items")
    op.drop_table("payout_items")
    op.drop_index("ix_payouts_status", table_name="payouts")
    op.drop_index("ix_payouts_creator_id", table_name="payouts")
    op.drop_table("payouts")
    op.drop_table("creator_payout_settings")
