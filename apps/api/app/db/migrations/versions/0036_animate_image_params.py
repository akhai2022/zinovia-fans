"""Add JSONB params column to ai_tool_jobs for tool-specific config.

Revision ID: 0036_animate_image_params
Revises: 0035_post_status_removed
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0036_animate_image_params"
down_revision = "0035_post_status_removed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_tool_jobs", sa.Column("params", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("ai_tool_jobs", "params")
