"""KYC session and webhook router."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.media.models import MediaObject
from app.modules.onboarding.constants import (
    EMAIL_VERIFIED,
    KYC_APPROVED,
    KYC_PENDING,
    KYC_REJECTED,
    KYC_SUBMITTED,
)
from app.modules.onboarding.deps import require_idempotency_key
from app.modules.onboarding.kyc_provider import BuiltInKycProvider, KycProvider
from app.modules.onboarding.models import KycSession
from app.modules.onboarding.schemas import (
    KycSessionResponse,
    KycStatusResponse,
    WebhookKycPayload,
)
from app.modules.onboarding.service import (
    get_active_kyc_session,
    get_or_create_idempotency_response,
    transition_creator_state,
    verify_webhook_hmac,
)


class KycCompleteRequest(BaseModel):
    session_id: str
    date_of_birth: date
    id_document_media_id: UUID
    selfie_media_id: UUID

router = APIRouter()


def _get_kyc_provider() -> KycProvider:
    return BuiltInKycProvider()


@router.post(
    "/session",
    response_model=KycSessionResponse,
    status_code=200,
    operation_id="kyc_create_session",
)
async def create_kyc_session(
    user: User = Depends(get_current_user),
    idempotency_key: str = Depends(require_idempotency_key),
    session: AsyncSession = Depends(get_async_session),
) -> KycSessionResponse:
    allowed_states = {EMAIL_VERIFIED, KYC_PENDING, KYC_REJECTED}
    state = user.onboarding_state or "CREATED"
    if state not in allowed_states:
        raise AppError(
            status_code=400,
            detail={
                "error_code": "invalid_state_for_kyc",
                "message": "Email must be verified before starting KYC",
                "current_state": state,
            },
        )

    async def _do() -> dict:
        active = await get_active_kyc_session(session, user.id)
        if active:
            # Regenerate URL to ensure it points to current verification page
            provider = _get_kyc_provider()
            result = await provider.create_session(
                creator_id=user.id, kyc_session_id=active.id
            )
            if active.redirect_url != result.redirect_url:
                active.redirect_url = result.redirect_url
                await session.commit()
            return {
                "redirect_url": result.redirect_url,
                "session_id": str(active.id),
            }
        provider = _get_kyc_provider()
        kyc_session = KycSession(
            creator_id=user.id,
            provider="builtin",
            provider_session_id=None,
            status="CREATED",
            redirect_url=None,
        )
        session.add(kyc_session)
        await session.flush()
        result = await provider.create_session(
            creator_id=user.id,
            kyc_session_id=kyc_session.id,
        )
        kyc_session.redirect_url = result.redirect_url
        kyc_session.provider_session_id = result.provider_session_id
        if user.onboarding_state == EMAIL_VERIFIED:
            await transition_creator_state(
                session,
                user.id,
                KYC_PENDING,
                "kyc_session_created",
                {"session_id": str(kyc_session.id)},
            )
        await session.commit()
        return {
            "redirect_url": result.redirect_url,
            "session_id": str(kyc_session.id),
        }

    body = b"{}"
    result, _ = await get_or_create_idempotency_response(
        session=session,
        key=idempotency_key,
        creator_id=user.id,
        endpoint="kyc/session",
        request_body=body,
        create_response=_do,
    )
    return KycSessionResponse(**result)


@router.post(
    "/complete",
    status_code=200,
    operation_id="kyc_complete",
)
async def kyc_complete(
    payload: KycCompleteRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Complete KYC verification. Stores documents and sets status for admin review."""
    try:
        sid = UUID(payload.session_id)
    except ValueError:
        raise AppError(status_code=400, detail="invalid_session_id")
    result = await session.execute(
        select(KycSession).where(KycSession.id == sid)
    )
    kyc = result.scalar_one_or_none()
    if not kyc or kyc.creator_id != user.id:
        raise AppError(status_code=404, detail="session_not_found")

    # Documents are required — no auto-approve
    if not payload.id_document_media_id or not payload.selfie_media_id or not payload.date_of_birth:
        raise AppError(
            status_code=400,
            detail="id_document, selfie, and date_of_birth are required",
        )

    # Validate media ownership
    for media_id, label in [
        (payload.id_document_media_id, "id_document"),
        (payload.selfie_media_id, "selfie"),
    ]:
        media = (
            await session.execute(
                select(MediaObject).where(
                    MediaObject.id == media_id,
                    MediaObject.owner_user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if not media:
            raise AppError(status_code=400, detail=f"invalid_{label}_media")

    # Store document references
    kyc.date_of_birth = payload.date_of_birth
    kyc.id_document_media_id = payload.id_document_media_id
    kyc.selfie_media_id = payload.selfie_media_id

    event_id = f"kyc_{payload.session_id}_SUBMITTED"
    kyc.raw_webhook_payload = {
        "provider_session_id": kyc.provider_session_id,
        "status": "SUBMITTED",
        "event_id": event_id,
    }

    # Always set to SUBMITTED — admin must approve/reject
    kyc.status = "SUBMITTED"
    if user.onboarding_state in (KYC_PENDING, EMAIL_VERIFIED):
        await transition_creator_state(
            session,
            user.id,
            KYC_SUBMITTED,
            "kyc_submitted",
            {"event_id": event_id},
        )

    await session.commit()
    return {"ack": True}


@router.get(
    "/status",
    response_model=KycStatusResponse,
    operation_id="kyc_status",
)
async def get_kyc_status(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> KycStatusResponse:
    result = await session.execute(
        select(KycSession)
        .where(KycSession.creator_id == user.id)
        .order_by(KycSession.created_at.desc())
        .limit(1)
    )
    kyc = result.scalar_one_or_none()
    session_status = kyc.status if kyc else "NONE"
    creator_state = user.onboarding_state or "CREATED"
    return KycStatusResponse(session_status=session_status, creator_state=creator_state)
