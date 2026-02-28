"""Add REMOVED to posts status check constraint for admin moderation.

Revision ID: 0035_post_status_removed
Revises: 0034_kyc_documents
"""

from alembic import op

revision = "0035_post_status_removed"
down_revision = "0034_kyc_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_posts_status", "posts", type_="check")
    op.create_check_constraint(
        "ck_posts_status",
        "posts",
        "status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'REMOVED')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_posts_status", "posts", type_="check")
    op.create_check_constraint(
        "ck_posts_status",
        "posts",
        "status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED')",
    )
