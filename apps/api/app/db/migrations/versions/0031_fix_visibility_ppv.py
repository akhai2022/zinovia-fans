"""Add PPV to ck_posts_visibility check constraint.

Revision ID: 0031_fix_vis_ppv
Revises: 0030_ai_tool_jobs
Create Date: 2026-02-26

The original migration 0003 created ck_posts_visibility with only
(PUBLIC, FOLLOWERS, SUBSCRIBERS). When PPV was added later, the
constraint was never updated — causing CheckViolationError on PPV posts.
"""
from __future__ import annotations

from alembic import op

revision = "0031_fix_vis_ppv"
down_revision = "0030_ai_tool_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_posts_visibility", "posts", type_="check")
    op.create_check_constraint(
        "ck_posts_visibility",
        "posts",
        "visibility IN ('PUBLIC', 'FOLLOWERS', 'SUBSCRIBERS', 'PPV')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_posts_visibility", "posts", type_="check")
    op.create_check_constraint(
        "ck_posts_visibility",
        "posts",
        "visibility IN ('PUBLIC', 'FOLLOWERS', 'SUBSCRIBERS')",
    )
