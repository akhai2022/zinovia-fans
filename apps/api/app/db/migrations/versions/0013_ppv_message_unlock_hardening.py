"""PPV message unlock hardening.

Revision ID: 0013_ppv_unlock_hardening
Revises: 0012_phase1_engagement
Create Date: 2026-02-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0013_ppv_unlock_hardening"
down_revision = "0012_phase1_engagement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ppv_purchases",
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "ppv_purchases",
        sa.Column("stripe_charge_id", sa.String(length=255), nullable=True),
    )

    op.execute(
        sa.text(
            """
            UPDATE ppv_purchases p
            SET creator_id = c.creator_user_id
            FROM conversations c
            WHERE c.id = p.conversation_id
              AND p.creator_id IS NULL
            """
        )
    )
    op.alter_column("ppv_purchases", "creator_id", nullable=False)
    op.create_foreign_key(
        "fk_ppv_purchases_creator_id_users",
        "ppv_purchases",
        "users",
        ["creator_id"],
        ["id"],
    )
    op.create_unique_constraint(
        "uq_ppv_purchases_stripe_charge_id",
        "ppv_purchases",
        ["stripe_charge_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_ppv_purchases_stripe_charge_id", "ppv_purchases", type_="unique")
    op.drop_constraint("fk_ppv_purchases_creator_id_users", "ppv_purchases", type_="foreignkey")
    op.drop_column("ppv_purchases", "stripe_charge_id")
    op.drop_column("ppv_purchases", "creator_id")

