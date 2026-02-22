"""Minimal Celery client to enqueue worker tasks. Same broker (REDIS_URL) as worker."""

from __future__ import annotations

import logging
from typing import Any

from app.core.settings import get_settings

logger = logging.getLogger(__name__)
_celery_app = None


def _get_celery_app() -> Any:
    global _celery_app
    if _celery_app is None:
        settings = get_settings()
        if not settings.redis_url or not settings.redis_url.strip():
            raise RuntimeError(
                "REDIS_URL must be set when using Celery (enqueue tasks). "
                "Set in env or Secrets Manager for ECS."
            )
        from celery import Celery
        _celery_app = Celery(broker=settings.redis_url)
    return _celery_app


def enqueue_video_poster(asset_id: str) -> None:
    """Enqueue generate_video_poster task (worker.tasks.media). Idempotent on worker side."""
    app = _get_celery_app()
    app.send_task("media.generate_video_poster", args=[asset_id])  # type: ignore[attr-defined]


def enqueue_generate_derived_variants(
    asset_id: str,
    object_key: str,
    content_type: str,
    owner_handle: str | None = None,
) -> None:
    """Enqueue generate_derived_variants (thumb, grid, full). Idempotent on worker side."""
    app = _get_celery_app()
    app.send_task(  # type: ignore[attr-defined]
        "media.generate_derived_variants",
        args=[asset_id, object_key, content_type],
        kwargs={"owner_handle": owner_handle},
    )


def enqueue_ai_generate_images(job_id: str) -> None:
    """Enqueue ai.generate_images task."""
    app = _get_celery_app()
    app.send_task("ai.generate_images", args=[job_id])  # type: ignore[attr-defined]


def enqueue_create_notification(user_id: str, notification_type: str, payload: dict) -> None:
    """Enqueue async notification creation."""
    app = _get_celery_app()
    app.send_task(  # type: ignore[attr-defined]
        "notify.create_notification",
        args=[user_id, notification_type, payload],
    )


def enqueue_publish_due_posts() -> None:
    """Enqueue scheduled-post publication sweep."""
    app = _get_celery_app()
    app.send_task("posts.publish_due_scheduled")  # type: ignore[attr-defined]


def enqueue_ai_safety_scan(asset_id: str, object_key: str, content_type: str) -> None:
    """Enqueue AI safety scan (NSFW + age-proxy classification). Idempotent on worker side."""
    app = _get_celery_app()
    app.send_task(  # type: ignore[attr-defined]
        "ai_safety.scan_image",
        args=[asset_id, object_key, content_type],
    )


def enqueue_remove_background(job_id: str) -> None:
    """Enqueue AI tool remove-background task. Idempotent on worker side."""
    app = _get_celery_app()
    app.send_task("ai_tools.remove_background", args=[job_id])  # type: ignore[attr-defined]


def enqueue_cartoonize(job_id: str) -> None:
    """Enqueue AI tool cartoon-avatar task. Idempotent on worker side."""
    app = _get_celery_app()
    app.send_task("ai_tools.cartoonize", args=[job_id])  # type: ignore[attr-defined]


def enqueue_translate_caption(
    translation_id: str,
    source_text: str,
    source_lang: str,
    target_lang: str,
) -> None:
    """Enqueue caption translation task. Idempotent on worker side."""
    app = _get_celery_app()
    app.send_task(  # type: ignore[attr-defined]
        "translation.translate_caption",
        args=[translation_id, source_text, source_lang, target_lang],
    )
