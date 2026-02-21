"""Admin endpoints for inbound email management + Resend webhook receiver."""
from __future__ import annotations

import hashlib
import hmac
import logging
import time
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import require_admin
from app.modules.auth.models import User
from app.modules.inbound.schemas import (
    InboundCategoryCount,
    InboundEmailDetail,
    InboundEmailOut,
    InboundEmailPage,
    InboundStatsOut,
)
from app.modules.inbound.service import (
    get_category_stats,
    get_inbound_email,
    handle_webhook_event,
    list_inbound_emails,
    mark_email_read,
    sync_from_resend,
)

logger = logging.getLogger(__name__)

router = APIRouter()
webhook_router = APIRouter()


# ---------------------------------------------------------------------------
# Admin endpoints (under /admin/inbound, require admin auth)
# ---------------------------------------------------------------------------


@router.get("/emails", response_model=InboundEmailPage, operation_id="admin_list_inbound")
async def list_emails(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = Query(None),
    is_read: bool | None = Query(None),
) -> InboundEmailPage:
    items, total = await list_inbound_emails(
        session, page=page, page_size=page_size, category=category, is_read=is_read,
    )
    return InboundEmailPage(
        items=[InboundEmailOut.model_validate(e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/emails/stats", response_model=InboundStatsOut, operation_id="admin_inbound_stats")
async def email_stats(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> InboundStatsOut:
    cats = await get_category_stats(session)
    total = sum(c["total"] for c in cats)
    total_unread = sum(c["unread"] for c in cats)
    return InboundStatsOut(
        categories=[InboundCategoryCount(**c) for c in cats],
        total=total,
        total_unread=total_unread,
    )


@router.get(
    "/emails/{email_id}",
    response_model=InboundEmailDetail,
    operation_id="admin_get_inbound",
)
async def get_email(
    email_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> InboundEmailDetail:
    email = await get_inbound_email(session, email_id)
    if not email:
        raise AppError(status_code=404, detail="email_not_found")
    # Auto-mark as read on open
    if not email.is_read:
        await mark_email_read(session, email_id, read=True)
        await session.commit()
    return InboundEmailDetail.model_validate(email)


@router.post(
    "/emails/{email_id}/read",
    operation_id="admin_mark_inbound_read",
)
async def toggle_read(
    email_id: UUID,
    read: bool = Query(True),
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    email = await mark_email_read(session, email_id, read=read)
    if not email:
        raise AppError(status_code=404, detail="email_not_found")
    await session.commit()
    return {"id": str(email_id), "is_read": read}


@router.post("/sync", operation_id="admin_sync_inbound")
async def trigger_sync(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> dict:
    """Manually trigger a sync from Resend Receiving API."""
    count = await sync_from_resend(session)
    return {"status": "ok", "new_emails": count}


# ---------------------------------------------------------------------------
# Resend Webhook endpoint (under /webhooks/inbound, no auth — uses svix sig)
# ---------------------------------------------------------------------------


def _verify_svix_signature(body: bytes, headers: dict[str, str]) -> bool:
    """Verify Resend webhook signature using svix HMAC-SHA256."""
    settings = get_settings()
    secret = settings.resend_webhook_secret
    if not secret:
        logger.warning("RESEND_WEBHOOK_SECRET not set — skipping signature verification")
        return True  # Permissive if not configured (log warning)

    # svix secret starts with "whsec_" prefix — strip it and decode
    if secret.startswith("whsec_"):
        secret = secret[6:]
    import base64
    try:
        secret_bytes = base64.b64decode(secret)
    except Exception:
        logger.error("Invalid RESEND_WEBHOOK_SECRET format")
        return False

    svix_id = headers.get("svix-id", "")
    svix_timestamp = headers.get("svix-timestamp", "")
    svix_signature = headers.get("svix-signature", "")

    if not svix_id or not svix_timestamp or not svix_signature:
        return False

    # Reject if timestamp is >5 minutes old
    try:
        ts = int(svix_timestamp)
        if abs(time.time() - ts) > 300:
            logger.warning("Webhook timestamp too old: %s", svix_timestamp)
            return False
    except ValueError:
        return False

    # Sign: "{svix_id}.{svix_timestamp}.{body}"
    to_sign = f"{svix_id}.{svix_timestamp}.".encode() + body
    expected = hmac.new(secret_bytes, to_sign, hashlib.sha256).digest()
    expected_b64 = "v1," + base64.b64encode(expected).decode()

    # svix-signature can contain multiple signatures separated by spaces
    for sig in svix_signature.split(" "):
        if hmac.compare_digest(sig.strip(), expected_b64):
            return True
    return False


@webhook_router.post("/inbound")
async def resend_inbound_webhook(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    """Resend webhook receiver for email.received events."""
    body = await request.body()

    # Verify signature
    header_map = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }
    if not _verify_svix_signature(body, header_map):
        logger.warning("Webhook signature verification failed")
        raise AppError(status_code=401, detail="invalid_signature")

    import json
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise AppError(status_code=400, detail="invalid_json")

    result = await handle_webhook_event(session, payload)
    logger.info("Webhook processed: %s", result)
    return Response(status_code=200, content="ok")
