"""Minimal Celery client to enqueue worker tasks. Same broker (REDIS_URL) as worker."""

from __future__ import annotations

from app.core.settings import get_settings

_celery_app = None


def _get_celery_app():
    global _celery_app
    if _celery_app is None:
        from celery import Celery
        _celery_app = Celery(broker=get_settings().redis_url)
    return _celery_app


def enqueue_video_poster(asset_id: str) -> None:
    """Enqueue generate_video_poster task (worker.tasks.media). Idempotent on worker side."""
    app = _get_celery_app()
    app.send_task("media.generate_video_poster", args=[asset_id])
