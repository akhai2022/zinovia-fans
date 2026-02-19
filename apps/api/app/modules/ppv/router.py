from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.ppv.schemas import PpvCreateIntentOut, PpvMessageMediaStatusOut, PpvPostStatusOut
from app.modules.ppv.service import (
    create_ppv_message_media_intent,
    create_ppv_post_intent,
    get_ppv_post_status,
    get_ppv_status,
)

router = APIRouter(prefix="/ppv", tags=["ppv"])


@router.post("/message-media/{message_media_id}/create-intent", response_model=PpvCreateIntentOut)
async def create_intent(
    message_media_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> PpvCreateIntentOut:
    data = await create_ppv_message_media_intent(
        session,
        purchaser_id=user.id,
        message_media_id=message_media_id,
    )
    return PpvCreateIntentOut(**data)


@router.get("/message-media/{message_media_id}/status", response_model=PpvMessageMediaStatusOut)
async def status(
    message_media_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> PpvMessageMediaStatusOut:
    is_locked, viewer_has_unlocked, price_cents, currency = await get_ppv_status(
        session,
        message_media_id=message_media_id,
        viewer_id=user.id,
    )
    return PpvMessageMediaStatusOut(
        is_locked=is_locked,
        viewer_has_unlocked=viewer_has_unlocked,
        price_cents=price_cents,
        currency=currency,
    )


@router.post("/posts/{post_id}/create-intent", response_model=PpvCreateIntentOut, operation_id="ppv_post_create_intent")
async def create_post_intent(
    post_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> PpvCreateIntentOut:
    data = await create_ppv_post_intent(
        session,
        purchaser_id=user.id,
        post_id=post_id,
    )
    return PpvCreateIntentOut(**data)


@router.get("/posts/{post_id}/status", response_model=PpvPostStatusOut, operation_id="ppv_post_status")
async def post_status(
    post_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> PpvPostStatusOut:
    is_locked, viewer_has_unlocked, price_cents, currency = await get_ppv_post_status(
        session,
        post_id=post_id,
        viewer_id=user.id,
    )
    return PpvPostStatusOut(
        is_locked=is_locked,
        viewer_has_unlocked=viewer_has_unlocked,
        price_cents=price_cents,
        currency=currency,
    )

