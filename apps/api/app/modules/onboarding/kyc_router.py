"""KYC session and webhook router."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.onboarding.constants import (
    EMAIL_VERIFIED,
    KYC_APPROVED,
    KYC_PENDING,
    KYC_REJECTED,
    KYC_SUBMITTED,
)
from app.modules.onboarding.deps import require_idempotency_key
from app.modules.onboarding.kyc_provider import KycProvider, MockKycProvider
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

router = APIRouter()


def _get_kyc_provider() -> KycProvider:
    settings = get_settings()
    # Local/staging always use mock; production requires explicit feature flag.
    if settings.environment in ("local", "staging") or settings.enable_mock_kyc:
        return MockKycProvider()
    raise AppError(status_code=501, detail="kyc_provider_not_configured")


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
            return {
                "redirect_url": active.redirect_url or "",
                "session_id": str(active.id),
            }
        provider = _get_kyc_provider()
        kyc_session = KycSession(
            creator_id=user.id,
            provider="mock",
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
    "/mock-complete",
    status_code=200,
    operation_id="kyc_mock_complete",
)
async def mock_kyc_complete(
    request: Request,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    """Simulate KYC provider completion. Available in local/staging or when ENABLE_MOCK_KYC=true."""
    settings = get_settings()
    if settings.environment not in ("local", "staging") and not settings.enable_mock_kyc:
        raise AppError(status_code=404, detail="not_available")
    body = await request.json()
    session_id = body.get("session_id")
    status_action = body.get("status")
    if not session_id or status_action not in ("APPROVED", "REJECTED"):
        raise AppError(
            status_code=400,
            detail="session_id and status (APPROVED|REJECTED) required",
        )
    try:
        sid = UUID(session_id)
    except ValueError:
        raise AppError(status_code=400, detail="invalid_session_id")
    result = await session.execute(
        select(KycSession).where(KycSession.id == sid)
    )
    kyc = result.scalar_one_or_none()
    if not kyc or kyc.creator_id != user.id:
        raise AppError(status_code=404, detail="session_not_found")
    event_id = f"mock_{session_id}_{status_action}"
    kyc.raw_webhook_payload = {
        "provider_session_id": kyc.provider_session_id,
        "status": status_action,
        "event_id": event_id,
    }
    kyc.status = status_action
    # Mock provider simulates the full lifecycle: KYC_PENDING -> KYC_SUBMITTED -> final.
    if user.onboarding_state == KYC_PENDING:
        await transition_creator_state(
            session,
            user.id,
            KYC_SUBMITTED,
            "mock_kyc_submitted",
            {"event_id": event_id},
        )
    await transition_creator_state(
        session,
        user.id,
        KYC_APPROVED if status_action == "APPROVED" else KYC_REJECTED,
        f"mock_kyc_{status_action.lower()}",
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
