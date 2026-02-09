"""Creator profiles and follows.

Revision ID: 0002_creator_profiles_and_follows
Revises: 0001_initial
Create Date: Creator profiles extension and follows table

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_creators_follows"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column("handle", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "profiles",
        sa.Column("handle_normalized", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "profiles",
        sa.Column("bio", sa.Text(), nullable=True),
    )
    op.add_column(
        "profiles",
        sa.Column(
            "avatar_media_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("media_objects.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "profiles",
        sa.Column(
            "banner_media_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("media_objects.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "profiles",
        sa.Column("discoverable", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "profiles",
        sa.Column("nsfw", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_profiles_handle_normalized", "profiles", ["handle_normalized"], unique=True)
    op.create_index("ix_profiles_handle", "profiles", ["handle"])

    op.create_table(
        "follows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("fan_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("creator_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_follows_creator_user_id_created_at", "follows", ["creator_user_id", "created_at"])
    op.create_index("ix_follows_fan_user_id_created_at", "follows", ["fan_user_id", "created_at"])
    op.create_unique_constraint(
        "uq_follows_fan_creator",
        "follows",
        ["fan_user_id", "creator_user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_follows_fan_creator", "follows", type_="unique")
    op.drop_index("ix_follows_fan_user_id_created_at", table_name="follows")
    op.drop_index("ix_follows_creator_user_id_created_at", table_name="follows")
    op.drop_table("follows")
    op.drop_index("ix_profiles_handle", table_name="profiles")
    op.drop_index("ix_profiles_handle_normalized", table_name="profiles")
    op.drop_column("profiles", "nsfw")
    op.drop_column("profiles", "discoverable")
    op.drop_column("profiles", "banner_media_id")
    op.drop_column("profiles", "avatar_media_id")
    op.drop_column("profiles", "bio")
    op.drop_column("profiles", "handle_normalized")
    op.drop_column("profiles", "handle")
