"""Creator onboarding skeleton: users onboarding state, audit, idempotency, KYC.

Revision ID: 0009_creator_onboarding
Revises: 0008_posts_type_video
Create Date: Feature 1 - Creator Onboarding Skeleton

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009_creator_onboarding"
down_revision = "0008_posts_type_video"
branch_labels = None
depends_on = None

ONBOARDING_STATES = (
    "CREATED",
    "EMAIL_VERIFIED",
    "KYC_PENDING",
    "KYC_SUBMITTED",
    "KYC_APPROVED",
    "KYC_REJECTED",
)


def upgrade() -> None:
    # Add onboarding columns to users (creator = user with role=creator)
    op.add_column(
        "users",
        sa.Column(
            "onboarding_state",
            sa.String(32),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column("country", sa.String(2), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("explicit_intent", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "explicit_intent_locked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_check_constraint(
        "ck_users_onboarding_state",
        "users",
        f"onboarding_state IS NULL OR onboarding_state IN ({', '.join(repr(s) for s in ONBOARDING_STATES)})",
    )

    # Email verification tokens (MVP: no email sending; token created server-side)
    op.create_table(
        "email_verification_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_email_verification_tokens_token", "email_verification_tokens", ["token"], unique=True)

    # Append-only audit trail for state transitions
    op.create_table(
        "onboarding_audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("from_state", sa.String(32), nullable=True),
        sa.Column("to_state", sa.String(32), nullable=True),
        sa.Column("payload_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_onboarding_audit_events_creator_id", "onboarding_audit_events", ["creator_id"])

    # Idempotency keys for POST endpoints
    op.create_table(
        "idempotency_keys",
        sa.Column("key", sa.String(255), primary_key=True),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("endpoint", sa.String(128), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("response_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_idempotency_keys_expires_at", "idempotency_keys", ["expires_at"])

    # KYC sessions
    op.create_table(
        "kyc_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_session_id", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
        ),
        sa.Column("redirect_url", sa.Text(), nullable=True),
        sa.Column("raw_webhook_payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_check_constraint(
        "ck_kyc_sessions_status",
        "kyc_sessions",
        "status IN ('CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED')",
    )
    op.create_index("ix_kyc_sessions_creator_id", "kyc_sessions", ["creator_id"])
    op.create_index("ix_kyc_sessions_provider_session_id", "kyc_sessions", ["provider_session_id"])


def downgrade() -> None:
    op.drop_index("ix_kyc_sessions_provider_session_id", table_name="kyc_sessions")
    op.drop_index("ix_kyc_sessions_creator_id", table_name="kyc_sessions")
    op.drop_constraint("ck_kyc_sessions_status", "kyc_sessions", type_="check")
    op.drop_table("kyc_sessions")
    op.drop_index("ix_idempotency_keys_expires_at", table_name="idempotency_keys")
    op.drop_table("idempotency_keys")
    op.drop_index("ix_onboarding_audit_events_creator_id", table_name="onboarding_audit_events")
    op.drop_table("onboarding_audit_events")
    op.drop_index("ix_email_verification_tokens_token", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_constraint("ck_users_onboarding_state", "users", type_="check")
    op.drop_column("users", "explicit_intent_locked")
    op.drop_column("users", "explicit_intent")
    op.drop_column("users", "country")
    op.drop_column("users", "onboarding_state")
