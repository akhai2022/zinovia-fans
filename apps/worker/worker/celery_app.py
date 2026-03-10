from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_shutting_down


def _redis_broker_url() -> str:
    broker = os.environ.get("REDIS_URL")
    if not broker:
        raise RuntimeError("REDIS_URL must be set.")
    return broker


celery_app = Celery(
    "zinovia_worker",
    broker=_redis_broker_url(),
    include=[
        "worker.tasks.ai",
        "worker.tasks.ai_safety",
        "worker.tasks.ai_tools",
        "worker.tasks.billing",
        "worker.tasks.media",
        "worker.tasks.notifications",
        "worker.tasks.posts",
        "worker.tasks.translation",
    ],
)


@worker_shutting_down.connect
def _fail_stuck_jobs(sig, how, exitcode, **kwargs):  # noqa: ARG001
    """Mark any in-progress AI tool jobs as failed on worker shutdown (SIGTERM).

    This prevents jobs from being stuck in 'processing' forever when ECS
    replaces a task during a deployment.
    """
    import asyncio
    import logging

    logger = logging.getLogger(__name__)
    logger.warning("Worker shutting down — failing in-progress AI tool jobs")

    async def _fail_processing():
        try:
            from datetime import datetime, timezone

            from sqlalchemy import update

            from app.core.settings import get_settings
            from app.modules.ai_tools.tool_models import AiToolJob
            from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
            from sqlalchemy.orm import sessionmaker as async_sessionmaker

            engine = create_async_engine(str(get_settings().database_url), pool_pre_ping=True)
            async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)  # type: ignore[call-overload]
            async with async_session() as session:
                result = await session.execute(
                    update(AiToolJob)
                    .where(AiToolJob.status == "processing")
                    .where(AiToolJob.tool == "virtual_tryon")
                    .values(
                        status="failed",
                        error_message="Worker was restarted during processing. Please try again.",
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                await session.commit()
                if result.rowcount:  # type: ignore[union-attr]
                    logger.warning("Marked %d stuck virtual_tryon jobs as failed", result.rowcount)
            await engine.dispose()
        except Exception:
            logger.exception("Failed to clean up stuck jobs on shutdown")

    try:
        asyncio.run(_fail_processing())
    except Exception:
        logger.exception("Failed to run shutdown cleanup")
celery_app.conf.beat_schedule = {
    "posts-publish-due-every-minute": {
        "task": "posts.publish_due_scheduled",
        "schedule": crontab(minute="*"),
    },
    "billing-renew-worldline-every-hour": {
        "task": "billing.renew_worldline_subscriptions",
        "schedule": crontab(minute=0),
    },
}