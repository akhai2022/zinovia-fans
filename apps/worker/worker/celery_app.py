from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab


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
        "worker.tasks.media",
        "worker.tasks.notifications",
        "worker.tasks.posts",
    ],
)
celery_app.conf.beat_schedule = {
    "posts-publish-due-every-minute": {
        "task": "posts.publish_due_scheduled",
        "schedule": crontab(minute="*"),
    }
}