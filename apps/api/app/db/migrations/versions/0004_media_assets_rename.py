"""Rename media_objects to media_assets; align profile and post_media FKs.

Revision ID: 0004_media_assets
Revises: 0003_posts_post_media
Create Date: Standardize on media_assets table and asset_id column names

"""
from __future__ import annotations

from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_media_assets"
down_revision = "0003_posts_post_media"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename table media_objects -> media_assets
    op.rename_table("media_objects", "media_assets")

    # Rename index (unique on object_key)
    op.execute("ALTER INDEX ux_media_object_key RENAME TO ux_media_assets_object_key")

    # Profiles: rename columns and drop/add FK (FK name changes with table)
    op.drop_constraint(
        "profiles_avatar_media_id_fkey",
        "profiles",
        type_="foreignkey",
    )
    op.drop_constraint(
        "profiles_banner_media_id_fkey",
        "profiles",
        type_="foreignkey",
    )
    op.alter_column(
        "profiles",
        "avatar_media_id",
        new_column_name="avatar_asset_id",
    )
    op.alter_column(
        "profiles",
        "banner_media_id",
        new_column_name="banner_asset_id",
    )
    op.create_foreign_key(
        "profiles_avatar_asset_id_fkey",
        "profiles",
        "media_assets",
        ["avatar_asset_id"],
        ["id"],
    )
    op.create_foreign_key(
        "profiles_banner_asset_id_fkey",
        "profiles",
        "media_assets",
        ["banner_asset_id"],
        ["id"],
    )

    # post_media: rename column and FK
    op.drop_constraint(
        "post_media_media_object_id_fkey",
        "post_media",
        type_="foreignkey",
    )
    op.alter_column(
        "post_media",
        "media_object_id",
        new_column_name="media_asset_id",
    )
    op.create_foreign_key(
        "post_media_media_asset_id_fkey",
        "post_media",
        "media_assets",
        ["media_asset_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("post_media_media_asset_id_fkey", "post_media", type_="foreignkey")
    op.alter_column(
        "post_media",
        "media_asset_id",
        new_column_name="media_object_id",
    )
    op.create_foreign_key(
        "post_media_media_object_id_fkey",
        "post_media",
        "media_assets",
        ["media_object_id"],
        ["id"],
    )

    op.drop_constraint("profiles_avatar_asset_id_fkey", "profiles", type_="foreignkey")
    op.drop_constraint("profiles_banner_asset_id_fkey", "profiles", type_="foreignkey")
    op.alter_column("profiles", "avatar_asset_id", new_column_name="avatar_media_id")
    op.alter_column("profiles", "banner_asset_id", new_column_name="banner_media_id")
    op.create_foreign_key(
        "profiles_avatar_media_id_fkey",
        "profiles",
        "media_assets",
        ["avatar_media_id"],
        ["id"],
    )
    op.create_foreign_key(
        "profiles_banner_media_id_fkey",
        "profiles",
        "media_assets",
        ["banner_media_id"],
        ["id"],
    )

    op.rename_table("media_assets", "media_objects")
    op.execute("ALTER INDEX ux_media_assets_object_key RENAME TO ux_media_object_key")
