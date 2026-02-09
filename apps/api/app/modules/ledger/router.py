from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.modules.auth.deps import require_admin
from app.modules.ledger.schemas import LedgerEntryCreate, LedgerEntryOut
from app.modules.auth.models import User
from app.modules.ledger.service import create_ledger_entry

router = APIRouter()


@router.post(
    "/entries",
    response_model=LedgerEntryOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="ledger_create_entry",
    summary="Create ledger entry (admin)",
    description="Admin-only. For internal tooling (e.g. balance adjustments). Not used by the web app.",
)
async def create_entry(
    payload: LedgerEntryCreate,
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> LedgerEntryOut:
    entry = await create_ledger_entry(
        session,
        account_id=payload.account_id,
        currency=payload.currency,
        amount=payload.amount,
        direction=payload.direction,
        reference=payload.reference,
    )
    return LedgerEntryOut(
        id=entry.id,
        account_id=entry.account_id,
        currency=entry.currency,
        amount=entry.amount,
        direction=entry.direction,
        reference=entry.reference,
        created_at=entry.created_at,
    )
