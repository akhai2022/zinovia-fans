from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.modules.billing.router import stripe_webhook
from app.modules.billing.schemas import WebhookAck

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe", response_model=WebhookAck, operation_id="webhooks_stripe_alias")
async def stripe_webhook_alias(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> WebhookAck:
    return await stripe_webhook(
        request=request,
        session=session,
        stripe_signature=stripe_signature,
    )

