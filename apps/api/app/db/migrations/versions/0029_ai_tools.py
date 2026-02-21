"""Add AI tools tables: post_promo_suggestions + post_translations.

Revision ID: 0029_ai_tools
Revises: 0028_ai_safety
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0029_ai_tools"
down_revision = "0028_ai_safety"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- post_promo_suggestions ---
    op.create_table(
        "post_promo_suggestions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "post_id",
            UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tone", sa.String(16), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("cta_lines", JSONB, nullable=False),
        sa.Column("hashtags", JSONB, nullable=False),
        sa.Column("source_caption", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("post_id", "tone", name="uq_promo_post_tone"),
    )

    # --- post_translations ---
    op.create_table(
        "post_translations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "post_id",
            UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_text", sa.Text(), nullable=False),
        sa.Column("source_language", sa.String(8), nullable=False, server_default="en"),
        sa.Column("target_language", sa.String(8), nullable=False),
        sa.Column("translated_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("post_id", "target_language", name="uq_translation_post_lang"),
    )


def downgrade() -> None:
    op.drop_table("post_translations")
    op.drop_table("post_promo_suggestions")
