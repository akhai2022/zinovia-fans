"""Audit service: fire-and-forget logging of security/money events."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.models import AuditEvent

logger = logging.getLogger(__name__)

# Action constants
ACTION_SIGNUP = "signup"
ACTION_LOGIN = "login"
ACTION_LOGOUT = "logout"
ACTION_VERIFY_EMAIL = "verify_email"
ACTION_PASSWORD_RESET_REQUEST = "password_reset_request"
ACTION_PASSWORD_RESET = "password_reset"
ACTION_PAYMENT_SUCCEEDED = "payment_succeeded"
ACTION_PAYMENT_FAILED = "payment_failed"
ACTION_SUBSCRIPTION_CREATED = "subscription_created"
ACTION_SUBSCRIPTION_CANCELED = "subscription_canceled"
ACTION_DISPUTE_CREATED = "dispute_created"
ACTION_DISPUTE_CLOSED = "dispute_closed"
ACTION_REFUND = "refund"
ACTION_MEDIA_UPLOADED = "media_uploaded"
ACTION_MEDIA_QUARANTINED = "media_quarantined"
ACTION_ENTITLEMENT_GRANTED = "entitlement_granted"
ACTION_ENTITLEMENT_REVOKED = "entitlement_revoked"


async def log_audit_event(
    session: AsyncSession,
    *,
    action: str,
    actor_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    ip_address: str | None = None,
    auto_commit: bool = True,
) -> AuditEvent | None:
    """Create an audit event. Best-effort: logs error but does not raise."""
    try:
        event = AuditEvent(
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_json=metadata,
            ip_address=ip_address,
        )
        session.add(event)
        if auto_commit:
            await session.commit()
            await session.refresh(event)
        else:
            await session.flush()
        return event
    except Exception:
        logger.exception("failed to write audit event action=%s", action)
        return None  # type: ignore[return-value]
