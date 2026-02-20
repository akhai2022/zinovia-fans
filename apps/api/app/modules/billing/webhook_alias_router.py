from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.modules.billing.router import ccbill_webhook
from app.modules.billing.schemas import WebhookAck

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/ccbill", response_model=WebhookAck, operation_id="webhooks_ccbill_alias")
async def ccbill_webhook_alias(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> WebhookAck:
    return await ccbill_webhook(
        request=request,
        session=session,
    )
