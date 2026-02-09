from __future__ import annotations

import os

from celery import Celery


def _redis_broker_url() -> str:
    broker = os.environ.get("REDIS_URL")
    if not broker:
        raise RuntimeError("REDIS_URL must be set.")
    return broker


celery_app = Celery("zinovia_worker", broker=_redis_broker_url())
celery_app.autodiscover_tasks(["worker.tasks"])
