"""Add motion_transfer support to ai_tool_jobs.

Adds indexes for monthly quota counting and extends the tool column
to support the new 'motion_transfer' tool type. No schema changes
to ai_tool_jobs needed — the existing JSONB `params` column stores
all motion-transfer-specific settings.

Revision ID: 0038
Revises: 0037
"""

from alembic import op
import sqlalchemy as sa


revision = "0038_motion_transfer"
down_revision = "0037_subscription_payment_token"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite index for monthly quota counting:
    # SELECT count(*) FROM ai_tool_jobs WHERE user_id=? AND tool='motion_transfer' AND created_at>=?
    op.create_index(
        "ix_ai_tool_jobs_user_tool_created",
        "ai_tool_jobs",
        ["user_id", "tool", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_tool_jobs_user_tool_created", table_name="ai_tool_jobs")
