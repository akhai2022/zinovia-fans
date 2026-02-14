from __future__ import annotations

import asyncio
import logging

from celery import shared_task

from app.db.session import async_session_factory
from app.modules.posts.service import publish_due_scheduled_posts

logger = logging.getLogger(__name__)


@shared_task(name="posts.publish_due_scheduled")
def publish_due_scheduled() -> int:
    async def _run() -> int:
        async with async_session_factory() as session:
            return await publish_due_scheduled_posts(session)

    published = asyncio.run(_run())
    logger.info("published_due_scheduled_posts count=%s", published)
    return published

