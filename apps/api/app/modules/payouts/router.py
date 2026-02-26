"""Payouts API routes: creator settings + admin payout management."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import get_async_session
from app.modules.auth.deps import require_admin
from app.modules.auth.models import User
from app.modules.creators.deps import require_creator
from app.modules.payouts.models import Payout, PayoutAuditLog
from app.modules.payouts.schemas import (
    GeneratePayoutsResult,
    PayoutOut,
    PayoutSettingsIn,
    PayoutSettingsOut,
    PayoutStatusUpdate,
    ReconcileResult,
)
from app.modules.payouts.service import (
    export_payouts_csv,
    generate_weekly_payouts,
    get_payout_settings,
    reconcile_availability,
    update_payout_status,
    upsert_payout_settings,
)

creator_router = APIRouter()
admin_router = APIRouter()

# ---- shared page size ----
PAGE_SIZE = 25


# ===========================================================================
# Creator endpoints
# ===========================================================================


@creator_router.get(
    "/payout-settings",
    response_model=PayoutSettingsOut | None,
    operation_id="creator_get_payout_settings",
    summary="Get payout settings (masked IBAN)",
)
async def get_settings_endpoint(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator),
) -> PayoutSettingsOut | None:
    settings = await get_payout_settings(session, current_user.id)
    if not settings:
        return None
    return PayoutSettingsOut(
        method=settings.method,
        status=settings.status,
        account_holder_name=settings.account_holder_name,
        iban_last4=settings.iban_last4,
        country_code=settings.country_code,
        billing_address_line1=settings.billing_address_line1,
        billing_address_line2=settings.billing_address_line2,
        billing_city=settings.billing_city,
        billing_postal_code=settings.billing_postal_code,
        billing_region=settings.billing_region,
        billing_country=settings.billing_country,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


@creator_router.post(
    "/payout-settings",
    response_model=PayoutSettingsOut,
    operation_id="creator_upsert_payout_settings",
    summary="Set or update payout settings (validates + encrypts IBAN)",
)
async def upsert_settings_endpoint(
    body: PayoutSettingsIn,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_creator),
) -> PayoutSettingsOut:
    try:
        settings = await upsert_payout_settings(
            session,
            current_user.id,
            account_holder_name=body.account_holder_name,
            iban_raw=body.iban,
            bic_raw=body.bic,
            country_code=body.country_code,
            billing_address_line1=body.billing_address_line1,
            billing_address_line2=body.billing_address_line2,
            billing_city=body.billing_city,
            billing_postal_code=body.billing_postal_code,
            billing_region=body.billing_region,
            billing_country=body.billing_country,
        )
    except ValueError as exc:
        raise AppError(status_code=422, detail=str(exc)) from exc

    return PayoutSettingsOut(
        method=settings.method,
        status=settings.status,
        account_holder_name=settings.account_holder_name,
        iban_last4=settings.iban_last4,
        country_code=settings.country_code,
        billing_address_line1=settings.billing_address_line1,
        billing_address_line2=settings.billing_address_line2,
        billing_city=settings.billing_city,
        billing_postal_code=settings.billing_postal_code,
        billing_region=settings.billing_region,
        billing_country=settings.billing_country,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


# ===========================================================================
# Admin endpoints
# ===========================================================================


@admin_router.post(
    "/payouts/reconcile-availability",
    response_model=ReconcileResult,
    operation_id="admin_reconcile_availability",
    summary="Move funds from pending → available (admin cron job)",
)
async def admin_reconcile(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> ReconcileResult:
    result = await reconcile_availability(session)
    return ReconcileResult(**result)


@admin_router.post(
    "/payouts/generate-weekly",
    response_model=GeneratePayoutsResult,
    operation_id="admin_generate_weekly_payouts",
    summary="Generate weekly payouts for eligible creators",
)
async def admin_generate_payouts(
    start: str = Query(..., description="Period start YYYY-MM-DD"),
    end: str = Query(..., description="Period end YYYY-MM-DD"),
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
) -> GeneratePayoutsResult:
    try:
        period_start = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        period_end = datetime.strptime(end, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=timezone.utc
        )
    except ValueError as exc:
        raise AppError(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.") from exc

    result = await generate_weekly_payouts(session, period_start, period_end)
    return GeneratePayoutsResult(**result)


@admin_router.get(
    "/payouts",
    operation_id="admin_list_payouts",
    summary="List payouts with optional status filter",
)
async def admin_list_payouts(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE, ge=1, le=100),
) -> dict:
    where = []
    if status:
        where.append(Payout.status == status)

    total = (await session.execute(
        select(func.count(Payout.id)).where(*where) if where
        else select(func.count(Payout.id))
    )).scalar_one() or 0

    offset = (page - 1) * page_size
    q = select(Payout).order_by(Payout.created_at.desc()).offset(offset).limit(page_size)
    if where:
        q = q.where(*where)

    payouts = (await session.execute(q)).scalars().all()
    items = [
        PayoutOut(
            id=p.id,
            creator_id=p.creator_id,
            amount_cents=p.amount_cents,
            currency=p.currency,
            method=p.method,
            status=p.status,
            period_start=p.period_start,
            period_end=p.period_end,
            created_at=p.created_at,
            exported_at=p.exported_at,
            sent_at=p.sent_at,
            settled_at=p.settled_at,
            export_batch_id=p.export_batch_id,
            bank_reference=p.bank_reference,
            error_reason=p.error_reason,
        ).model_dump()
        for p in payouts
    ]
    return {"items": items, "total": total}


@admin_router.get(
    "/payouts/export.csv",
    operation_id="admin_export_payouts_csv",
    summary="Export payouts as CSV for SEPA bank upload (decrypts IBAN)",
)
async def admin_export_csv(
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(require_admin),
    status: str = Query("queued", description="Status to export"),
) -> StreamingResponse:
    csv_data = await export_payouts_csv(session, admin.id, status_filter=status)
    if not csv_data:
        raise AppError(status_code=404, detail="No payouts to export")

    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=payouts-export.csv"},
    )


@admin_router.patch(
    "/payouts/{payout_id}/status",
    response_model=PayoutOut,
    operation_id="admin_update_payout_status",
    summary="Update payout status (sent/settled/failed)",
)
async def admin_update_status(
    payout_id: str,
    body: PayoutStatusUpdate,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(require_admin),
) -> PayoutOut:
    import uuid as _uuid

    try:
        pid = _uuid.UUID(payout_id)
    except ValueError as exc:
        raise AppError(status_code=400, detail="Invalid payout ID") from exc

    try:
        payout = await update_payout_status(
            session, pid, body.status, admin.id,
            bank_reference=body.bank_reference,
            error_reason=body.error_reason,
        )
    except ValueError as exc:
        raise AppError(status_code=422, detail=str(exc)) from exc

    return PayoutOut(
        id=payout.id,
        creator_id=payout.creator_id,
        amount_cents=payout.amount_cents,
        currency=payout.currency,
        method=payout.method,
        status=payout.status,
        period_start=payout.period_start,
        period_end=payout.period_end,
        created_at=payout.created_at,
        exported_at=payout.exported_at,
        sent_at=payout.sent_at,
        settled_at=payout.settled_at,
        export_batch_id=payout.export_batch_id,
        bank_reference=payout.bank_reference,
        error_reason=payout.error_reason,
    )


@admin_router.get(
    "/payouts/audit-log",
    operation_id="admin_payouts_audit_log",
    summary="View payout audit trail",
)
async def admin_audit_log(
    session: AsyncSession = Depends(get_async_session),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE, ge=1, le=100),
) -> dict:
    total = (await session.execute(
        select(func.count(PayoutAuditLog.id))
    )).scalar_one() or 0

    offset = (page - 1) * page_size
    rows = (await session.execute(
        select(PayoutAuditLog)
        .order_by(PayoutAuditLog.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )).scalars().all()

    items = [
        {
            "id": str(r.id),
            "actor_user_id": str(r.actor_user_id),
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "details": r.details,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    return {"items": items, "total": total}
