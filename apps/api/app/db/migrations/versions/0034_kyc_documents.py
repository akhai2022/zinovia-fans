"""Add KYC document storage columns to kyc_sessions.

Revision ID: 0034_kyc_documents
Revises: 0033_payouts
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0034_kyc_documents"
down_revision = "0033_payouts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("kyc_sessions", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column(
        "kyc_sessions",
        sa.Column("id_document_media_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "kyc_sessions",
        sa.Column("selfie_media_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column("kyc_sessions", sa.Column("admin_notes", sa.Text(), nullable=True))
    op.add_column(
        "kyc_sessions",
        sa.Column("reviewed_by", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "kyc_sessions",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_kyc_id_document_media",
        "kyc_sessions",
        "media_assets",
        ["id_document_media_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_kyc_selfie_media",
        "kyc_sessions",
        "media_assets",
        ["selfie_media_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_kyc_reviewed_by",
        "kyc_sessions",
        "users",
        ["reviewed_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_kyc_reviewed_by", "kyc_sessions", type_="foreignkey")
    op.drop_constraint("fk_kyc_selfie_media", "kyc_sessions", type_="foreignkey")
    op.drop_constraint("fk_kyc_id_document_media", "kyc_sessions", type_="foreignkey")
    op.drop_column("kyc_sessions", "reviewed_at")
    op.drop_column("kyc_sessions", "reviewed_by")
    op.drop_column("kyc_sessions", "admin_notes")
    op.drop_column("kyc_sessions", "selfie_media_id")
    op.drop_column("kyc_sessions", "id_document_media_id")
    op.drop_column("kyc_sessions", "date_of_birth")
