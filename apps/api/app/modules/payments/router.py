"""Payments router: tips, PPV intents."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.payments.schemas import (
    PpvCreateIntent,
    PpvIntentOut,
    TipCreateIntent,
    TipIntentOut,
)
from app.modules.payments.service import create_ppv_intent, create_tip_intent

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/tips/create-intent", response_model=TipIntentOut)
async def tip_create_intent(
    payload: TipCreateIntent,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
):
    settings = get_settings()
    if payload.amount_cents < settings.tip_min_cents:
        raise AppError(status_code=400, detail="amount_below_minimum")
    if payload.amount_cents > settings.tip_max_cents:
        raise AppError(status_code=400, detail="amount_above_maximum")
    tip, client_secret = await create_tip_intent(
        session,
        tipper_id=user.id,
        creator_id=payload.creator_id,
        amount_cents=payload.amount_cents,
        currency=payload.currency,
        conversation_id=payload.conversation_id,
        message_id=payload.message_id,
    )
    return TipIntentOut(client_secret=client_secret, tip_id=tip.id)


@router.post("/ppv/create-intent", response_model=PpvIntentOut)
async def ppv_create_intent(
    payload: PpvCreateIntent,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
):
    purchase, client_secret = await create_ppv_intent(
        session,
        purchaser_id=user.id,
        message_media_id=payload.message_media_id,
    )
    return PpvIntentOut(client_secret=client_secret, purchase_id=purchase.id)
