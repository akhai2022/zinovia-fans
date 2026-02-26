from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.modules.auth.rate_limit import check_rate_limit_custom
from app.modules.contact.models import ContactSubmission
from app.modules.contact.schemas import ContactFormRequest, ContactFormResponse
from app.modules.onboarding.mail import send_contact_form_email

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/contact", response_model=ContactFormResponse)
async def submit_contact_form(
    body: ContactFormRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> ContactFormResponse:
    """Public contact form — no auth required. Rate-limited by IP."""
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    await check_rate_limit_custom(f"contact:{client_ip}", max_count=5, window_seconds=300)

    # Store in DB for admin visibility
    submission = ContactSubmission(
        email=body.email,
        category=body.category,
        subject=body.subject,
        message=body.message,
        ip_address=client_ip,
    )
    session.add(submission)
    await session.commit()

    # Also send email notification
    await send_contact_form_email(
        sender_email=body.email,
        category=body.category,
        subject=body.subject,
        message=body.message,
    )
    return ContactFormResponse()
