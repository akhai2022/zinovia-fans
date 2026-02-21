"""Inbound email service — sync from Resend Receiving API, store, forward."""
from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.modules.inbound.models import InboundEmail

logger = logging.getLogger(__name__)

# Address → category mapping
ADDRESS_CATEGORIES: dict[str, str] = {
    "support": "support",
    "privacy": "privacy",
    "creators": "creators",
    "safety": "safety",
    "legal": "legal",
}

RESEND_BASE = "https://api.resend.com"
TIMEOUT = httpx.Timeout(15.0, connect=5.0)


def _get_headers() -> dict[str, str]:
    settings = get_settings()
    return {"Authorization": f"Bearer {settings.resend_api_key}"}


def _classify_category(to_addresses: list[str]) -> str:
    """Derive category from the local part of the first matching @zinovia.ai address."""
    for addr in to_addresses:
        local = addr.split("@")[0].lower()
        if local in ADDRESS_CATEGORIES:
            return ADDRESS_CATEGORIES[local]
    return "unknown"


def _make_snippet(text: str | None, max_len: int = 200) -> str:
    if not text:
        return ""
    clean = " ".join(text.split())
    return clean[:max_len]


def _extract_auth_results(headers: dict | None) -> tuple[str | None, str | None, str | None]:
    """Pull SPF, DKIM, spam results from email headers if available."""
    if not headers:
        return None, None, None
    spf = None
    dkim = None
    spam = None
    auth_results = headers.get("authentication-results", "") or headers.get(
        "Authentication-Results", ""
    )
    if isinstance(auth_results, str):
        lower = auth_results.lower()
        if "spf=pass" in lower:
            spf = "pass"
        elif "spf=fail" in lower:
            spf = "fail"
        elif "spf=softfail" in lower:
            spf = "softfail"
        elif "spf=neutral" in lower:
            spf = "neutral"
        if "dkim=pass" in lower:
            dkim = "pass"
        elif "dkim=fail" in lower:
            dkim = "fail"
    spam_header = headers.get("x-spam-score", headers.get("X-Spam-Score"))
    if spam_header:
        spam = str(spam_header)
    return spf, dkim, spam


# ---------------------------------------------------------------------------
# Resend API client helpers
# ---------------------------------------------------------------------------


async def _resend_list_received(
    after: str | None = None, limit: int = 100
) -> dict:
    """GET /emails/receiving — list received emails."""
    params: dict[str, str | int] = {"limit": limit}
    if after:
        params["after"] = after
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            f"{RESEND_BASE}/emails/receiving",
            headers=_get_headers(),
            params=params,
        )
        resp.raise_for_status()
        return resp.json()


