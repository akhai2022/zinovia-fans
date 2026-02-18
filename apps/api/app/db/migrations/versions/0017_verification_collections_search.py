"""Add verified badge, collections, and post search index.

Revision ID: 0017_verification_collections_search
Revises: 0016_audit_events
Create Date: 2026-02-18
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0017_verification_collections_search"
down_revision = "0016_audit_events"


def upgrade() -> None:
    # 1. Creator verification badge
    op.add_column("profiles", sa.Column("verified", sa.Boolean(), nullable=False, server_default="false"))

    # 2. Collections / playlists
    op.create_table(
        "collections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_asset_id", UUID(as_uuid=True), sa.ForeignKey("media_assets.id"), nullable=True),
        sa.Column("visibility", sa.String(32), nullable=False, server_default="PUBLIC"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_collections_creator", "collections", ["creator_user_id"])

    op.create_table(
        "collection_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("collection_id", UUID(as_uuid=True), sa.ForeignKey("collections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("post_id", UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("collection_id", "post_id", name="uq_collection_post"),
    )

    # 3. Full-text search index on posts.caption using GIN trigram
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE INDEX ix_posts_caption_trgm ON posts USING gin (caption gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_posts_caption_trgm")
    op.drop_table("collection_posts")
    op.drop_table("collections")
    op.drop_column("profiles", "verified")
