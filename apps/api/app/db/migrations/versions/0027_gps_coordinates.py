"""Add GPS latitude/longitude columns to users.

Revision ID: 0027_gps_coords
Revises: 0026_device_info
"""

from alembic import op
import sqlalchemy as sa

revision = "0027_gps_coords"
down_revision = "0026_device_info"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "longitude")
    op.drop_column("users", "latitude")
