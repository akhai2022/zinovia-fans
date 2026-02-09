"""Posts and post_media tables.

Revision ID: 0003_posts_post_media
Revises: 0002_creators_follows
Create Date: Posts MVP (text/image, visibility, creator feed)

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_posts_post_media"
down_revision = "0002_creators_follows"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("visibility", sa.String(32), nullable=False),
        sa.Column("nsfw", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("type IN ('TEXT', 'IMAGE')", name="ck_posts_type"),
        sa.CheckConstraint(
            "visibility IN ('PUBLIC', 'FOLLOWERS', 'SUBSCRIBERS')",
            name="ck_posts_visibility",
        ),
    )
    op.create_index("ix_posts_creator_user_id_created_at", "posts", ["creator_user_id", "created_at"])
    op.create_index("ix_posts_visibility_created_at", "posts", ["visibility", "created_at"])

    op.create_table(
        "post_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id"), nullable=False),
        sa.Column("media_object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("media_objects.id"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_post_media_post_id", "post_media", ["post_id"])


def downgrade() -> None:
    op.drop_index("ix_post_media_post_id", table_name="post_media")
    op.drop_table("post_media")
    op.drop_index("ix_posts_visibility_created_at", table_name="posts")
    op.drop_index("ix_posts_creator_user_id_created_at", table_name="posts")
    op.drop_table("posts")
