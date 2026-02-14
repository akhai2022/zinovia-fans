from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.notifications.schemas import NotificationOut, NotificationPageOut
from app.modules.notifications.service import (
    list_notifications_page,
    mark_all_notifications_read,
    mark_notification_read,
)

router = APIRouter()


def _ensure_enabled() -> None:
    if not get_settings().enable_notifications:
        raise AppError(status_code=404, detail="feature_disabled")


@router.get("", response_model=NotificationPageOut, operation_id="notifications_list")
async def list_notifications(
    cursor: str | None = Query(None),
    page_size: int = Query(30, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> NotificationPageOut:
    _ensure_enabled()
    rows, next_cursor, unread_count = await list_notifications_page(
        session, user.id, cursor=cursor, page_size=page_size
    )
    return NotificationPageOut(
        items=[
            NotificationOut(
                id=r.id,
                type=r.type,
                payload_json=r.payload_json,
                read_at=r.read_at,
                created_at=r.created_at,
            )
            for r in rows
        ],
        next_cursor=next_cursor,
        unread_count=unread_count,
    )


@router.post("/{notification_id}/read", operation_id="notifications_mark_read")
async def read_notification(
    notification_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    _ensure_enabled()
    ok = await mark_notification_read(session, user.id, notification_id)
    if not ok:
        raise AppError(status_code=404, detail="notification_not_found")
    return {"status": "ok"}


@router.post("/read-all", operation_id="notifications_mark_read_all")
async def read_all_notifications(
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    _ensure_enabled()
    updated = await mark_all_notifications_read(session, user.id)
    return {"updated": updated}

