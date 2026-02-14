"""Phase 1 engagement and retention primitives.

Revision ID: 0012_phase1_engagement
Revises: 0011_ai_images_brand
Create Date: 2026-02-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0012_phase1_engagement"
down_revision = "0011_ai_images_brand"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("publish_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "posts",
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PUBLISHED"),
    )
    op.create_check_constraint(
        "ck_posts_status",
        "posts",
        "status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED')",
    )
    op.create_index("ix_posts_status_publish_at", "posts", ["status", "publish_at"])

    op.create_table(
        "post_likes",
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_post_likes_post_id_created_at", "post_likes", ["post_id", "created_at"])

    op.create_table(
        "post_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_post_comments_post_id_created_at", "post_comments", ["post_id", "created_at"])

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_created_at", "notifications", ["user_id", "created_at"])
    op.create_index("ix_notifications_user_read_at", "notifications", ["user_id", "read_at"])


def downgrade() -> None:
    op.drop_index("ix_notifications_user_read_at", table_name="notifications")
    op.drop_index("ix_notifications_user_created_at", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_post_comments_post_id_created_at", table_name="post_comments")
    op.drop_table("post_comments")

    op.drop_index("ix_post_likes_post_id_created_at", table_name="post_likes")
    op.drop_table("post_likes")

    op.drop_index("ix_posts_status_publish_at", table_name="posts")
    op.drop_constraint("ck_posts_status", "posts", type_="check")
    op.drop_column("posts", "status")
    op.drop_column("posts", "publish_at")

