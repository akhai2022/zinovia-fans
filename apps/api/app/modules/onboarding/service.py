"""Onboarding business logic: state machine, audit, idempotency."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.modules.auth.models import User
from app.modules.onboarding.constants import (
    ALLOWED_TRANSITIONS,
    EMAIL_VERIFIED,
)
from app.modules.onboarding.models import (
    EmailVerificationToken,
    IdempotencyKey,
    KycSession,
    OnboardingAuditEvent,
)


def _hash_request(body: bytes | str) -> str:
    if isinstance(body, str):
        body = body.encode("utf-8")
    return hashlib.sha256(body).hexdigest()


def verify_webhook_hmac(payload: bytes, signature: str) -> bool:
    secret = get_settings().kyc_webhook_hmac_secret.encode("utf-8")
    expected = hmac.new(secret, payload, "sha256").hexdigest()
    return hmac.compare_digest(expected, signature)


async def create_email_verification_token(
    session: AsyncSession, user_id: UUID
) -> str:
    # Invalidate any existing tokens for this user before creating a new one
    await session.execute(
        delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
    )
    token = secrets.token_urlsafe(48)
    expires = datetime.now(UTC) + timedelta(hours=24)
    evt = EmailVerificationToken(
        user_id=user_id,
        token=token,
        expires_at=expires,
    )
    session.add(evt)
    await session.commit()
    return token


async def consume_email_verification_token(
    session: AsyncSession, token: str
) -> User | None:
    result = await session.execute(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.token == token)
        .where(EmailVerificationToken.expires_at > datetime.now(UTC))
    )
    evt = result.scalar_one_or_none()
    if not evt:
        return None
    user_result = await session.execute(select(User).where(User.id == evt.user_id))
    user = user_result.scalar_one()
    await session.delete(evt)
    await session.commit()
    return user


async def transition_creator_state(
    session: AsyncSession,
    creator_id: UUID,
    to_state: str,
    event_type: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Validate and apply state transition; write audit event."""
    result = await session.execute(select(User).where(User.id == creator_id))
    user = result.scalar_one_or_none()
    if not user:
        raise AppError(status_code=404, detail="creator_not_found")
    from_state = user.onboarding_state
    allowed = ALLOWED_TRANSITIONS.get(from_state, frozenset())
    if to_state not in allowed:
        raise AppError(
            status_code=409,
            detail={
                "error_code": "invalid_state_transition",
                "message": f"Cannot transition from {from_state} to {to_state}",
                "from_state": from_state,
                "to_state": to_state,
            },
        )
    user.onboarding_state = to_state
    audit = OnboardingAuditEvent(
        creator_id=creator_id,
        event_type=event_type,
        from_state=from_state,
        to_state=to_state,
        payload_json=payload,
    )
    session.add(audit)
    await session.commit()


async def get_or_create_idempotency_response(
    session: AsyncSession,
    key: str,
    creator_id: UUID | None,
    endpoint: str,
    request_body: bytes | str,
    create_response: Any,
) -> tuple[Any, bool]:
    """
    Check idempotency; if hit, return cached response. Else run create_response and store.
    Returns (response, was_cached).
    """
    req_hash = _hash_request(request_body)
    result = await session.execute(
        select(IdempotencyKey)
        .where(IdempotencyKey.key == key)
        .where(IdempotencyKey.expires_at > datetime.now(UTC))
    )
    row = result.scalar_one_or_none()
    if row:
        if row.request_hash != req_hash:
            raise AppError(
                status_code=409,
                detail="idempotency_key_conflict",
            )
        if row.response_json is not None:
            return row.response_json, True
    response = await create_response()
    resp_json = (
        response if isinstance(response, dict) else {"data": response}
    )
    ik = IdempotencyKey(
        key=key,
        creator_id=creator_id,
        endpoint=endpoint,
        request_hash=req_hash,
        response_json=resp_json,
        expires_at=datetime.now(UTC) + timedelta(hours=24),
    )
    session.add(ik)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        result = await session.execute(
            select(IdempotencyKey).where(IdempotencyKey.key == key)
        )
        row = result.scalar_one_or_none()
        if row and row.request_hash == req_hash and row.response_json:
            return row.response_json, True
        raise AppError(status_code=409, detail="idempotency_key_conflict")
    return resp_json, False


async def get_active_kyc_session(
    session: AsyncSession, creator_id: UUID
) -> KycSession | None:
    result = await session.execute(
        select(KycSession)
        .where(KycSession.creator_id == creator_id)
        .where(KycSession.status.in_({"CREATED", "SUBMITTED"}))
        .order_by(KycSession.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def get_onboarding_checklist(state: str | None) -> dict[str, bool]:
    """Derive checklist from state."""
    return {
        "email_verified": state
        in {"EMAIL_VERIFIED", "KYC_PENDING", "KYC_SUBMITTED", "KYC_APPROVED", "KYC_REJECTED"},
        "kyc_started": state
        in {"KYC_PENDING", "KYC_SUBMITTED", "KYC_APPROVED", "KYC_REJECTED"},
        "kyc_approved": state == "KYC_APPROVED",
    }
