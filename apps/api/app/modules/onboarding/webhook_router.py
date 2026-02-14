"""KYC webhook receiver."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import get_async_session
from app.modules.onboarding.constants import (
    KYC_APPROVED,
    KYC_PENDING,
    KYC_REJECTED,
    KYC_SUBMITTED,
)
from app.modules.onboarding.models import KycSession
from app.modules.onboarding.schemas import WebhookKycPayload
from app.modules.onboarding.service import (
    get_or_create_idempotency_response,
    transition_creator_state,
    verify_webhook_hmac,
)

router = APIRouter()


@router.post(
    "/kyc",
    status_code=200,
    operation_id="webhooks_kyc",
)
async def kyc_webhook(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    raw_body = await request.body()
    signature = request.headers.get("X-Kyc-Signature") or request.headers.get(
        "X-Webhook-Signature"
    )
    if not signature:
        raise AppError(status_code=401, detail="missing_signature")
    if not verify_webhook_hmac(raw_body, signature):
        raise AppError(status_code=401, detail="invalid_signature")

    payload = WebhookKycPayload.model_validate_json(raw_body.decode("utf-8"))
    idempotency_key = f"webhook:kyc:{payload.event_id}"

    async def _do() -> dict:
        result = await session.execute(
            select(KycSession).where(
                KycSession.provider_session_id == payload.provider_session_id
            )
        )
        kyc_session = result.scalar_one_or_none()
        if not kyc_session:
            raise AppError(status_code=404, detail="session_not_found")
        kyc_session.raw_webhook_payload = payload.model_dump()
        kyc_session.status = payload.status
        await session.flush()

        creator_id = kyc_session.creator_id
        status_to_state = {
            "SUBMITTED": KYC_SUBMITTED,
            "APPROVED": KYC_APPROVED,
            "REJECTED": KYC_REJECTED,
        }
        to_state = status_to_state.get(payload.status)
        if to_state:
            await transition_creator_state(
                session,
                creator_id,
                to_state,
                f"webhook_kyc_{payload.status.lower()}",
                {
                    "event_id": payload.event_id,
                    "provider_session_id": payload.provider_session_id,
                    "reason_code": payload.reason_code,
                },
            )
        await session.commit()
        return {"ack": True}

    result, _ = await get_or_create_idempotency_response(
        session=session,
        key=idempotency_key,
        creator_id=None,
        endpoint="webhooks/kyc",
        request_body=raw_body,
        create_response=_do,
    )
    return dict(result)
