"""AI image jobs and brand assets.

Revision ID: 0011_ai_images_brand
Revises: 0010_parity_p0
Create Date: 2026-02-13

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011_ai_images_brand"
down_revision = "0010_parity_p0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_image_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="QUEUED"),
        sa.Column("image_type", sa.String(32), nullable=False),
        sa.Column("preset", sa.String(64), nullable=True),
        sa.Column("subject", sa.String(256), nullable=True),
        sa.Column("vibe", sa.String(64), nullable=True),
        sa.Column("accent_color", sa.String(32), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("negative_prompt", sa.Text(), nullable=True),
        sa.Column("result_object_keys", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_ai_image_jobs_user_id", "ai_image_jobs", ["user_id"])
    op.create_index("ix_ai_image_jobs_status", "ai_image_jobs", ["status"])
    op.create_check_constraint(
        "ck_ai_image_jobs_status",
        "ai_image_jobs",
        "status IN ('QUEUED', 'GENERATING', 'READY', 'FAILED')",
    )
    op.create_check_constraint(
        "ck_ai_image_jobs_image_type",
        "ai_image_jobs",
        "image_type IN ('HERO', 'AVATAR', 'BANNER')",
    )

    op.create_table(
        "brand_assets",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value_object_key", sa.String(512), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_brand_assets_key", "brand_assets", ["key"])

    op.execute(
        sa.text(
            "INSERT INTO brand_assets (key, value_object_key, updated_at) "
            "VALUES ('landing.hero', NULL, NOW())"
        )
    )


def downgrade() -> None:
    op.drop_table("brand_assets")
    op.drop_constraint("ck_ai_image_jobs_image_type", "ai_image_jobs", type_="check")
    op.drop_constraint("ck_ai_image_jobs_status", "ai_image_jobs", type_="check")
    op.drop_index("ix_ai_image_jobs_status", table_name="ai_image_jobs")
    op.drop_index("ix_ai_image_jobs_user_id", table_name="ai_image_jobs")
    op.drop_table("ai_image_jobs")
