"""Billing worker tasks: Worldline subscription renewals."""

from __future__ import annotations

import asyncio
import logging

from celery import shared_task

from app.db.session import async_session_factory
from app.modules.billing.service import renew_worldline_subscriptions

logger = logging.getLogger(__name__)


@shared_task(name="billing.renew_worldline_subscriptions")
def renew_worldline_subscriptions_task() -> int:
    """Charge Worldline subscriptions that are due for renewal."""

    async def _run() -> int:
        async with async_session_factory() as session:
            return await renew_worldline_subscriptions(session)

    renewed = asyncio.run(_run())
    logger.info("worldline_renewals_processed count=%s", renewed)
    return renewed
