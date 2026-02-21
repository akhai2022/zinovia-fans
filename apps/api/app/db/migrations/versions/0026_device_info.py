"""Add device info columns and promote super_admin.

Revision ID: 0026_device_info
Revises: 0025_date_of_birth
"""

from alembic import op
import sqlalchemy as sa

revision = "0026_device_info"
down_revision = "0025_date_of_birth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("user_agent", sa.String(512), nullable=True))
    op.add_column("users", sa.Column("device_type", sa.String(16), nullable=True))
    op.add_column("users", sa.Column("os_name", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("browser_name", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("screen_width", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("screen_height", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("timezone", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("language", sa.String(16), nullable=True))
    op.add_column("users", sa.Column("camera_available", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("microphone_available", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("connection_type", sa.String(16), nullable=True))

    # Promote super admin
    op.execute("UPDATE users SET role = 'super_admin' WHERE email = 'a.khai@outlook.fr'")


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'super_admin'")
    op.drop_column("users", "connection_type")
    op.drop_column("users", "microphone_available")
    op.drop_column("users", "camera_available")
    op.drop_column("users", "language")
    op.drop_column("users", "timezone")
    op.drop_column("users", "screen_height")
    op.drop_column("users", "screen_width")
    op.drop_column("users", "browser_name")
    op.drop_column("users", "os_name")
    op.drop_column("users", "device_type")
    op.drop_column("users", "user_agent")
