"""Add AI safety tables: image_safety_scans, image_captions, image_tags + safety_status on media_assets.

Revision ID: 0028_ai_safety
Revises: 0027_gps_coords
"""

import logging

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

logger = logging.getLogger(__name__)

revision = "0028_ai_safety"
down_revision = "0027_gps_coords"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- pgvector extension (non-fatal if unavailable) ---
    conn = op.get_bind()
    conn.execute(sa.text("SAVEPOINT pgvector_ext"))
    try:
        conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.execute(sa.text("RELEASE SAVEPOINT pgvector_ext"))
        has_vector = True
        logger.info("pgvector extension available — vector columns will be created")
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT pgvector_ext"))
        has_vector = False
        logger.warning(
            "pgvector extension NOT available — semantic search will use JSONB fallback. "
            "To enable pgvector, run: CREATE EXTENSION vector; (requires rds_superuser on RDS)"
        )

    # --- safety_status column on media_assets ---
    op.add_column(
        "media_assets",
        sa.Column("safety_status", sa.String(16), nullable=True),
    )

    # --- image_safety_scans ---
    op.create_table(
        "image_safety_scans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "media_asset_id",
            UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("nsfw_score", sa.Float(), nullable=False),
        sa.Column("nsfw_label", sa.String(32), nullable=False),
        sa.Column("age_range_prediction", sa.String(32), nullable=False),
        sa.Column("underage_likelihood_proxy", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(16), nullable=False),
        sa.Column("decision", sa.String(16), nullable=False),
        sa.Column("model_versions", JSONB, nullable=True),
        sa.Column(
            "reviewed_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_decision", sa.String(16), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- image_captions ---
    op.create_table(
        "image_captions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "media_asset_id",
            UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("caption_short", sa.Text(), nullable=True),
        sa.Column("caption_medium", sa.Text(), nullable=True),
        sa.Column("caption_promo", sa.Text(), nullable=True),
        sa.Column("raw_caption", sa.Text(), nullable=True),
        sa.Column("model_version", sa.String(128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # --- image_tags ---
    columns = [
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "media_asset_id",
            UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("tags", JSONB, nullable=True),
        sa.Column("embedding_json", JSONB, nullable=True),
        sa.Column("model_version", sa.String(128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    ]
    op.create_table("image_tags", *columns)

    # Add pgvector embedding column only if extension is available
    if has_vector:
        op.execute(
            "ALTER TABLE image_tags ADD COLUMN embedding vector(384)"
        )


def downgrade() -> None:
    op.drop_table("image_tags")
    op.drop_table("image_captions")
    op.drop_table("image_safety_scans")
    op.drop_column("media_assets", "safety_status")