async def _resend_get_received(email_id: str) -> dict:
    """GET /emails/receiving/:id — retrieve full email with body+headers."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            f"{RESEND_BASE}/emails/receiving/{email_id}",
            headers=_get_headers(),
        )
        resp.raise_for_status()
        return resp.json()


async def _resend_send_email(
    *, from_addr: str, to: list[str], subject: str, html: str, text: str,
    reply_to: list[str] | None = None,
) -> dict:
    """POST /emails — send outbound email (for forwarding)."""
    payload: dict = {
        "from": from_addr,
        "to": to,
        "subject": subject,
        "html": html,
        "text": text,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            f"{RESEND_BASE}/emails",
            headers={**_get_headers(), "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Forwarding
# ---------------------------------------------------------------------------

def _get_forward_map() -> dict[str, str]:
    """Build category→destination email map from env vars."""
    import os
    mapping: dict[str, str] = {}
    env_map = {
        "support": "FORWARD_SUPPORT_TO",
        "privacy": "FORWARD_PRIVACY_TO",
        "creators": "FORWARD_CREATORS_TO",
        "safety": "FORWARD_SAFETY_TO",
        "legal": "FORWARD_LEGAL_TO",
    }
    for category, env_key in env_map.items():
        dest = os.environ.get(env_key, "").strip()
        if dest:
            mapping[category] = dest
    return mapping


async def _forward_email(email: InboundEmail) -> str | None:
    """Forward email to configured destination. Returns destination or None."""
    forward_map = _get_forward_map()
    dest = forward_map.get(email.category)
    if not dest:
        return None

    settings = get_settings()
    from_addr = f"Zinovia Inbox <{settings.mail_from}>"

    # Build forwarding body with original metadata
    import html as _html
    safe_from = _html.escape(email.from_address)
    safe_subject = _html.escape(email.subject)
    safe_to = _html.escape(", ".join(email.to_addresses))

    fwd_html = (
        '<div style="border-left:3px solid #6366f1;padding-left:12px;margin-bottom:16px;">'
        '<p style="font-size:12px;color:#6b7280;margin:0 0 8px;">'
        f"<strong>Forwarded from Zinovia Inbox</strong><br/>"
        f"From: {safe_from}<br/>"
        f"To: {safe_to}<br/>"
        f"Date: {email.received_at.isoformat()}<br/>"
        f"Category: {email.category.upper()}<br/>"
        f"Resend ID: {email.resend_email_id}"
        "</p></div>"
        f"{email.html_body or _html.escape(email.text_body or '(no body)')}"
    )
    fwd_text = (
        f"--- Forwarded from Zinovia Inbox ---\n"
        f"From: {email.from_address}\n"
        f"To: {', '.join(email.to_addresses)}\n"
        f"Date: {email.received_at.isoformat()}\n"
        f"Category: {email.category.upper()}\n"
        f"Resend ID: {email.resend_email_id}\n"
        f"---\n\n"
        f"{email.text_body or '(no body)'}"
    )

    try:
        await _resend_send_email(
            from_addr=from_addr,
            to=[dest],
            subject=f"[{email.category.upper()}] {email.subject}",
            html=fwd_html,
            text=fwd_text,
            reply_to=[email.from_address],
        )
        logger.info(
            "Forwarded email %s (%s) to %s",
            email.resend_email_id, email.category, dest,
        )
        return dest
    except Exception:
        logger.exception(
            "Failed to forward email %s to %s", email.resend_email_id, dest,
        )
        return None


# ---------------------------------------------------------------------------
# Persist a single email from Resend API data
# ---------------------------------------------------------------------------

async def persist_email_from_resend(
    session: AsyncSession,
    data: dict,
    *,
    fetch_body: bool = True,
) -> InboundEmail | None:
    """
    Upsert a single email from Resend API response into the DB.
    Returns the InboundEmail or None if already exists.
    """
    resend_id = data.get("id", "")

    # Idempotency check
    exists = await session.execute(
        select(InboundEmail.id).where(InboundEmail.resend_email_id == resend_id)
    )
    if exists.scalar_one_or_none() is not None:
        return None

    to_addresses = data.get("to", [])
    category = _classify_category(to_addresses)

    # If list endpoint data doesn't include body, fetch full detail
    html_body = data.get("html")
    text_body = data.get("text")
    headers = data.get("headers")
    raw_info = data.get("raw")
    if fetch_body and not html_body and not text_body:
        try:
            full = await _resend_get_received(resend_id)
            html_body = full.get("html")
            text_body = full.get("text")
            headers = full.get("headers")
            raw_info = full.get("raw")
        except Exception:
            logger.warning("Could not fetch full email %s", resend_id)

    # Extract auth results
    spf, dkim, spam = _extract_auth_results(headers)

    # Attachment metadata
    attachments = data.get("attachments", [])
    attachments_meta = [
        {
            "id": a.get("id", ""),
            "filename": a.get("filename", ""),
            "content_type": a.get("content_type", ""),
            "size": a.get("size", 0),
        }
        for a in attachments
    ]

    raw_download_url = None
    raw_download_expires_at = None
    if raw_info and isinstance(raw_info, dict):
        raw_download_url = raw_info.get("download_url")
        exp = raw_info.get("expires_at")
        if exp:
            try:
                raw_download_expires_at = datetime.fromisoformat(
                    exp.replace("Z", "+00:00")
                )
            except (ValueError, AttributeError):
                pass

    received_at_str = data.get("created_at", "")
    try:
        received_at = datetime.fromisoformat(received_at_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        received_at = datetime.now(UTC)

    email_obj = InboundEmail(
        resend_email_id=resend_id,
        from_address=data.get("from", ""),
        to_addresses=to_addresses,
        cc_addresses=data.get("cc", []) or [],
        reply_to_addresses=data.get("reply_to", []) or [],
        subject=data.get("subject", ""),
        category=category,
        html_body=html_body,
        text_body=text_body,
        snippet=_make_snippet(text_body or html_body),
        attachments_meta=attachments_meta,
        attachment_count=len(attachments),
        raw_download_url=raw_download_url,
        raw_download_expires_at=raw_download_expires_at,
        message_id_header=data.get("message_id"),
        headers=headers,
        spf_result=spf,
        dkim_result=dkim,
        spam_score=spam,
        received_at=received_at,
    )
    session.add(email_obj)
    await session.flush()

    # Attempt forwarding
    dest = await _forward_email(email_obj)
    if dest:
        email_obj.forwarded_to = dest
        email_obj.forwarded_at = datetime.now(UTC)
        await session.flush()

    return email_obj


# ---------------------------------------------------------------------------
# Sync job: pull all emails from Resend and persist new ones
# ---------------------------------------------------------------------------


async def sync_from_resend(session: AsyncSession) -> int:
    """
    Paginate through Resend Receiving API and persist any new emails.
    Returns count of newly stored emails.
    """
    stored = 0
    after: str | None = None
    max_pages = 50  # safety limit

    for _ in range(max_pages):
        try:
            result = await _resend_list_received(after=after, limit=100)
        except httpx.HTTPStatusError as exc:
            logger.error("Resend list received failed: %s", exc)
            break
        except httpx.TimeoutException:
            logger.error("Resend list received timed out")
            break

        emails = result.get("data", [])
        if not emails:
            break

        for email_data in emails:
            try:
                obj = await persist_email_from_resend(session, email_data)
                if obj is not None:
                    stored += 1
            except Exception:
                logger.exception(
                    "Failed to persist email %s", email_data.get("id")
                )

        if not result.get("has_more", False):
            break
        after = emails[-1]["id"]

    await session.commit()
    logger.info("Inbound sync complete: %d new emails stored", stored)
    return stored


# ---------------------------------------------------------------------------
# Webhook handler — processes email.received event from Resend
# ---------------------------------------------------------------------------


async def handle_webhook_event(
    session: AsyncSession, payload: dict
) -> dict:
    """
    Handle a Resend webhook event (email.received).
    The webhook payload contains metadata only — we fetch the full email.
    """
    event_type = payload.get("type", "")
    if event_type != "email.received":
        return {"status": "ignored", "event_type": event_type}

    data = payload.get("data", {})
    resend_id = data.get("id", "")
    if not resend_id:
        return {"status": "error", "detail": "missing email id"}

    # Fetch full email from Resend API (body + headers)
    try:
        full_data = await _resend_get_received(resend_id)
    except Exception:
        logger.exception("Failed to fetch email %s from Resend", resend_id)
        # Store with partial data anyway
        full_data = data

    obj = await persist_email_from_resend(session, full_data, fetch_body=False)
    if obj is None:
        return {"status": "duplicate", "resend_email_id": resend_id}

    await session.commit()
    return {
        "status": "stored",
        "id": str(obj.id),
        "category": obj.category,
        "forwarded_to": obj.forwarded_to,
    }


# ---------------------------------------------------------------------------
# Query helpers for admin endpoints
# ---------------------------------------------------------------------------


async def list_inbound_emails(
    session: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    category: str | None = None,
    is_read: bool | None = None,
) -> tuple[list[InboundEmail], int]:
    where = []
    if category:
        where.append(InboundEmail.category == category)
    if is_read is not None:
        where.append(InboundEmail.is_read == is_read)

    count_q = select(func.count()).select_from(InboundEmail)
    items_q = (
        select(InboundEmail)
        .order_by(InboundEmail.received_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    for w in where:
        count_q = count_q.where(w)
        items_q = items_q.where(w)

    total = (await session.execute(count_q)).scalar() or 0
    items = list((await session.execute(items_q)).scalars().all())
    return items, total


async def get_inbound_email(
    session: AsyncSession, email_id: UUID
) -> InboundEmail | None:
    result = await session.execute(
        select(InboundEmail).where(InboundEmail.id == email_id)
    )
    return result.scalar_one_or_none()


async def mark_email_read(
    session: AsyncSession, email_id: UUID, *, read: bool = True
) -> InboundEmail | None:
    email = await get_inbound_email(session, email_id)
    if email:
        email.is_read = read
        await session.flush()
    return email


async def get_category_stats(session: AsyncSession) -> list[dict]:
    """Return count and unread count per category."""
    q = select(
        InboundEmail.category,
        func.count().label("total"),
        func.sum(case((InboundEmail.is_read == False, 1), else_=0)).label("unread"),  # noqa: E712
    ).group_by(InboundEmail.category)
    rows = (await session.execute(q)).all()
    return [
        {"category": row.category, "total": row.total, "unread": row.unread}
        for row in rows
    ]
