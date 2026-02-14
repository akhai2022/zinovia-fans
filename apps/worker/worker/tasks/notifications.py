from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from celery import shared_task

from app.db.session import async_session_factory
from app.modules.notifications.models import Notification

logger = logging.getLogger(__name__)


@shared_task(name="notify.create_notification")
def create_notification(user_id: str, notification_type: str, payload: dict) -> str:
    async def _run() -> str:
        async with async_session_factory() as session:
            notification = Notification(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id),
                type=notification_type,
                payload_json=payload or {},
                read_at=None,
                created_at=datetime.now(timezone.utc),
            )
            session.add(notification)
            await session.commit()
            logger.info(
                "notification_created id=%s user_id=%s type=%s",
                notification.id,
                user_id,
                notification_type,
            )
            return str(notification.id)

    return asyncio.run(_run())

