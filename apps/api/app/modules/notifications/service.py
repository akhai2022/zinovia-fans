from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.notifications.models import Notification


def _encode_cursor(created_at: datetime, nid: UUID) -> str:
    return f"{created_at.isoformat()}|{nid}"


def _decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        created_at_s, nid_s = cursor.split("|", 1)
        created_at = datetime.fromisoformat(created_at_s)
        return created_at, UUID(nid_s)
    except Exception as exc:
        raise AppError(status_code=400, detail="invalid_cursor") from exc


async def list_notifications_page(
    session: AsyncSession,
    user_id: UUID,
    *,
    cursor: str | None = None,
    page_size: int = 30,
) -> tuple[list[Notification], str | None, int]:
    q = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
    )
    if cursor:
        c_dt, c_id = _decode_cursor(cursor)
        q = q.where(
            (Notification.created_at < c_dt)
            | ((Notification.created_at == c_dt) & (Notification.id < c_id))
        )
    q = q.limit(page_size + 1)
    rows = list((await session.execute(q)).scalars().all())
    next_cursor = None
    if len(rows) > page_size:
        rows = rows[:page_size]
        next_cursor = _encode_cursor(rows[-1].created_at, rows[-1].id)
    unread_count = (
        await session.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.read_at.is_(None),
            )
        )
    ).scalar_one() or 0
    return rows, next_cursor, unread_count


async def mark_notification_read(session: AsyncSession, user_id: UUID, notification_id: UUID) -> bool:
    row = (
        await session.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        return False
    if row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
        await session.commit()
    return True


async def mark_all_notifications_read(session: AsyncSession, user_id: UUID) -> int:
    rows = list(
        (
            await session.execute(
                select(Notification).where(
                    Notification.user_id == user_id,
                    Notification.read_at.is_(None),
                )
            )
        ).scalars().all()
    )
    now = datetime.now(timezone.utc)
    for row in rows:
        row.read_at = now
    if rows:
        await session.commit()
    return len(rows)

