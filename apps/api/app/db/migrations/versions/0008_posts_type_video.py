"""Add VIDEO to post type.

Revision ID: 0008_posts_type_video
Revises: 0007_media_derived_assets
Create Date: MVP video upload (MP4) support

"""
from __future__ import annotations

from alembic import op

revision = "0008_posts_type_video"
down_revision = "0007_media_derived_assets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_posts_type", "posts", type_="check")
    op.create_check_constraint(
        "ck_posts_type",
        "posts",
        "type IN ('TEXT', 'IMAGE', 'VIDEO')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_posts_type", "posts", type_="check")
    op.create_check_constraint(
        "ck_posts_type",
        "posts",
        "type IN ('TEXT', 'IMAGE')",
    )
